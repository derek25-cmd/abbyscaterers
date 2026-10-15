-- Phase 6 tests: employees who have left are frozen, deleting employees only
-- without history, and approving HR letters from the admin portal.
--
-- Runs on the main database until go-live (it refuses afterwards), after all
-- migrations through 20261015000100. Same harness as the other files: ONE
-- statement that ALWAYS ends in an exception starting with PASS: or FAIL:,
-- which rolls back everything it did.
-- Portal users are simulated with a Clerk-style JWT (sub = a text id, not a uuid).

DO $test$
DECLARE
  people constant text[] := ARRAY['hr', 'adm', 'fin', 'stf'];
  roles_ constant jsonb := '{"hr": "hr_manager", "adm": "admin", "fin": "finance", "stf": "staff"}';
  u jsonb := '{}'::jsonb;
  hr uuid; adm uuid; fin uuid; stf uuid;
  nm text; uid uuid; res text; n integer; ok boolean; j jsonb;
  today date := public.hr_today();
  empF text; empD text; empH text; empW text; empL text;
  annual uuid;
  dGen uuid; dGen2 uuid; dWarn uuid; dLeft uuid;
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
    CREATE FUNCTION public._p6_draft(author uuid, doc_type text, emp text, cand uuid, subject text, data jsonb) RETURNS uuid LANGUAGE plpgsql AS $f$
    DECLARE res text; d uuid;
    BEGIN
      res := public._lt_as(author, format(
        'INSERT INTO public.hr_documents (doc_type, employee_id, candidate_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L, %L)',
        doc_type, emp, cand,
        (SELECT id FROM public.hr_document_templates WHERE hr_document_templates.doc_type = _p6_draft.doc_type AND is_active),
        subject, data));
      IF res NOT LIKE 'ok:%' THEN RAISE EXCEPTION 'FAIL: could not write the % draft "%": %', doc_type, subject, res; END IF;
      SELECT id INTO d FROM public.hr_documents WHERE hr_documents.subject = _p6_draft.subject;
      RETURN d;
    END $f$;
  $mk$;

  -- Run one statement as an admin-portal (Clerk) user.
  EXECUTE $mk$
    CREATE FUNCTION public._lt_portal(sub text, stmt text) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE n integer; m text; res text;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated')::text, true);
      PERFORM set_config('request.jwt.claim.sub', sub, true);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE stmt;
        GET DIAGNOSTICS n = ROW_COUNT;
        res := 'ok:' || n;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS m = MESSAGE_TEXT;
        res := 'err:' || SQLSTATE || ':' || coalesce(m, '');
      END;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      RETURN res;
    END $f$;
  $mk$;

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  FOREACH nm IN ARRAY people LOOP
    uid := md5('p6test-user-' || nm)::uuid;
    u := u || jsonb_build_object(nm, uid);
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, nm || '@p6test.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_users (id, email, role, is_active)
    VALUES (uid, nm || '@p6test.local', roles_ ->> nm, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  END LOOP;
  hr := (u ->> 'hr')::uuid; adm := (u ->> 'adm')::uuid; fin := (u ->> 'fin')::uuid; stf := (u ->> 'stf')::uuid;

  -- Admin-portal users: management, operations, and management with the same
  -- email as the HR author (the same person in both systems).
  INSERT INTO public.portal_users (id, email, full_name, role, is_active) VALUES
    ('user_p6_mgmt', 'mgmt@p6test.local', 'Grace Manager', 'management', true),
    ('user_p6_ops', 'ops@p6test.local', 'Omari Ops', 'operations', true),
    ('user_p6_same', 'hr@p6test.local', 'Same Person', 'management', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true, email = EXCLUDED.email;

  -- F: will leave. D: no history. H: has attendance. W: letters. L: leaves with a letter pending.
  FOREACH nm IN ARRAY ARRAY['F', 'D', 'H', 'W', 'L'] LOOP
    IF NOT public._rlstest_seed('employees', 'p6-' || nm,
         jsonb_build_object('status', 'Active', 'department', 'P6Test', 'firstName', 'P6' || nm, 'lastName', 'Tester')) THEN
      RAISE EXCEPTION 'FAIL: could not seed an employee (%)', current_setting('rlstest.last_err', true);
    END IF;
  END LOOP;
  empF := public._rlstest_id('employees', 'p6-F'); empD := public._rlstest_id('employees', 'p6-D');
  empH := public._rlstest_id('employees', 'p6-H'); empW := public._rlstest_id('employees', 'p6-W');
  empL := public._rlstest_id('employees', 'p6-L');
  SELECT id INTO annual FROM public.leave_types WHERE name = 'Annual';

  -- Final wording, so letters can go forward in this test.
  FOREACH nm IN ARRAY ARRAY['general_letter', 'warning'] LOOP
    res := public._lt_as(hr, format('SELECT public.save_hr_template_version(%L, %L, %L)', nm, 'P6 ' || nm, 'Final wording for {{doc.subject}}.'));
  END LOOP;

  -- ── A. Someone who has left is frozen ────────────────────────────────────
  res := public._lt_as(hr, format('SELECT public.end_employment_without_letter(%L, %L, %L)', empF, today, 'Left for another job'));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'F ends employment', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.employees WHERE id = empF AND status = 'Inactive'));

  res := public._lt_as(hr, format('UPDATE public.employees SET role = %L WHERE id = %L', 'Changed', empF));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'edits the record of someone who has left', false, res LIKE 'ok:%' AND res <> 'ok:0');
  INSERT INTO rls_results VALUES ('hr', 'employees', 'the refusal says to reactivate', true, res LIKE '%reactivate%');
  res := public._lt_as(hr, format('INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)', empF, annual, '2030-03-04', '2030-03-05'));
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'leave for someone who has left', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('INSERT INTO public.attendance (employee_id, employee, date, status) VALUES (%L, %L, %L, %L)', empF, 'P6F Tester', today, 'Present'));
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'attendance for someone who has left', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L)',
    'general_letter', empF, (SELECT id FROM public.hr_document_templates WHERE doc_type = 'general_letter' AND is_active), 'P6-left-letter', '{"body": "x"}'));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'a letter for someone who has left', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.record_legacy_contract(%L, %L, %L, %L, %L, NULL, NULL, NULL, %L)', empF, 'fixed_term', '2024-01-01', '2024-12-31', 'Cook', 'expired'));
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'a contract for someone who has left', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.set_opening_leave_taken(%L, %L, %s, 1)', empF, annual, public.hr_go_live_year()));
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'an opening balance for someone who has left', false, res LIKE 'ok:%');
  res := public._lt_as(fin, public._rlstest_insert_sql('payroll', 'p6-pay', public._rlstest_fk_ov('payroll', 'p6-pay') || jsonb_build_object('employeeId', empF)));
  INSERT INTO rls_results VALUES ('fin', 'payroll', 'a payslip for someone who has left', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('fin', 'payroll', 'the payslip refusal is the freeze, not something else', true, res LIKE '%has left%');

  res := public._lt_as(hr, format('UPDATE public.employees SET status = %L WHERE id = %L', 'Active', empF));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'reactivating (re-hire) is allowed and clears the end date', true,
    res = 'ok:1' AND EXISTS (SELECT 1 FROM public.employees WHERE id = empF AND status = 'Active' AND "employmentEndDate" IS NULL));
  res := public._lt_as(hr, format('UPDATE public.employees SET role = %L WHERE id = %L', 'Head Cook', empF));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'after reactivating, the record can be edited again', true, res = 'ok:1');

  -- ── B. Deleting employees ────────────────────────────────────────────────
  res := public._lt_as(hr, format('DELETE FROM public.employees WHERE id = %L', empD));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'deletes an employee directly', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as(stf, format('SELECT public.delete_employee(%L)', empD));
  INSERT INTO rls_results VALUES ('stf', 'delete_employee', 'staff deletes an employee', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.delete_employee(%L)', empD));
  INSERT INTO rls_results VALUES ('hr', 'delete_employee', 'deletes an employee with no history', true,
    res LIKE 'ok:%' AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id = empD)
    AND EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'employees' AND record_id = empD AND action = 'employees.delete'));

  IF NOT public._rlstest_seed('attendance', 'p6-H-day', jsonb_build_object('employee_id', empH, 'date', (today - 1)::text, 'status', 'Present')) THEN
    RAISE EXCEPTION 'FAIL: could not seed an attendance row (%)', current_setting('rlstest.last_err', true);
  END IF;
  res := public._lt_as(hr, format('SELECT * FROM public.employee_history(%L)', empH));
  INSERT INTO rls_results VALUES ('hr', 'employee_history', 'lists what is recorded', true, res = 'ok:1');
  res := public._lt_as(hr, format('SELECT public.delete_employee(%L)', empH));
  INSERT INTO rls_results VALUES ('hr', 'delete_employee', 'deletes an employee who has attendance', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'delete_employee', 'the refusal says what is attached; nothing was removed', true,
    res LIKE '%attendance day(s)%' AND EXISTS (SELECT 1 FROM public.employees WHERE id = empH)
    AND EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = empH));

  -- ── C. Approving letters in the admin portal ─────────────────────────────
  -- HR writes a letter; the HR system saves the preview, then sends it.
  dGen := public._p6_draft(hr, 'general_letter', empW, NULL, 'P6-general', '{"body": "Hello"}');
  res := public._lt_as(hr, format('UPDATE public.hr_documents SET preview = %L WHERE id = %L',
    '{"v": 1, "date": "15 October 2026", "subject": "P6-general", "addressee": ["P6W Tester"], "paragraphs": [[{"text": "Hello", "bold": false}]], "confidential": false}', dGen));
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dGen));
  INSERT INTO rls_results VALUES ('hr', 'submit_hr_document', 'HR sends the letter', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('portal', 'portal_notifications', 'portal management is told a letter is waiting; operations is not', true,
    EXISTS (SELECT 1 FROM public.portal_notifications WHERE portal_user_id = 'user_p6_mgmt' AND type = 'hr_letter_submitted')
    AND NOT EXISTS (SELECT 1 FROM public.portal_notifications WHERE portal_user_id = 'user_p6_ops' AND type = 'hr_letter_submitted'));
  res := public._lt_as(hr, format('UPDATE public.hr_documents SET preview = %L WHERE id = %L', '{"v": 1, "subject": "changed"}', dGen));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'changes the preview after sending', false, res LIKE 'ok:%' AND res <> 'ok:0');

  res := public._lt_portal('user_p6_ops', 'SELECT * FROM public.portal_pending_hr_documents()');
  INSERT INTO rls_results VALUES ('portal ops', 'portal_pending_hr_documents', 'operations sees letters', false, res LIKE 'ok:%');
  res := public._lt_portal('user_p6_ops', format('SELECT public.portal_approve_hr_document(%L)', dGen));
  INSERT INTO rls_results VALUES ('portal ops', 'portal_approve_hr_document', 'operations approves', false, res LIKE 'ok:%');
  res := public._lt_as(stf, format('SELECT public.portal_approve_hr_document(%L)', dGen));
  INSERT INTO rls_results VALUES ('stf', 'portal_approve_hr_document', 'an HR-system staff login uses the portal function', false, res LIKE 'ok:%');
  res := public._lt_portal('user_p6_mgmt', format('SELECT * FROM public.portal_pending_hr_documents() WHERE id = %L AND preview IS NOT NULL', dGen));
  INSERT INTO rls_results VALUES ('portal mgmt', 'portal_pending_hr_documents', 'management sees the letter with its preview', true, res = 'ok:1');
  res := public._lt_portal('user_p6_mgmt', format('SELECT public.portal_approve_hr_document(%L)', dGen));
  INSERT INTO rls_results VALUES ('portal mgmt', 'portal_approve_hr_document', 'management approves', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.hr_documents WHERE id = dGen AND status = 'approved'
                                AND approved_by_portal = 'user_p6_mgmt' AND approved_at IS NOT NULL AND signatory_name = 'Grace Manager'));
  INSERT INTO rls_results VALUES ('portal mgmt', 'hr_notifications', 'the author is told, and the approval is in the Audit Trail', true,
    EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = hr AND type = 'hr_document_approved' AND body LIKE '%admin portal%')
    AND EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'hr_documents.portal_approve' AND record_id = dGen::text AND metadata ->> 'email' = 'mgmt@p6test.local'));

  -- Return for changes
  dGen2 := public._p6_draft(hr, 'general_letter', empW, NULL, 'P6-general-2', '{"body": "Hello again"}');
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dGen2));
  res := public._lt_portal('user_p6_mgmt', format('SELECT public.portal_return_hr_document(%L, %L)', dGen2, ' '));
  INSERT INTO rls_results VALUES ('portal mgmt', 'portal_return_hr_document', 'returns without saying why', false, res LIKE 'ok:%');
  res := public._lt_portal('user_p6_mgmt', format('SELECT public.portal_return_hr_document(%L, %L)', dGen2, 'Please add the start date.'));
  INSERT INTO rls_results VALUES ('portal mgmt', 'portal_return_hr_document', 'returns with a note: back to draft, author told', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.hr_documents WHERE id = dGen2 AND status = 'draft' AND return_note = 'Please add the start date.')
    AND EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = hr AND type = 'hr_document_returned'));

  -- Someone else must approve a warning: also across the two systems (same email = same person).
  dWarn := public._p6_draft(hr, 'warning', empW, NULL, 'P6-warning', jsonb_build_object(
    'level', 'first_written', 'offenceCategory', 'Lateness', 'incidentDate', (today - 2)::text, 'description', 'Late twice'));
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dWarn));
  res := public._lt_portal('user_p6_same', format('SELECT public.portal_approve_hr_document(%L)', dWarn));
  INSERT INTO rls_results VALUES ('portal same', 'portal_approve_hr_document', 'the author approves their own warning in the portal', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('portal same', 'portal_approve_hr_document', 'the refusal says someone else must approve', true, res LIKE '%someone other%');
  res := public._lt_portal('user_p6_same', format('SELECT written_by_me FROM public.portal_pending_hr_documents() WHERE id = %L AND written_by_me', dWarn));
  INSERT INTO rls_results VALUES ('portal same', 'portal_pending_hr_documents', 'the list marks it "written by you"', true, res = 'ok:1');
  res := public._lt_portal('user_p6_mgmt', format('SELECT public.portal_approve_hr_document(%L)', dWarn));
  INSERT INTO rls_results VALUES ('portal mgmt', 'portal_approve_hr_document', 'another person approves the warning', true, res LIKE 'ok:%');

  -- A letter waiting when the person leaves cannot be approved any more.
  dLeft := public._p6_draft(hr, 'general_letter', empL, NULL, 'P6-left-pending', '{"body": "x"}');
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dLeft));
  res := public._lt_as(hr, format('SELECT public.end_employment_without_letter(%L, %L, %L)', empL, today, 'Left'));
  res := public._lt_portal('user_p6_mgmt', format('SELECT public.portal_approve_hr_document(%L)', dLeft));
  INSERT INTO rls_results VALUES ('portal mgmt', 'portal_approve_hr_document', 'approves a letter for someone who has since left', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.void_hr_document(%L, %L)', dLeft, 'Person has left'));
  INSERT INTO rls_results VALUES ('hr', 'void_hr_document', 'that letter can still be voided', true, res LIKE 'ok:%');

  -- ── Verdict (always an exception, so everything above is rolled back) ────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed. Failures: % %', failures, checks,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': expected ' || expected || ' got ' || actual, E'
' ORDER BY tbl, who, op) FROM rls_results WHERE expected IS DISTINCT FROM actual),
      array_to_string(notes, '; ');
  END IF;
  RAISE EXCEPTION 'PASS: all % Phase 6 checks passed. % This error is intentional: it rolls everything back.', checks, array_to_string(notes, '; ');
END
$test$;
