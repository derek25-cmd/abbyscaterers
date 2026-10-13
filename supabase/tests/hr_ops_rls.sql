-- RLS test for the Phase 1 HR/Ops access model.
--
-- RUN AGAINST A LOCAL OR STAGING DATABASE ONLY, never production, after all
-- migrations through 20261014000400 are applied:
--     psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hr_ops_rls.sql
-- Works with the hosted Supabase `postgres` role (no superuser needed): it can
-- bypass RLS and SET ROLE authenticated, which is all this script uses.
--
-- The whole script is ONE statement that always ends in an exception (PASS: or
-- FAIL:), which rolls back everything it created. Read the result from the
-- error message; PASS and FAIL are both reported that way.
-- For each of the five roles (plus a deactivated user) it switches to the
-- `authenticated` DB role with that user's JWT claims and checks SELECT /
-- INSERT / UPDATE / DELETE on every in-scope table against the matrix. Tables
-- that do not exist are skipped with a NOTICE, as in the migrations.
--
-- Outcome rules:
--  * INSERT is "denied" only when Postgres raises 42501 (RLS / privilege).
--    Postgres checks RLS before NOT NULL / CHECK / FK, so any other error
--    means RLS let the row through and counts as allowed.
--  * UPDATE / DELETE is "denied" when it affects 0 rows or raises 42501.
--  * Rows are seeded as the table owner (bypassing RLS). Foreign-key columns
--    are filled from a real parent row, seeding one if needed. Triggers fire
--    normally and are rolled back with everything else. A table whose row
--    cannot be seeded from generic values (e.g. a CHECK on a status column)
--    is reported as SKIPPED, and the run says so.

DO $test$
DECLARE
  hr_tables  constant text[] := ARRAY['employees','attendance','positions','training_participants','training_evaluations','payroll'];
  ops_tables constant text[] := ARRAY['products','stock_logs','assets','issuance'];
  roles      constant text[] := ARRAY['admin','general_manager','hr_manager','finance','staff'];
  all_tables text[] := hr_tables || ops_tables;
  today      date := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;

  uids jsonb := '{}'::jsonb;
  r text; t text; uid uuid; ov jsonb; tov jsonb; rid text;
  can_hr boolean; exp_select boolean; exp_write boolean; exp_update boolean;
  n int; ok boolean; ok2 boolean; ok3 boolean; ok4 boolean;
  failures int; skipped int := 0; checks int;
  lbl text; exp boolean;
BEGIN

  -- Helper functions are created INSIDE this block (and rolled back with it), so
  -- nothing is left behind however the SQL editor handles transactions.
  CREATE TEMP TABLE rls_results (who text, tbl text, op text, expected boolean, actual boolean) ON COMMIT DROP;
  EXECUTE $mk$
