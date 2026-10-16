-- Face attendance tests (Phase 1): attendance is closed to plain staff, face
-- data and setup codes are unreadable by anyone, a kiosk device is not staff,
-- and apply_attendance_event() rolls punches up correctly.
--
-- RUN AGAINST A LOCAL OR STAGING DATABASE ONLY, never production, after all
-- migrations through 20261016000600 are applied. Same harness as
-- leave_rls.sql: ONE statement, works with the hosted `postgres` role, and it
-- ALWAYS ends in an exception that starts with PASS: or FAIL: (and rolls back
-- everything it created: users, employees, devices, punches, attendance).
--
-- It acts as five logins: staffA (plain staff, employee A), staffB (plain
-- staff, employee B), hr (hr_manager, employee H), adm (admin, no employee),
-- fin (finance, no employee) and dev (a kiosk device: an auth user with an
-- attendance_devices row and NO staff_users row). All dates are in 2030 so
-- they cannot touch real data. Tue 5 Mar 2030 is the roll-up day; shift
-- start is set to 08:00 with 15 minutes' grace for the run.
--
-- "Cannot read" means the query was refused (42501) or returned no rows.
-- For finance tables the device check is only meaningful where the table
-- has rows; tables with none (and none could be seeded) are listed in the
-- result.

DO $test$
DECLARE
  logins constant text[] := ARRAY['staffA', 'staffB', 'hr', 'adm', 'fin', 'dev'];
  finance_tables constant text[] := ARRAY['payroll', 'invoices', 'proforma_invoices', 'expenses', 'purchases',
                                          'vat_wht_ledger', 'ledger_entries', 'ledgers', 'payments'];
  local_day constant date := '2030-03-05';
  u jsonb := '{}'::jsonb;      -- login -> auth uid
  emp jsonb := '{}'::jsonb;    -- employee key -> employees.id
  nm text; uid uuid; t text; n integer; ok boolean; res text;
  dev_id uuid; ev uuid;
  failures integer; checks integer; notes text[] := '{}';
