-- Go-live tests (Phase 5): the HR module switch, opening leave balances, the
-- two importers (all or nothing), and the UAT cleanup (removes test data only,
-- resets reference numbers, keeps real data).
--
-- Runs on the main database until go-live (it refuses afterwards), after all
-- migrations through 20261014002100. Same harness as the other files: ONE
-- statement that ALWAYS ends in an exception starting with PASS: or FAIL:,
-- which rolls back everything it did, including what the cleanup removed.
-- Issuing a letter needs the postgres role to be able to write storage.objects.

DO $test$
DECLARE
  people constant text[] := ARRAY['hr', 'adm', 'fin', 'stf'];
  roles_ constant jsonb := '{"hr": "hr_manager", "adm": "admin", "fin": "finance", "stf": "staff"}';
  u jsonb := '{}'::jsonb;
  hr uuid; adm uuid; fin uuid; stf uuid;
  nm text; uid uuid; res text; n integer; v numeric; ok boolean; j jsonb;
  today date := public.hr_today();
  yr integer := public.hr_go_live_year();
  annual uuid; sick uuid;
  empO text; empP text; empQ text; empR text; empU text; empReal text;
  uat_login uuid := md5('p5test-uat-login')::uuid;
  dUat uuid; dReal uuid; real_ref text; real_seq integer; uat_ref text;
  lUat uuid; lReal uuid;
  big jsonb;
  saved_modules text[];
  failures integer; checks integer; notes text[] := '{}';