CREATE FUNCTION public._rlstest_id(tbl text, suffix text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE dt text;
BEGIN
  SELECT data_type INTO dt FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'id';
  IF dt = 'uuid' THEN RETURN md5('rlstest-' || tbl || suffix)::uuid::text; END IF;
  IF dt IN ('integer', 'bigint', 'smallint') THEN RETURN (abs(hashtext('rlstest-' || tbl || suffix)))::text; END IF;
  RETURN 'rlstest-' || suffix;
END $f$;
  $mk$;
  EXECUTE $mk$
CREATE FUNCTION public._rlstest_insert_sql(tbl text, suffix text, ov jsonb) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE cols text; vals text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
         string_agg(val, ', ' ORDER BY ordinal_position)
  INTO cols, vals
  FROM (
    SELECT c.column_name, c.ordinal_position,
      CASE
        WHEN c.column_name = 'id' THEN quote_literal(public._rlstest_id(tbl, suffix))
        WHEN ov ? c.column_name THEN quote_nullable(ov ->> c.column_name)
        WHEN c.data_type IN ('text', 'character varying', 'character') THEN quote_literal('t-' || suffix)
        WHEN c.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real') THEN '0'
        WHEN c.data_type = 'date' THEN quote_literal(current_date::text)
        WHEN c.data_type LIKE 'timestamp%' THEN 'now()'
        WHEN c.data_type = 'boolean' THEN 'false'
        WHEN c.data_type = 'uuid' THEN quote_literal(md5(suffix || c.column_name)::uuid::text)
        WHEN c.data_type IN ('json', 'jsonb', 'ARRAY') THEN quote_literal(CASE WHEN c.data_type = 'ARRAY' THEN '{}' ELSE '{}' END)
        ELSE 'NULL'
      END AS val
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tbl
      AND (c.column_name = 'id' OR ov ? c.column_name
           OR (c.is_nullable = 'NO' AND c.column_default IS NULL AND c.is_generated = 'NEVER' AND c.is_identity = 'NO'))
  ) x;
  RETURN format('INSERT INTO public.%I (%s) VALUES (%s)', tbl, cols, vals);
END $f$;
  $mk$;
  EXECUTE $mk$
CREATE FUNCTION public._rlstest_login(uid uuid) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
END $f$;
  $mk$;
  EXECUTE $mk$
CREATE FUNCTION public._rlstest_fk_ov(tbl text, suffix text) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE fk RECORD; v text; res jsonb := '{}'::jsonb;
BEGIN
  FOR fk IN
    SELECT a.attname AS col, c.confrelid::regclass::text AS parent, pa.attname AS parent_col,
           pc.relname AS parent_name
    FROM pg_constraint c
    JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
    JOIN pg_class pc ON pc.oid = c.confrelid
    WHERE c.contype = 'f' AND c.conrelid = ('public.' || quote_ident(tbl))::regclass
      AND array_length(c.conkey, 1) = 1
      AND pc.relnamespace = 'public'::regnamespace            -- skip auth.users etc.
  LOOP
    IF fk.parent_col = 'id' THEN
      PERFORM public._rlstest_seed(fk.parent_name, 'fk-' || suffix, '{}'::jsonb);
      v := public._rlstest_id(fk.parent_name, 'fk-' || suffix);
    ELSE
      EXECUTE format('SELECT %I::text FROM %s ORDER BY 1 LIMIT 1', fk.parent_col, fk.parent) INTO v;
    END IF;
    IF v IS NOT NULL THEN res := res || jsonb_build_object(fk.col, v); END IF;
  END LOOP;
  RETURN res;
END $f$;
  $mk$;
  EXECUTE $mk$
CREATE FUNCTION public._rlstest_seed(tbl text, suffix text, ov jsonb) RETURNS boolean LANGUAGE plpgsql AS $f$
DECLARE found int;
BEGIN
  BEGIN
    EXECUTE public._rlstest_insert_sql(tbl, suffix, public._rlstest_fk_ov(tbl, suffix) || ov) || ' ON CONFLICT DO NOTHING';
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id::text = %L', tbl, public._rlstest_id(tbl, suffix)) INTO found;
  RETURN found > 0;
END $f$;
  $mk$;

  -- ── Users ────────────────────────────────────────────────────────────────
  FOREACH r IN ARRAY roles || ARRAY['inactive'] LOOP
    uid := md5('rlstest-user-' || r)::uuid;
    uids := uids || jsonb_build_object(r, uid);
    -- staff_users.id and audit_log.actor_id reference auth.users.
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, r || '@rlstest.local', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_users (id, email, role, is_active)
    VALUES (uid, r || '@rlstest.local', CASE WHEN r = 'inactive' THEN 'staff' ELSE r END, r <> 'inactive')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  END LOOP;

  -- ── Per-role, per-table matrix ───────────────────────────────────────────
  FOREACH r IN ARRAY roles || ARRAY['inactive'] LOOP
    uid := (uids ->> r)::uuid;
    can_hr := r IN ('admin', 'general_manager', 'hr_manager');
    ov := jsonb_build_object('created_by', uid, 'date', today);

    FOREACH t IN ARRAY all_tables LOOP
      IF to_regclass('public.' || t) IS NULL THEN
        RAISE NOTICE 'SKIPPED % — table does not exist', t;
        CONTINUE;
      END IF;

      exp_select := CASE WHEN r = 'inactive' THEN false
                         WHEN t = 'employees' THEN can_hr OR r = 'finance'
                         ELSE true END;
      exp_write  := CASE WHEN r = 'inactive' THEN false
                         WHEN t = ANY (ops_tables) THEN true            -- Ops unchanged in Phase 1
                         WHEN t = 'payroll' THEN can_hr OR r = 'finance'
                         ELSE can_hr END;
      -- attendance: anyone active may update their OWN row from today (seeded that way here)
      exp_update := CASE WHEN t = 'attendance' THEN r <> 'inactive' ELSE exp_write END;

      tov := public._rlstest_fk_ov(t, 'ins-' || r) || ov;   -- as owner: parents hidden from `authenticated` by RLS
      IF NOT public._rlstest_seed(t, 'sel-' || r, ov) THEN
        RAISE NOTICE 'SKIPPED % — could not seed a row from generic values', t;
        skipped := skipped + 1;
        CONTINUE;
      END IF;

      -- SELECT
      PERFORM public._rlstest_login(uid);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I WHERE id::text = %L', t, public._rlstest_id(t, 'sel-' || r)) INTO n;
        ok := n > 0;
      EXCEPTION WHEN OTHERS THEN ok := false;
      END;
      -- INSERT
      BEGIN
        EXECUTE public._rlstest_insert_sql(t, 'ins-' || r, tov);
        ok2 := true;
      EXCEPTION
        WHEN insufficient_privilege THEN ok2 := false;
        WHEN OTHERS THEN ok2 := true;  -- past RLS, stopped by a table constraint
      END;
      RESET ROLE;
      INSERT INTO rls_results VALUES (r, t, 'SELECT', exp_select, ok);
      INSERT INTO rls_results VALUES (r, t, 'INSERT', r <> 'inactive', ok2);

      -- UPDATE (fresh seed so earlier operations cannot interfere)
      PERFORM public._rlstest_seed(t, 'upd-' || r, ov);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE format('UPDATE public.%I SET created_by = created_by WHERE id::text = %L', t, public._rlstest_id(t, 'upd-' || r));
        GET DIAGNOSTICS n = ROW_COUNT;
        ok := n > 0;
      EXCEPTION WHEN OTHERS THEN ok := false;
      END;
      RESET ROLE;
      INSERT INTO rls_results VALUES (r, t, 'UPDATE', exp_update, ok);

      -- DELETE
      PERFORM public._rlstest_seed(t, 'del-' || r, ov);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE id::text = %L', t, public._rlstest_id(t, 'del-' || r));
        GET DIAGNOSTICS n = ROW_COUNT;
        ok := n > 0;
      EXCEPTION WHEN OTHERS THEN ok := false;
      END;
      RESET ROLE;
      INSERT INTO rls_results VALUES (r, t, 'DELETE', exp_write, ok);
    END LOOP;
  END LOOP;

  -- ── attendance same-day rule for plain staff ─────────────────────────────
  IF to_regclass('public.attendance') IS NOT NULL THEN
    uid := (uids ->> 'staff')::uuid;
    FOR lbl, rid, exp IN
      SELECT * FROM (VALUES
        ('own row, today',          'att-own-today', true),
        ('own row, yesterday',      'att-own-yday',  false),
        ('another user''s, today',  'att-oth-today', false)
      ) v(label, id, expected)
    LOOP
      IF NOT public._rlstest_seed('attendance', rid, jsonb_build_object(
          'created_by', CASE WHEN rid = 'att-oth-today' THEN uids ->> 'finance' ELSE uid::text END,
          'date', CASE WHEN rid = 'att-own-yday' THEN today - 1 ELSE today END)) THEN
        CONTINUE;
      END IF;
      PERFORM public._rlstest_login(uid);
      SET LOCAL ROLE authenticated;
      BEGIN
        UPDATE public.attendance SET created_by = created_by WHERE id::text = public._rlstest_id('attendance', rid);
        GET DIAGNOSTICS n = ROW_COUNT;
        ok := n > 0;
      EXCEPTION WHEN OTHERS THEN ok := false;
      END;
      RESET ROLE;
      INSERT INTO rls_results VALUES ('staff', 'attendance', 'UPDATE ' || lbl, exp, ok);
    END LOOP;
  END IF;

  -- ── Employee directory ───────────────────────────────────────────────────
  IF to_regclass('public.employees') IS NOT NULL AND public._rlstest_seed('employees', 'dir', '{}'::jsonb) THEN
    FOREACH r IN ARRAY roles || ARRAY['inactive'] LOOP
      uid := (uids ->> r)::uuid;
      PERFORM public._rlstest_login(uid);
      SET LOCAL ROLE authenticated;
      BEGIN
        SELECT count(*) INTO n FROM public.get_employee_directory();
        ok := n > 0;
      EXCEPTION WHEN OTHERS THEN ok := false;
      END;
      RESET ROLE;
      INSERT INTO rls_results VALUES (r, 'get_employee_directory()', 'EXECUTE', r <> 'inactive', ok);
    END LOOP;
  END IF;

  -- ── audit_log: who can read it, and no direct writes ─────────────────────
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id) VALUES
    ((uids ->> 'staff')::uuid, 'employees.update', 'employees', 'rlstest-audit-hr'),
    ((uids ->> 'staff')::uuid, 'products.update',  'products',  'rlstest-audit-ops');

  FOREACH r IN ARRAY roles LOOP
    uid := (uids ->> r)::uuid;
    PERFORM public._rlstest_login(uid);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.audit_log WHERE record_id = 'rlstest-audit-hr';
    ok := n = 1;
    SELECT count(*) INTO n FROM public.audit_log WHERE record_id = 'rlstest-audit-ops';
    ok2 := n = 1;
    BEGIN
      INSERT INTO public.audit_log (actor_id, action, table_name) VALUES (uid, 'forged', 'employees');
      ok3 := true;
    EXCEPTION WHEN insufficient_privilege THEN ok3 := false;
    END;
    BEGIN
      PERFORM public.log_audit_event('rlstest.event', 'clients', 'rlstest-rpc', NULL);
      ok4 := true;
    EXCEPTION WHEN OTHERS THEN ok4 := false;
    END;
    RESET ROLE;
    INSERT INTO rls_results VALUES (r, 'audit_log', 'SELECT HR rows', r IN ('admin', 'general_manager', 'hr_manager'), ok);
    INSERT INTO rls_results VALUES (r, 'audit_log', 'SELECT Ops rows', r IN ('admin', 'general_manager'), ok2);
    INSERT INTO rls_results VALUES (r, 'audit_log', 'direct INSERT', false, ok3);
    INSERT INTO rls_results VALUES (r, 'audit_log', 'log_audit_event()', true, ok4);
  END LOOP;

  -- ── Audit trigger: actor, updated_by, and masking ────────────────────────
  IF to_regclass('public.positions') IS NOT NULL AND public._rlstest_seed('positions', 'trg', '{}'::jsonb) THEN
    uid := (uids ->> 'hr_manager')::uuid;
    rid := public._rlstest_id('positions', 'trg');
    PERFORM public._rlstest_login(uid);
    SET LOCAL ROLE authenticated;
    UPDATE public.positions SET created_by = (uids ->> 'admin')::uuid WHERE id::text = rid;
    RESET ROLE;
    SELECT count(*) INTO n FROM public.audit_log
      WHERE table_name = 'positions' AND record_id = rid AND actor_id = uid
        AND action = 'positions.update' AND metadata -> 'changed_fields' ? 'created_by';
    INSERT INTO rls_results VALUES ('hr_manager', 'positions', 'audit row has actor + changed field', true, n = 1);
    SELECT updated_by = uid INTO ok FROM public.positions WHERE id::text = rid;
    INSERT INTO rls_results VALUES ('hr_manager', 'positions', 'updated_by stamped', true, COALESCE(ok, false));
  END IF;

  IF to_regclass('public.employees') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'nationalId')
     AND public._rlstest_seed('employees', 'mask', '{}'::jsonb)
  THEN
    rid := public._rlstest_id('employees', 'mask');
    UPDATE public.employees SET "nationalId" = 'SECRET-NIDA-12345' WHERE id::text = rid;
    SELECT count(*) INTO n FROM public.audit_log WHERE record_id = rid AND metadata::text LIKE '%SECRET-NIDA-12345%';
    INSERT INTO rls_results VALUES ('system', 'employees', 'audit masks nationalId value', true, n = 0);
    SELECT count(*) INTO n FROM public.audit_log WHERE record_id = rid AND metadata -> 'changed_fields' ? 'nationalId';
    INSERT INTO rls_results VALUES ('system', 'employees', 'audit still records nationalId changed', true, n >= 1);
  END IF;

  -- ── staff_users: only admin manages users ────────────────────────────────
  FOREACH r IN ARRAY roles LOOP
    uid := (uids ->> r)::uuid;
    PERFORM public._rlstest_login(uid);
    SET LOCAL ROLE authenticated;
    BEGIN
      UPDATE public.staff_users SET role = role WHERE id = (uids ->> 'finance')::uuid;
      GET DIAGNOSTICS n = ROW_COUNT;
      ok := n > 0;
    EXCEPTION WHEN OTHERS THEN ok := false;
    END;
    RESET ROLE;
    INSERT INTO rls_results VALUES (r, 'staff_users', 'UPDATE another user', r = 'admin', ok);
  END LOOP;

  -- ── Verdict ──────────────────────────────────────────────────────────────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;

  -- Always end with an exception: it rolls back every row, user and function
  -- this script created, whatever the editor does with transactions. The
  -- message starts with PASS or FAIL; the "error" itself is intentional.
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed (% tables skipped). Failures: %', failures, checks, skipped,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': ' || expected || '->' || actual, E'
' ORDER BY tbl, who, op)
       FROM rls_results WHERE expected IS DISTINCT FROM actual);
  END IF;
  RAISE EXCEPTION 'PASS: all % checks passed (% table(s) skipped, could not seed). This error is intentional: it rolls everything back.', checks, skipped;
END
$test$;