BEGIN
  -- Go-live guard (Phase 5): these tests create and roll back test rows. Once
  -- go-live is recorded (app_settings.hr_go_live_at) they must not run on this
  -- database any more; use the read-only checks in docs/hr-ops instead.
  IF (SELECT to_jsonb(s) ->> 'hr_go_live_at' FROM public.app_settings s WHERE s.id = true) IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSED: go-live has been recorded (app_settings.hr_go_live_at), so the SQL tests no longer run on this database. Use docs/hr-ops/postflight.sql and monitoring.sql.';
  END IF;
  IF to_regclass('public.face_templates') IS NULL THEN
    RAISE EXCEPTION 'FAIL: face attendance tables are missing. Apply migrations through 20261016000600 first.';
  END IF;
  CREATE TEMP TABLE rls_results (who text, tbl text, op text, expected boolean, actual boolean) ON COMMIT DROP;

  -- ── Helpers, created inside this block so nothing is left behind ─────────
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
            WHEN c.column_name = 'score' THEN '3'
            WHEN c.data_type IN ('text', 'character varying', 'character') THEN quote_literal('t-' || suffix)
            WHEN c.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real') THEN '0'
            WHEN c.data_type = 'date' THEN quote_literal(current_date::text)
            WHEN c.data_type LIKE 'timestamp%' THEN 'now()'
            WHEN c.data_type = 'boolean' THEN 'false'
            WHEN c.data_type = 'uuid' THEN quote_literal(md5(suffix || c.column_name)::uuid::text)
            WHEN c.data_type IN ('json', 'jsonb', 'ARRAY') THEN quote_literal('{}')
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
        SELECT a.attname AS col, c.confrelid::regclass::text AS parent, pa.attname AS parent_col, pc.relname AS parent_name
        FROM pg_constraint c
        JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
        JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
        JOIN pg_class pc ON pc.oid = c.confrelid
        WHERE c.contype = 'f' AND c.conrelid = ('public.' || quote_ident(tbl))::regclass
          AND array_length(c.conkey, 1) = 1
          AND a.attnotnull AND pc.relnamespace = 'public'::regnamespace
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
        PERFORM set_config('rlstest.last_err', tbl || ': ' || SQLERRM, true);
        RETURN false;
      END;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE id::text = %L', tbl, public._rlstest_id(tbl, suffix)) INTO found;
      RETURN found > 0;
    END $f$;
  $mk$;
  -- Run one statement as a signed-in user. Returns 'ok:<rows>' or
  -- 'err:<sqlstate>:<message>|<hint>'. Claims are cleared afterwards.
  EXECUTE $mk$
    CREATE FUNCTION public._lt_as(uid uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE n integer; m text; h text; res text;
    BEGIN
      PERFORM public._rlstest_login(uid);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE stmt;
        GET DIAGNOSTICS n = ROW_COUNT;
        res := 'ok:' || n;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS m = MESSAGE_TEXT, h = PG_EXCEPTION_HINT;
        res := 'err:' || SQLSTATE || ':' || coalesce(m, '') || '|' || coalesce(h, '');
      END;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      RETURN res;
    END $f$;
  $mk$;
  -- Same, for a single-value query: returns the value as text, or 'err:...'.
  EXECUTE $mk$
    CREATE FUNCTION public._fa_value(uid uuid, query text) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE v text; m text;
    BEGIN
      PERFORM public._rlstest_login(uid);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE query INTO v;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS m = MESSAGE_TEXT;
        v := 'err:' || SQLSTATE || ':' || coalesce(m, '');
      END;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      RETURN v;
    END $f$;
  $mk$;
  -- apply_attendance_event() as the database owner, optionally with a
  -- signed-in user's claims (as a later SECURITY DEFINER caller would run
  -- it). Returns its result, or 'err:<hint>:<message>'.
  EXECUTE $mk$
    CREATE FUNCTION public._fa_apply(ev uuid, as_uid uuid) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE v text; m text; h text;
    BEGIN
      IF as_uid IS NOT NULL THEN PERFORM public._rlstest_login(as_uid); END IF;
      BEGIN
        v := public.apply_attendance_event(ev);
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS m = MESSAGE_TEXT, h = PG_EXCEPTION_HINT;
        v := 'err:' || coalesce(h, '') || ':' || coalesce(m, '');
      END;
      PERFORM set_config('request.jwt.claims', '', true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      RETURN v;
    END $f$;
  $mk$;

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  FOREACH nm IN ARRAY logins LOOP
    uid := md5('facetest-user-' || nm)::uuid;
    u := u || jsonb_build_object(nm, uid);
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, nm || '@facetest.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- A, B, H: linked to logins. P, L, Ab, N, R, Q: roll-up cases. I: leaves.
  FOREACH nm IN ARRAY ARRAY['A', 'B', 'H', 'P', 'L', 'Ab', 'N', 'R', 'Q', 'I'] LOOP
    IF NOT public._rlstest_seed('employees', 'fa-' || nm,
         jsonb_build_object('status', 'Active', 'department', 'FaceTest', 'firstName', 'Test' || nm, 'lastName', 'Face')) THEN
      RAISE EXCEPTION 'FAIL: could not seed an employee row (%)', current_setting('rlstest.last_err', true);
    END IF;
    emp := emp || jsonb_build_object(nm, public._rlstest_id('employees', 'fa-' || nm));
  END LOOP;

  INSERT INTO public.staff_users (id, email, role, is_active, employee_id) VALUES
    ((u ->> 'staffA')::uuid, 'staffA@facetest.local', 'staff',      true, emp ->> 'A'),
    ((u ->> 'staffB')::uuid, 'staffB@facetest.local', 'staff',      true, emp ->> 'B'),
    ((u ->> 'hr')::uuid,     'hr@facetest.local',     'hr_manager', true, emp ->> 'H'),
    ((u ->> 'adm')::uuid,    'adm@facetest.local',    'admin',      true, NULL),
    ((u ->> 'fin')::uuid,    'fin@facetest.local',    'finance',    true, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true, employee_id = EXCLUDED.employee_id;

  INSERT INTO public.attendance_devices (name, site, auth_user_id)
  VALUES ('Face test kiosk', 'Test site', (u ->> 'dev')::uuid) RETURNING id INTO dev_id;

  -- Attendance for A and B on 4 Mar 2030, as the owner (bypasses RLS).
  FOREACH nm IN ARRAY ARRAY['A', 'B'] LOOP
    IF NOT public._rlstest_seed('attendance', 'fa-att-' || nm,
         jsonb_build_object('employee_id', emp ->> nm, 'date', '2030-03-04', 'status', 'Present')) THEN
      RAISE EXCEPTION 'FAIL: could not seed an attendance row (%)', current_setting('rlstest.last_err', true);
    END IF;
  END LOOP;

  INSERT INTO public.face_templates (employee_id, embedding, dims, model_version, quality_score)
  VALUES (emp ->> 'A', '[0.111,0.222,0.333]', 3, 'facetest-model', 0.9);
  INSERT INTO public.attendance_setup_codes (employee_id, code_hash, expires_at)
  VALUES (emp ->> 'A', 'SECRET-CODE-HASH-FA', now() + interval '1 day');
  INSERT INTO public.biometric_consents (employee_id, device_id, consent_version)
  VALUES (emp ->> 'A', dev_id, 'test-v1'), (emp ->> 'B', dev_id, 'test-v1');
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method, needs_review) VALUES
    (emp ->> 'A', dev_id, 'in', '2030-03-04 08:00+03', 'face', true),
    (emp ->> 'B', dev_id, 'in', '2030-03-04 08:00+03', 'face', true);

  -- ── A. attendance: plain staff read their own rows and write nothing ─────
  res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT * FROM public.attendance WHERE employee_id = %L', emp ->> 'A'));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'reads own rows', true, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT * FROM public.attendance WHERE employee_id = %L', emp ->> 'B'));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'reads someone else''s rows', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid,
    public._rlstest_insert_sql('attendance', 'fa-ins-A', jsonb_build_object('employee_id', emp ->> 'A', 'date', '2030-03-06', 'status', 'Present')));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'inserts own row', false, res NOT LIKE 'err:42501%');
  res := public._lt_as((u ->> 'staffA')::uuid, format('UPDATE public.attendance SET status = %L WHERE employee_id = %L', 'Late', emp ->> 'A'));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'updates own row', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('DELETE FROM public.attendance WHERE employee_id = %L', emp ->> 'A'));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'deletes own row', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'fin')::uuid, format('SELECT * FROM public.attendance WHERE employee_id IN (%L, %L)', emp ->> 'A', emp ->> 'B'));
  INSERT INTO rls_results VALUES ('fin', 'attendance', 'finance (no employee link) reads others'' rows', false, res LIKE 'ok:%' AND res <> 'ok:0');

  -- HR keeps full CRUD.
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT * FROM public.attendance WHERE employee_id IN (%L, %L)', emp ->> 'A', emp ->> 'B'));
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'reads everyone (2 rows)', true, res = 'ok:2');
  res := public._lt_as((u ->> 'hr')::uuid,
    public._rlstest_insert_sql('attendance', 'fa-ins-H', jsonb_build_object('employee_id', emp ->> 'A', 'date', '2030-03-07', 'status', 'Present')));
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'inserts', true, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.attendance SET status = %L WHERE employee_id = %L AND date = %L', 'Half Day', emp ->> 'B', '2030-03-04'));
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'updates', true, res = 'ok:1');
  res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.attendance WHERE employee_id = %L AND date = %L', emp ->> 'A', '2030-03-07'));
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'deletes', true, res = 'ok:1');

  -- ── B. Face templates and setup codes: nobody reads or writes them ───────
  FOREACH nm IN ARRAY ARRAY['staffA', 'hr', 'adm', 'dev'] LOOP
    FOREACH t IN ARRAY ARRAY['face_templates', 'attendance_setup_codes'] LOOP
      res := public._lt_as((u ->> nm)::uuid, format('SELECT * FROM public.%I', t));
      INSERT INTO rls_results VALUES (nm, t, 'SELECT', false, res LIKE 'ok:%' AND res <> 'ok:0');
    END LOOP;
  END LOOP;
  res := public._lt_as((u ->> 'hr')::uuid, format(
    'INSERT INTO public.face_templates (employee_id, embedding, dims, model_version) VALUES (%L, %L, 3, %L)', emp ->> 'B', '[1,2,3]', 'x'));
  INSERT INTO rls_results VALUES ('hr', 'face_templates', 'INSERT', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.attendance_setup_codes WHERE employee_id = %L', emp ->> 'A'));
  INSERT INTO rls_results VALUES ('hr', 'attendance_setup_codes', 'DELETE', false, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── C. A kiosk device is not staff ───────────────────────────────────────
  FOREACH t IN ARRAY ARRAY['employees', 'attendance', 'staff_users', 'audit_log', 'attendance_events', 'biometric_consents', 'face_attendance_settings'] LOOP
    res := public._lt_as((u ->> 'dev')::uuid, format('SELECT * FROM public.%I', t));
    INSERT INTO rls_results VALUES ('dev', t, 'SELECT', false, res LIKE 'ok:%' AND res <> 'ok:0');
  END LOOP;
  FOREACH t IN ARRAY finance_tables LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n = 0 AND NOT public._rlstest_seed(t, 'fa-fin', '{}'::jsonb) THEN
      notes := notes || (t || ' has no rows, so the device read check on it proves nothing');
    END IF;
    res := public._lt_as((u ->> 'dev')::uuid, format('SELECT * FROM public.%I', t));
    INSERT INTO rls_results VALUES ('dev', t, 'SELECT (finance)', false, res LIKE 'ok:%' AND res <> 'ok:0');
  END LOOP;
  res := public._lt_as((u ->> 'dev')::uuid, 'SELECT * FROM public.get_employee_directory()');
  INSERT INTO rls_results VALUES ('dev', 'get_employee_directory()', 'EXECUTE', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'dev')::uuid, format(
    'INSERT INTO public.attendance_events (employee_id, kind, occurred_at, method) VALUES (%L, %L, now(), %L)', emp ->> 'A', 'in', 'face'));
  INSERT INTO rls_results VALUES ('dev', 'attendance_events', 'INSERT directly', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'dev')::uuid,
    public._rlstest_insert_sql('attendance', 'fa-ins-D', jsonb_build_object('employee_id', emp ->> 'A', 'date', '2030-03-08', 'status', 'Present')));
  INSERT INTO rls_results VALUES ('dev', 'attendance', 'INSERT directly', false, res NOT LIKE 'err:42501%');

  INSERT INTO rls_results VALUES ('dev', 'current_device_id()', 'is this device', true,
    public._fa_value((u ->> 'dev')::uuid, 'SELECT public.current_device_id()::text') = dev_id::text);
  INSERT INTO rls_results VALUES ('staffA', 'current_device_id()', 'is NULL for staff', true,
    public._fa_value((u ->> 'staffA')::uuid, 'SELECT public.current_device_id()::text') IS NULL);
  FOR nm, res IN SELECT * FROM (VALUES ('hr', 'hr'), ('adm', 'hr'), ('dev', 'device'), ('staffA', 'none'), ('fin', 'none')) v(who, expected) LOOP
    INSERT INTO rls_results VALUES (nm, 'face_whoami()', 'returns ' || res, true,
      public._fa_value((u ->> nm)::uuid, 'SELECT public.face_whoami()') = res);
  END LOOP;
  UPDATE public.attendance_devices SET active = false WHERE id = dev_id;
  INSERT INTO rls_results VALUES ('dev', 'face_whoami()', 'inactive device returns none', true,
    public._fa_value((u ->> 'dev')::uuid, 'SELECT public.face_whoami()') = 'none');
  UPDATE public.attendance_devices SET active = true WHERE id = dev_id;

  -- Device logins and staff logins stay separate, both ways.
  BEGIN
    INSERT INTO public.staff_users (id, email, role, is_active) VALUES ((u ->> 'dev')::uuid, 'dev@facetest.local', 'staff', true);
    ok := true;
  EXCEPTION WHEN OTHERS THEN ok := false;
  END;
  INSERT INTO rls_results VALUES ('system', 'staff_users', 'a device login becomes staff', false, ok);
  BEGIN
    INSERT INTO public.attendance_devices (name, auth_user_id) VALUES ('Forged kiosk', (u ->> 'staffA')::uuid);
    ok := true;
  EXCEPTION WHEN OTHERS THEN ok := false;
  END;
  INSERT INTO rls_results VALUES ('system', 'attendance_devices', 'a staff login becomes a device', false, ok);

  -- ── D. Punches and consents: HR all, staff own, no client writes ─────────
  FOREACH t IN ARRAY ARRAY['attendance_events', 'biometric_consents'] LOOP
    res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT * FROM public.%I WHERE employee_id = %L', t, emp ->> 'A'));
    INSERT INTO rls_results VALUES ('staffA', t, 'reads own', true, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT * FROM public.%I WHERE employee_id = %L', t, emp ->> 'B'));
    INSERT INTO rls_results VALUES ('staffA', t, 'reads someone else''s', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'hr')::uuid, format('SELECT * FROM public.%I WHERE employee_id IN (%L, %L)', t, emp ->> 'A', emp ->> 'B'));
    INSERT INTO rls_results VALUES ('hr', t, 'reads all (2 rows)', true, res = 'ok:2');
    res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.%I WHERE employee_id = %L', t, emp ->> 'A'));
    INSERT INTO rls_results VALUES ('hr', t, 'DELETE', false, res LIKE 'ok:%' AND res <> 'ok:0');
  END LOOP;
  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.attendance_events (employee_id, kind, occurred_at, method) VALUES (%L, %L, now(), %L)', emp ->> 'A', 'in', 'manual'));
  INSERT INTO rls_results VALUES ('staffA', 'attendance_events', 'INSERT', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.attendance_events SET needs_review = false WHERE employee_id = %L', emp ->> 'A'));
  INSERT INTO rls_results VALUES ('hr', 'attendance_events', 'UPDATE directly', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.biometric_consents (employee_id, consent_version) VALUES (%L, %L)', emp ->> 'A', 'forged'));
  INSERT INTO rls_results VALUES ('staffA', 'biometric_consents', 'INSERT', false, res LIKE 'ok:%');

  -- ── E. Devices and settings ──────────────────────────────────────────────
  res := public._lt_as((u ->> 'hr')::uuid, 'SELECT * FROM public.attendance_devices');
  INSERT INTO rls_results VALUES ('hr', 'attendance_devices', 'SELECT', true, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, 'INSERT INTO public.attendance_devices (name) VALUES (''HR kiosk'')');
  INSERT INTO rls_results VALUES ('hr', 'attendance_devices', 'INSERT', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'adm')::uuid, 'INSERT INTO public.attendance_devices (name) VALUES (''Admin kiosk'')');
  INSERT INTO rls_results VALUES ('adm', 'attendance_devices', 'INSERT', true, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'staffA')::uuid, 'SELECT * FROM public.attendance_devices');
  INSERT INTO rls_results VALUES ('staffA', 'attendance_devices', 'SELECT', false, res LIKE 'ok:%' AND res <> 'ok:0');

  res := public._lt_as((u ->> 'hr')::uuid, 'SELECT * FROM public.face_attendance_settings');
  INSERT INTO rls_results VALUES ('hr', 'face_attendance_settings', 'SELECT', true, res = 'ok:1');
  res := public._lt_as((u ->> 'staffA')::uuid, 'SELECT * FROM public.face_attendance_settings');
  INSERT INTO rls_results VALUES ('staffA', 'face_attendance_settings', 'SELECT', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, 'UPDATE public.face_attendance_settings SET late_grace_minutes = 30');
  INSERT INTO rls_results VALUES ('hr', 'face_attendance_settings', 'UPDATE', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'adm')::uuid, 'UPDATE public.face_attendance_settings SET late_grace_minutes = 15, shift_start = ''08:00''');
  INSERT INTO rls_results VALUES ('adm', 'face_attendance_settings', 'UPDATE', true, res = 'ok:1');
  res := public._lt_as((u ->> 'adm')::uuid, 'DELETE FROM public.face_attendance_settings');
  INSERT INTO rls_results VALUES ('adm', 'face_attendance_settings', 'DELETE', false, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── F. apply_attendance_event() ──────────────────────────────────────────
  UPDATE public.face_attendance_settings SET shift_start = '08:00', late_grace_minutes = 15;

  -- Not callable from the API, by anyone.
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'P', dev_id, 'in', (local_day + time '08:10') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  FOREACH nm IN ARRAY ARRAY['hr', 'adm', 'dev'] LOOP
    res := public._fa_value((u ->> nm)::uuid, format('SELECT public.apply_attendance_event(%L)', ev));
    INSERT INTO rls_results VALUES (nm, 'apply_attendance_event()', 'EXECUTE from the API', false, res NOT LIKE 'err:42501%');
  END LOOP;

  -- P: in at 08:10, within grace -> Present. Applied with the device's claims,
  -- as the kiosk will, so attendance_leave_guard and the freeze run for a
  -- non-HR caller.
  res := public._fa_apply(ev, (u ->> 'dev')::uuid);
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'in 08:10 applied', true, res = 'applied');
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'in 08:10 is Present, clock-in 08:10, name filled', true,
    EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'P' AND date = local_day
            AND status = 'Present' AND clock_in_time = '08:10' AND employee = 'TestP Face'));
  INSERT INTO rls_results VALUES ('system', 'attendance_events', 'applied_at set', true,
    EXISTS (SELECT 1 FROM public.attendance_events WHERE id = ev AND applied_at IS NOT NULL));
  INSERT INTO rls_results VALUES ('system', 'apply_attendance_event()', 'applying twice is a no-op', true,
    public._fa_apply(ev, NULL) = 'already_applied');

  -- P: a second 'in' later the same day changes nothing.
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'P', dev_id, 'in', (local_day + time '09:30') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, (u ->> 'dev')::uuid);
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'second in is no_change, still Present 08:10', true,
    res = 'no_change' AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'P' AND date = local_day
                                  AND status = 'Present' AND clock_in_time = '08:10'));

  -- P: out at 17:05.
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'P', dev_id, 'out', (local_day + time '17:05') AT TIME ZONE 'Africa/Dar_es_Salaam', 'pin') RETURNING id INTO ev;
  res := public._fa_apply(ev, (u ->> 'dev')::uuid);
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'out sets clock-out 17:05', true,
    res = 'applied' AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'P' AND date = local_day AND clock_out_time = '17:05'));

  -- L: in at 08:16, one minute past grace -> Late.
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'L', dev_id, 'in', (local_day + time '08:16') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, (u ->> 'dev')::uuid);
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'in 08:16 is Late', true,
    res = 'applied' AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'L' AND date = local_day AND status = 'Late'));

  -- Exactly at the end of grace (08:15) is still Present; a punch at 00:30 local
  -- belongs to that local day, not the UTC day before.
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'Q', dev_id, 'in', (local_day + time '00:30') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, NULL);
  INSERT INTO rls_results VALUES ('system', 'apply_attendance_event()', '00:30 local is that local day, Present', true,
    res = 'applied' AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'Q' AND date = local_day AND status = 'Present'));
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'R', dev_id, 'in', (local_day + time '08:15') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, NULL);
  INSERT INTO rls_results VALUES ('system', 'apply_attendance_event()', 'in 08:15 (end of grace) is Present', true,
    res = 'applied' AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'R' AND date = local_day AND status = 'Present'));

  -- Ab: HR pre-marked Absent; an 08:05 clock-in overwrites it with Present.
  PERFORM public._rlstest_seed('attendance', 'fa-att-Ab', jsonb_build_object('employee_id', emp ->> 'Ab', 'date', local_day, 'status', 'Absent'));
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'Ab', dev_id, 'in', (local_day + time '08:05') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, (u ->> 'dev')::uuid);
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'pre-marked Absent becomes Present', true,
    res = 'applied' AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'Ab' AND date = local_day
                                AND status = 'Present' AND clock_in_time = '08:05'));

  -- N: a punch that needs review is not applied.
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method, needs_review)
  VALUES (emp ->> 'N', dev_id, 'in', (local_day + time '08:00') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face', true) RETURNING id INTO ev;
  res := public._fa_apply(ev, NULL);
  INSERT INTO rls_results VALUES ('system', 'apply_attendance_event()', 'needs_review is not applied', true,
    res = 'pending_review' AND NOT EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'N' AND date = local_day));

  -- N: a clock-out with no clock-in that day is refused.
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'N', dev_id, 'out', (local_day + time '17:00') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, NULL);
  INSERT INTO rls_results VALUES ('system', 'apply_attendance_event()', 'out without in refused', true, res LIKE 'err:NO_CLOCK_IN:%');

  -- B: a leave day is refused, whether hand-marked Leave or from a leave request.
  PERFORM public._rlstest_seed('attendance', 'fa-att-B-leave', jsonb_build_object('employee_id', emp ->> 'B', 'date', local_day, 'status', 'Leave'));
  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'B', dev_id, 'in', (local_day + time '08:00') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, (u ->> 'dev')::uuid);
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'hand-marked Leave day refused', true,
    res LIKE 'err:ON_LEAVE:%' AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'B' AND date = local_day
                                          AND status = 'Leave' AND clock_in_time IS NULL));

  IF to_regclass('public.leave_requests') IS NOT NULL
     AND public._rlstest_seed('leave_requests', 'fa-lr', jsonb_build_object(
           'employee_id', emp ->> 'A', 'start_date', local_day, 'end_date', local_day, 'status', 'approved', 'days', 1))
     AND public._rlstest_seed('attendance', 'fa-att-A-leave', jsonb_build_object(
           'employee_id', emp ->> 'A', 'date', local_day, 'status', 'Leave',
           'leave_request_id', public._rlstest_id('leave_requests', 'fa-lr'))) THEN
    INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
    VALUES (emp ->> 'A', dev_id, 'in', (local_day + time '08:00') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
    res := public._fa_apply(ev, (u ->> 'dev')::uuid);
    INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'approved-leave day refused', true, res LIKE 'err:ON_LEAVE:%');
  ELSE
    notes := notes || ('approved-leave case skipped: could not seed a leave request and its day (' || coalesce(current_setting('rlstest.last_err', true), '?') || ')');
  END IF;

  -- ── G. Leaving: clean-up, and punches refused ────────────────────────────
  UPDATE public.employees SET face_status = 'active' WHERE id = emp ->> 'I';
  INSERT INTO public.face_templates (employee_id, embedding, dims, model_version)
  VALUES (emp ->> 'I', '[0.5,0.5,0.5]', 3, 'facetest-model');
  INSERT INTO public.attendance_setup_codes (employee_id, code_hash, expires_at, used_at) VALUES
    (emp ->> 'I', 'unused', now() + interval '1 day', NULL),
    (emp ->> 'I', 'used',   now() + interval '1 day', now());
  UPDATE public.employees SET status = 'Inactive' WHERE id = emp ->> 'I';
  INSERT INTO rls_results VALUES ('system', 'face_templates', 'deleted when the employee leaves', true,
    NOT EXISTS (SELECT 1 FROM public.face_templates WHERE employee_id = emp ->> 'I'));
  INSERT INTO rls_results VALUES ('system', 'attendance_setup_codes', 'unused codes deleted, used ones kept', true,
    (SELECT array_agg(code_hash) FROM public.attendance_setup_codes WHERE employee_id = emp ->> 'I') = ARRAY['used']);
  INSERT INTO rls_results VALUES ('system', 'employees', 'face_status back to none', true,
    EXISTS (SELECT 1 FROM public.employees WHERE id = emp ->> 'I' AND face_status = 'none'));

  INSERT INTO public.attendance_events (employee_id, device_id, kind, occurred_at, method)
  VALUES (emp ->> 'I', dev_id, 'in', (local_day + time '08:00') AT TIME ZONE 'Africa/Dar_es_Salaam', 'face') RETURNING id INTO ev;
  res := public._fa_apply(ev, (u ->> 'dev')::uuid);
  INSERT INTO rls_results VALUES ('dev', 'apply_attendance_event()', 'Inactive employee refused', true,
    res LIKE 'err:EMPLOYEE_INACTIVE:%' AND NOT EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp ->> 'I' AND date = local_day));

  -- Punches are history: delete_employee refuses someone who has them.
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.delete_employee(%L)', emp ->> 'N'));
  INSERT INTO rls_results VALUES ('hr', 'delete_employee', 'refuses an employee with punches', true,
    res LIKE 'err:%clock-in/out record(s)%');

  -- ── H. Audit: secrets never reach audit_log ──────────────────────────────
  UPDATE public.employees SET attendance_pin_hash = 'SECRET-PIN-HASH-FA' WHERE id = emp ->> 'A';
  INSERT INTO rls_results VALUES ('system', 'audit_log', 'PIN hash value masked', true,
    NOT EXISTS (SELECT 1 FROM public.audit_log WHERE record_id = emp ->> 'A' AND metadata::text LIKE '%SECRET-PIN-HASH-FA%'));
  INSERT INTO rls_results VALUES ('system', 'audit_log', 'PIN hash change still recorded', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'employees' AND record_id = emp ->> 'A'
            AND metadata -> 'changed_fields' ? 'attendance_pin_hash'));
  INSERT INTO rls_results VALUES ('system', 'audit_log', 'embedding value masked', true,
    NOT EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'face_templates'
                AND (coalesce(metadata -> 'new', '{}') ? 'embedding' OR coalesce(metadata -> 'old', '{}') ? 'embedding')));
  INSERT INTO rls_results VALUES ('system', 'audit_log', 'face template insert recorded', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'face_templates' AND action = 'face_templates.insert'
            AND metadata -> 'changed_fields' ? 'embedding'));
  INSERT INTO rls_results VALUES ('system', 'audit_log', 'setup code hash masked', true,
    NOT EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'attendance_setup_codes' AND metadata::text LIKE '%SECRET-CODE-HASH-FA%'));
  INSERT INTO rls_results VALUES ('system', 'audit_log', 'kiosk attendance write recorded under the device', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'attendance' AND action = 'attendance.insert'
            AND actor_id = (u ->> 'dev')::uuid AND metadata -> 'new' ->> 'employee_id' = emp ->> 'P'));
  res := public._lt_as((u ->> 'hr')::uuid, 'SELECT * FROM public.audit_log WHERE table_name = ''attendance_events''');
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'HR manager sees punch audit rows', true, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── Verdict (always an exception, so everything above is rolled back) ────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed. Failures: % %', failures, checks,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': expected ' || expected || ' got ' || coalesce(actual::text, 'null'), E'
' ORDER BY tbl, who, op) FROM rls_results WHERE expected IS DISTINCT FROM actual),
      array_to_string(notes, '; ');
  END IF;
  RAISE EXCEPTION 'PASS: all % face attendance checks passed. % This error is intentional: it rolls everything back.', checks, array_to_string(notes, '; ');
END
$test$;