BEGIN
  -- Go-live guard (Phase 5): these tests create and roll back test rows. Once
  -- go-live is recorded (app_settings.hr_go_live_at) they must not run on this
  -- database any more; use the read-only checks in docs/hr-ops instead.
  IF (SELECT to_jsonb(s) ->> 'hr_go_live_at' FROM public.app_settings s WHERE s.id = true) IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSED: go-live has been recorded (app_settings.hr_go_live_at), so the SQL tests no longer run on this database. Use docs/hr-ops/postflight.sql and monitoring.sql.';
  END IF;
  CREATE TEMP TABLE rls_results (who text, tbl text, op text, expected boolean, actual boolean) ON COMMIT DROP;

  -- ── Helpers (inside this block; rolled back with it) ─────────────────────
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
          AND a.attnotnull
          AND pc.relnamespace = 'public'::regnamespace
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
  -- Run one statement as a signed-in user: 'ok:<rows>' or 'err:<sqlstate>:<message>|<hint>'.
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
  -- A draft written by HR, for an employee or a candidate. Returns its id.
  EXECUTE $mk$
    CREATE FUNCTION public._p5_draft(author uuid, doc_type text, emp text, cand uuid, subject text, data jsonb) RETURNS uuid LANGUAGE plpgsql AS $f$
    DECLARE res text; d uuid;
    BEGIN
      res := public._lt_as(author, format(
        'INSERT INTO public.hr_documents (doc_type, employee_id, candidate_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L, %L)',
        doc_type, emp, cand,
        (SELECT id FROM public.hr_document_templates WHERE hr_document_templates.doc_type = _p5_draft.doc_type AND is_active),
        subject, data));
      IF res NOT LIKE 'ok:%' THEN RAISE EXCEPTION 'FAIL: could not write the % draft "%": %', doc_type, subject, res; END IF;
      SELECT id INTO d FROM public.hr_documents WHERE hr_documents.subject = _p5_draft.subject;
      RETURN d;
    END $f$;
  $mk$;
  -- Submit (author), approve (approver), check, reserve, store the file, issue.
  -- Returns 'ok:...' or the first refusal, prefixed with the step.
  EXECUTE $mk$
    CREATE FUNCTION public._p5_issue(d uuid, author uuid, approver uuid) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE res text; r public.hr_documents%ROWTYPE; path text;
    BEGIN
      SELECT * INTO r FROM public.hr_documents WHERE id = d;
      IF r.status = 'draft' THEN
        res := public._lt_as(author, format('SELECT public.submit_hr_document(%L)', d));
        IF res NOT LIKE 'ok:%' THEN RETURN 'submit ' || res; END IF;
      END IF;
      SELECT * INTO r FROM public.hr_documents WHERE id = d;
      IF r.status = 'pending_approval' THEN
        res := public._lt_as(approver, format('SELECT public.approve_hr_document(%L)', d));
        IF res NOT LIKE 'ok:%' THEN RETURN 'approve ' || res; END IF;
      END IF;
      res := public._lt_as(author, format('SELECT public.validate_hr_document(%L)', d));
      IF res NOT LIKE 'ok:%' THEN RETURN 'validate ' || res; END IF;
      res := public._lt_as(author, format('SELECT public.reserve_hr_document_ref(%L)', d));
      IF res NOT LIKE 'ok:%' THEN RETURN 'reserve ' || res; END IF;
      SELECT * INTO r FROM public.hr_documents WHERE id = d;
      path := coalesce(r.employee_id, 'candidate-' || r.candidate_id::text) || '/' || replace(r.ref_no, '/', '_') || '.pdf';
      INSERT INTO storage.objects (bucket_id, name) VALUES ('hr-documents', path) ON CONFLICT DO NOTHING;
      res := public._lt_as(author, format('SELECT public.issue_hr_document(%L, %L, %L)', d, path,
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'));
      IF res NOT LIKE 'ok:%' THEN RETURN 'issue ' || res; END IF;
      RETURN res;
    END $f$;
  $mk$;


  -- ── Fixtures ─────────────────────────────────────────────────────────────
  FOREACH nm IN ARRAY people LOOP
    uid := md5('p5test-user-' || nm)::uuid;
    u := u || jsonb_build_object(nm, uid);
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, nm || '@p5test.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_users (id, email, role, is_active)
    VALUES (uid, nm || '@p5test.local', roles_ ->> nm, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  END LOOP;
  hr := (u ->> 'hr')::uuid; adm := (u ->> 'adm')::uuid; fin := (u ->> 'fin')::uuid; stf := (u ->> 'stf')::uuid;

  -- O: opening balances. P: opening import. Q, R: contract import.
  -- U: a UAT employee (by name). Real: a real employee next to it.
  FOREACH nm IN ARRAY ARRAY['O', 'P', 'Q', 'R', 'Real'] LOOP
    IF NOT public._rlstest_seed('employees', 'p5-' || nm,
         jsonb_build_object('status', 'Active', 'department', 'P5Test', 'firstName', 'P5' || nm, 'lastName', 'Tester')) THEN
      RAISE EXCEPTION 'FAIL: could not seed an employee (%)', current_setting('rlstest.last_err', true);
    END IF;
  END LOOP;
  IF NOT public._rlstest_seed('employees', 'p5-U',
       jsonb_build_object('status', 'Active', 'department', 'P5Test', 'firstName', 'UAT Tester', 'lastName', 'Five')) THEN
    RAISE EXCEPTION 'FAIL: could not seed the UAT employee (%)', current_setting('rlstest.last_err', true);
  END IF;
  empO := public._rlstest_id('employees', 'p5-O'); empP := public._rlstest_id('employees', 'p5-P');
  empQ := public._rlstest_id('employees', 'p5-Q'); empR := public._rlstest_id('employees', 'p5-R');
  empU := public._rlstest_id('employees', 'p5-U'); empReal := public._rlstest_id('employees', 'p5-Real');

  SELECT id INTO annual FROM public.leave_types WHERE name = 'Annual';
  SELECT id INTO sick FROM public.leave_types WHERE name = 'Sick';
  UPDATE public.leave_types SET days_per_year = 28, max_carry_forward = 5 WHERE id = annual;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('hr-documents', 'p5test/probe.pdf');
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'FAIL: this test issues letters, which needs the postgres role to write storage.objects.';
  END;

  -- ── A. The module switch: Admin only ─────────────────────────────────────
  SELECT hr_modules INTO saved_modules FROM public.app_settings WHERE id = true;
  FOREACH nm IN ARRAY ARRAY['stf', 'fin', 'hr'] LOOP
    res := public._lt_as((u ->> nm)::uuid, 'SELECT public.set_hr_modules(ARRAY[''audit''])');
    INSERT INTO rls_results VALUES (nm, 'set_hr_modules', 'changes the module switch', false, res LIKE 'ok:%');
    res := public._lt_as((u ->> nm)::uuid, 'UPDATE public.app_settings SET hr_modules = ARRAY[''audit''] WHERE id = true');
    INSERT INTO rls_results VALUES (nm, 'app_settings', 'edits hr_modules directly', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> nm)::uuid, 'UPDATE public.app_settings SET hr_go_live_at = now() WHERE id = true');
    INSERT INTO rls_results VALUES (nm, 'app_settings', 'sets the go-live date', false, res LIKE 'ok:%' AND res <> 'ok:0');
  END LOOP;
  res := public._lt_as(adm, 'SELECT public.set_hr_modules(ARRAY[''leave'', ''audit'', ''leave''])');
  INSERT INTO rls_results VALUES ('adm', 'set_hr_modules', 'Admin switches modules (sorted, no duplicates)', true,
    res LIKE 'ok:%' AND (SELECT hr_modules FROM public.app_settings WHERE id = true) = ARRAY['audit', 'leave']);
  INSERT INTO rls_results VALUES ('adm', 'audit_log', 'the switch change is in the Audit Trail', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'app_settings.hr_modules' AND actor_id = adm));
  res := public._lt_as(adm, 'SELECT public.set_hr_modules(ARRAY[''payroll''])');
  INSERT INTO rls_results VALUES ('adm', 'set_hr_modules', 'an unknown module', false, res LIKE 'ok:%');
  UPDATE public.app_settings SET hr_modules = saved_modules WHERE id = true;

  -- ── B. Opening balances ──────────────────────────────────────────────────
  FOREACH nm IN ARRAY ARRAY['stf', 'fin'] LOOP
    res := public._lt_as((u ->> nm)::uuid, format('SELECT public.set_opening_leave_taken(%L, %L, %s, 5)', empO, annual, yr));
    INSERT INTO rls_results VALUES (nm, 'set_opening_leave_taken', 'enters an opening balance', false, res LIKE 'ok:%');
  END LOOP;
  res := public._lt_as(hr, format('SELECT public.set_opening_leave_taken(%L, %L, %s, 5)', empO, annual, yr));
  INSERT INTO rls_results VALUES ('hr', 'set_opening_leave_taken', 'HR enters 5 days for the go-live year', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.leave_balances WHERE employee_id = empO AND leave_type_id = annual AND year = yr
                                AND opening_taken = 5 AND taken = 0));
  res := public._lt_as(hr, format('SELECT public.set_opening_leave_taken(%L, %L, %s, 5)', empO, annual, yr - 1));
  INSERT INTO rls_results VALUES ('hr', 'set_opening_leave_taken', 'for another year', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.set_opening_leave_taken(%L, %L, %s, 2.3)', empO, annual, yr));
  INSERT INTO rls_results VALUES ('hr', 'set_opening_leave_taken', 'a figure that is not whole or half days', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.set_opening_leave_taken(%L, %L, %s, 29)', empO, annual, yr));
  INSERT INTO rls_results VALUES ('hr', 'set_opening_leave_taken', 'more than the entitlement', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('UPDATE public.leave_balances SET opening_taken = 1 WHERE employee_id = %L AND leave_type_id = %L', empO, annual));
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'edits the opening figure directly', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as(hr, format('UPDATE public.leave_balances SET entitled = 28 WHERE employee_id = %L AND leave_type_id = %L', empO, annual));
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'other balance edits still work', true, res = 'ok:1');

  -- Remaining = 28 - 26 = 2: a request of 3+ working days is refused.
  res := public._lt_as(hr, format('SELECT public.set_opening_leave_taken(%L, %L, %s, 26)', empO, annual, yr));
  res := public._lt_as(hr, format('INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)',
    empO, annual, make_date(yr, 11, 2), make_date(yr, 11, 12)));
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'a request beyond what is left after the opening figure', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'the refusal says not enough leave', true, res LIKE '%Not enough Annual leave%');

  -- Next year carries over what is left after the opening figure (2, under the limit of 5).
  res := public._lt_as(hr, format('SELECT public.open_leave_year(%s)', yr + 1));
  INSERT INTO rls_results VALUES ('hr', 'open_leave_year', 'carry-forward counts leave taken before go-live', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.leave_balances WHERE employee_id = empO AND leave_type_id = annual
                                AND year = yr + 1 AND carried_forward = 2));

  -- ── C. Importing opening balances: all or nothing ────────────────────────
  res := public._lt_as(stf, format('SELECT public.import_opening_leave(%L)',
    jsonb_build_array(jsonb_build_object('employee_id', empP, 'leave_type', 'Annual', 'year', yr, 'taken_before_go_live', 3))));
  INSERT INTO rls_results VALUES ('stf', 'import_opening_leave', 'staff imports', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.import_opening_leave(%L)', jsonb_build_array(
    jsonb_build_object('employee_id', empP, 'leave_type', 'annual', 'year', yr, 'taken_before_go_live', 3),
    jsonb_build_object('employee_id', empP, 'leave_type', 'Holiday', 'year', yr, 'taken_before_go_live', 1))));
  INSERT INTO rls_results VALUES ('hr', 'import_opening_leave', 'one bad row: refused, naming the row, nothing imported', true,
    res LIKE 'err:%Row 2%unknown leave type%'
    AND NOT EXISTS (SELECT 1 FROM public.leave_balances WHERE employee_id = empP AND opening_taken > 0));
  res := public._lt_as(hr, format('SELECT public.import_opening_leave(%L)', jsonb_build_array(
    jsonb_build_object('employee_id', empP, 'leave_type', 'annual', 'year', yr, 'taken_before_go_live', 3),
    jsonb_build_object('employee_id', empP, 'leave_type', 'Sick', 'year', yr, 'taken_before_go_live', 1.5))));
  INSERT INTO rls_results VALUES ('hr', 'import_opening_leave', 'a good file imports every row', true,
    res LIKE 'ok:%'
    AND EXISTS (SELECT 1 FROM public.leave_balances WHERE employee_id = empP AND leave_type_id = annual AND year = yr AND opening_taken = 3)
    AND EXISTS (SELECT 1 FROM public.leave_balances WHERE employee_id = empP AND leave_type_id = sick AND year = yr AND opening_taken = 1.5)
    AND EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'import.opening_leave' AND actor_id = hr));
  SELECT jsonb_agg(jsonb_build_object('employee_id', empP, 'leave_type', 'Annual', 'year', yr, 'taken_before_go_live', 0))
    INTO big FROM generate_series(1, 501);
  res := public._lt_as(hr, format('SELECT public.import_opening_leave(%L)', big));
  INSERT INTO rls_results VALUES ('hr', 'import_opening_leave', 'more than 500 rows', false, res LIKE 'ok:%');

  -- ── D. Importing existing contracts: all or nothing ──────────────────────
  res := public._lt_as(fin, format('SELECT public.import_legacy_contracts(%L)', jsonb_build_array(
    jsonb_build_object('employee_id', empQ, 'contract_type', 'permanent', 'start_date', '2024-01-01', 'position', 'Cook'))));
  INSERT INTO rls_results VALUES ('fin', 'import_legacy_contracts', 'finance imports', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.import_legacy_contracts(%L)', jsonb_build_array(
    jsonb_build_object('employee_id', empQ, 'contract_type', 'permanent', 'start_date', '2024-01-01', 'position', 'Cook'),
    jsonb_build_object('employee_id', empR, 'contract_type', 'fixed_term', 'start_date', '2024-01-01', 'position', 'Waiter'))));
  INSERT INTO rls_results VALUES ('hr', 'import_legacy_contracts', 'fixed term without an end date: refused, nothing imported', true,
    res LIKE 'err:%Row 2%end date%'
    AND NOT EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id IN (empQ, empR)));
  res := public._lt_as(hr, format('SELECT public.import_legacy_contracts(%L)', jsonb_build_array(
    jsonb_build_object('employee_id', empQ, 'contract_type', 'permanent', 'start_date', '2024-01-01', 'position', 'Cook', 'salary', '800000', 'notice_days', '30'),
    jsonb_build_object('employee_id', empR, 'contract_type', 'fixed_term', 'start_date', '2024-01-01', 'end_date', (today - 10)::text, 'position', 'Waiter'))));
  INSERT INTO rls_results VALUES ('hr', 'import_legacy_contracts', 'a good file: current contract active, ended one expired', true,
    res LIKE 'ok:%'
    AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = empQ AND status = 'active' AND source = 'legacy' AND salary = 800000)
    AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = empR AND status = 'expired' AND source = 'legacy')
    AND EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'import.legacy_contracts' AND actor_id = hr));
  res := public._lt_as(hr, format('SELECT public.import_legacy_contracts(%L)', jsonb_build_array(
    jsonb_build_object('employee_id', empQ, 'contract_type', 'permanent', 'start_date', '2025-01-01', 'position', 'Cook'))));
  INSERT INTO rls_results VALUES ('hr', 'import_legacy_contracts', 'a second active contract', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'import_legacy_contracts', 'the refusal names the reason', true, res LIKE '%already has an active contract%');

  -- ── E. UAT cleanup ───────────────────────────────────────────────────────
  -- Final general-letter wording, so letters can be issued in this test.
  res := public._lt_as(hr, format('SELECT public.save_hr_template_version(%L, %L, %L)', 'general_letter', 'General letter', 'Dear {{employee.fullName}}, {{{body}}}'));
  -- A real letter, then a UAT letter (the higher number).
  dReal := public._p5_draft(hr, 'general_letter', empReal, NULL, 'P5-real-letter', '{"body": "real"}');
  res := public._p5_issue(dReal, hr, adm);
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'a real letter is issued (' || res || ')', true, res LIKE 'ok:%');
  dUat := public._p5_draft(hr, 'general_letter', empU, NULL, 'P5-uat-letter', '{"body": "test"}');
  res := public._p5_issue(dUat, hr, adm);
  SELECT ref_no INTO real_ref FROM public.hr_documents WHERE id = dReal;
  SELECT ref_no INTO uat_ref FROM public.hr_documents WHERE id = dUat;
  -- The highest number a real letter of that type and year holds after the cleanup.
  SELECT max(substring(ref_no FROM '[0-9]+$')::int) INTO real_seq FROM public.hr_documents
   WHERE doc_type = 'general_letter' AND ref_no LIKE substring(real_ref FROM '^.*/') || '%'
     AND id <> dUat AND NOT public.is_uat_employee(coalesce(employee_id, ''));
  -- Approved leave for both (with attendance), a UAT login and a notification.
  res := public._lt_as(hr, format('INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)', empU, annual, '2030-03-04', '2030-03-05'));
  res := public._lt_as(hr, format('INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)', empReal, annual, '2030-03-04', '2030-03-05'));
  SELECT id INTO lUat FROM public.leave_requests WHERE employee_id = empU;
  SELECT id INTO lReal FROM public.leave_requests WHERE employee_id = empReal;
  res := public._lt_as(adm, format('SELECT public.review_leave_request(%L, %L)', lUat, 'approved'));
  res := public._lt_as(adm, format('SELECT public.review_leave_request(%L, %L)', lReal, 'approved'));
  INSERT INTO auth.users (id, email, aud, role) VALUES (uat_login, 'p5test+uat-staff@p5test.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.staff_users (id, email, role, is_active, employee_id) VALUES (uat_login, 'p5test+uat-staff@p5test.local', 'staff', true, empU)
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.notify_user(uat_login, 'p5test', 'Test notice', NULL, NULL);
  INSERT INTO public.employment_contracts (employee_id, contract_type, start_date, end_date, position, status, source)
  VALUES (empU, 'fixed_term', today - 300, today + 20, 'Cook', 'active', 'legacy');

  res := public._lt_as(hr, 'SELECT public.cleanup_uat_data(true)');
  INSERT INTO rls_results VALUES ('hr', 'cleanup_uat_data', 'a signed-in user runs the cleanup', false, res LIKE 'ok:%');

  j := public.cleanup_uat_data(true);
  INSERT INTO rls_results VALUES ('system', 'cleanup_uat_data', 'the dry run finds the UAT employee and login, and removes nothing', true,
    (j -> 'employees') @> jsonb_build_array(jsonb_build_object('id', empU))
    AND (j -> 'logins') @> to_jsonb(ARRAY['p5test+uat-staff@p5test.local'])
    AND NOT ((j -> 'employees') @> jsonb_build_array(jsonb_build_object('id', empReal)))
    AND EXISTS (SELECT 1 FROM public.employees WHERE id = empU)
    AND EXISTS (SELECT 1 FROM public.hr_documents WHERE id = dUat));

  j := public.cleanup_uat_data(false);
  INSERT INTO rls_results VALUES ('system', 'cleanup_uat_data', 'test data is gone: employee, issued letter, approved leave, attendance, contract, login, notification', true,
    NOT EXISTS (SELECT 1 FROM public.employees WHERE id = empU)
    AND NOT EXISTS (SELECT 1 FROM public.hr_documents WHERE id = dUat)
    AND NOT EXISTS (SELECT 1 FROM public.leave_requests WHERE id = lUat)
    AND NOT EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = empU)
    AND NOT EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = empU)
    AND NOT EXISTS (SELECT 1 FROM public.staff_users WHERE id = uat_login)
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uat_login)
    AND NOT EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = uat_login));
  INSERT INTO rls_results VALUES ('system', 'cleanup_uat_data', 'real data is untouched', true,
    EXISTS (SELECT 1 FROM public.employees WHERE id = empReal)
    AND EXISTS (SELECT 1 FROM public.hr_documents WHERE id = dReal AND status = 'issued')
    AND EXISTS (SELECT 1 FROM public.leave_requests WHERE id = lReal AND status = 'approved')
    AND EXISTS (SELECT 1 FROM public.attendance WHERE leave_request_id = lReal)
    AND EXISTS (SELECT 1 FROM public.staff_users WHERE id = hr));
  INSERT INTO rls_results VALUES ('system', 'hr_document_counters', 'the counter goes back to the highest real number', true,
    uat_ref IS NOT NULL AND EXISTS (SELECT 1 FROM public.hr_document_counters
            WHERE doc_type = 'general_letter' AND year = split_part(real_ref, '/', 4)::int AND last_value = real_seq));
  INSERT INTO rls_results VALUES ('system', 'audit_log', 'one uat.cleanup event with the counts; earlier audit entries kept', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'uat.cleanup' AND (metadata -> 'removed' ->> 'employees')::int >= 1)
    AND EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'hr_documents' AND record_id = dUat::text));

  -- ── Verdict (always an exception, so everything above is rolled back) ────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed. Failures: % %', failures, checks,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': expected ' || expected || ' got ' || actual, E'
' ORDER BY tbl, who, op) FROM rls_results WHERE expected IS DISTINCT FROM actual),
      array_to_string(notes, '; ');
  END IF;
  RAISE EXCEPTION 'PASS: all % go-live checks passed. % This error is intentional: it rolls everything back.', checks, array_to_string(notes, '; ');
END
$test$;
