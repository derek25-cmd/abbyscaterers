-- HR letter types tests (Phase 4): who can see the new records, what issuing
-- each letter does (exactly once), the contract chain, contract-expiry
-- reminders, ending employment (with and without a letter, including leave),
-- the different-approver rule, and that DRAFT template wording is never issued.
--
-- RUN AGAINST A LOCAL OR STAGING DATABASE ONLY, never production, after all
-- migrations through 20261016000000 are applied. Same harness as the other
-- files in this folder: ONE statement that works with the hosted `postgres`
-- role and ALWAYS ends in an exception that starts with PASS: or FAIL:, which
-- rolls back everything it created (including template versions it saves).
--
-- It acts as: hr (hr_manager), adm (admin), fin (finance), stf (plain staff).
-- Issuing saves the letter's final text; nothing is stored as a file
-- (20261016000000).

DO $test$
DECLARE
  people constant text[] := ARRAY['hr', 'adm', 'fin', 'stf'];
  roles_ constant jsonb := '{"hr": "hr_manager", "adm": "admin", "fin": "finance", "stf": "staff"}';
  sha constant text := 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  ref_re constant text := '^ALC/HR/[A-Z]{3}/[0-9]{4}/[0-9]{4,}$';
  u jsonb := '{}'::jsonb;
  hr uuid; adm uuid; fin uuid; stf uuid;
  nm text; uid uuid; res text; n integer; v numeric; ok boolean;
  today date := public.hr_today();
  empC text; empT text; empW text; empX text; empK text;
  cand1 uuid; cand2 uuid;
  dOffer uuid; dOffer2 uuid; dCon uuid; dCon2 uuid; dExt uuid; dWarn uuid; dRec uuid; dTerm uuid; dCert uuid; dCert2 uuid;
  kC uuid; kChild uuid; kT uuid; wRec uuid; rRec uuid;
  drow public.hr_documents%ROWTYPE;
  annual uuid; L1 uuid; L2 uuid; L3 uuid;
  payroll_id text;
  draft_tpl uuid;
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
    CREATE FUNCTION public._p4_draft(author uuid, doc_type text, emp text, cand uuid, subject text, data jsonb) RETURNS uuid LANGUAGE plpgsql AS $f$
    DECLARE res text; d uuid;
    BEGIN
      res := public._lt_as(author, format(
        'INSERT INTO public.hr_documents (doc_type, employee_id, candidate_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L, %L)',
        doc_type, emp, cand,
        (SELECT id FROM public.hr_document_templates WHERE hr_document_templates.doc_type = _p4_draft.doc_type AND is_active),
        subject, data));
      IF res NOT LIKE 'ok:%' THEN RAISE EXCEPTION 'FAIL: could not write the % draft "%": %', doc_type, subject, res; END IF;
      SELECT id INTO d FROM public.hr_documents WHERE hr_documents.subject = _p4_draft.subject;
      RETURN d;
    END $f$;
  $mk$;
  -- Submit (author), approve (approver), check, reserve, store the file, issue.
  -- Returns 'ok:...' or the first refusal, prefixed with the step.
  EXECUTE $mk$
    CREATE FUNCTION public._p4_issue(d uuid, author uuid, approver uuid) RETURNS text LANGUAGE plpgsql AS $f$
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
      -- The final text (20261016000000: letters are exported, not stored).
      res := public._lt_as(author, format('SELECT public.issue_hr_document(%L, %L)', d, jsonb_build_object(
        'v', 1, 'ref_no', r.ref_no, 'date', '16 October 2026', 'addressee', jsonb_build_array('Test person'), 'subject', r.subject,
        'paragraphs', jsonb_build_array(jsonb_build_array(jsonb_build_object('text', 'Final text.', 'bold', false))),
        'signatory', jsonb_build_object('name', coalesce(r.signatory_name, 'Test Signer'), 'title', coalesce(r.signatory_title, 'HR Manager')),
        'confidential', r.confidential)));
      IF res NOT LIKE 'ok:%' THEN RETURN 'issue ' || res; END IF;
      RETURN res;
    END $f$;
  $mk$;

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  FOREACH nm IN ARRAY people LOOP
    uid := md5('p4test-user-' || nm)::uuid;
    u := u || jsonb_build_object(nm, uid);
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, nm || '@p4test.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_users (id, email, role, is_active)
    VALUES (uid, nm || '@p4test.local', roles_ ->> nm, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  END LOOP;
  hr := (u ->> 'hr')::uuid; adm := (u ->> 'adm')::uuid; fin := (u ->> 'fin')::uuid; stf := (u ->> 'stf')::uuid;

  -- C: contracts and extension. T: termination. W: warning and recognition.
  -- X: end without a letter. K: the employee an accepted candidate becomes.
  FOREACH nm IN ARRAY ARRAY['C', 'T', 'W', 'X', 'K'] LOOP
    IF NOT public._rlstest_seed('employees', 'p4-' || nm,
         jsonb_build_object('status', 'Active', 'department', 'P4Test', 'firstName', 'P4' || nm, 'lastName', 'Tester')) THEN
      RAISE EXCEPTION 'FAIL: could not seed an employee (%)', current_setting('rlstest.last_err', true);
    END IF;
  END LOOP;
  empC := public._rlstest_id('employees', 'p4-C');
  empT := public._rlstest_id('employees', 'p4-T');
  empW := public._rlstest_id('employees', 'p4-W');
  empX := public._rlstest_id('employees', 'p4-X');
  empK := public._rlstest_id('employees', 'p4-K');


  -- ── A. DRAFT template wording can never be issued ────────────────────────
  res := public._lt_as(hr, format('SELECT public.save_hr_template_version(%L, %L, %L)', 'warning', 'Warning letter',
    '**' || public.hr_doc_draft_marker() || '**' || E'\n\nDear {{employee.fullName}}'));
  SELECT id INTO draft_tpl FROM public.hr_document_templates WHERE doc_type = 'warning' AND is_active;
  dWarn := public._p4_draft(hr, 'warning', empW, NULL, 'P4-warning', jsonb_build_object(
    'level', 'final_written', 'offenceCategory', 'Lateness', 'incidentDate', (today - 5)::text, 'description', 'Late three times'));
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dWarn));
  INSERT INTO rls_results VALUES ('hr', 'submit_hr_document', 'sends a letter written from DRAFT wording', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'submit_hr_document', 'the refusal names the DRAFT template', true, res LIKE '%DRAFT template%');
  res := public._lt_as(hr, format('SELECT public.validate_hr_document(%L)', dWarn));
  INSERT INTO rls_results VALUES ('hr', 'validate_hr_document', 'the issue check refuses DRAFT wording too', false, res LIKE 'ok:%');

  -- Final wording for every letter type (HR Manager's job in real life).
  FOREACH nm IN ARRAY ARRAY['offer', 'contract', 'extension', 'termination', 'warning', 'recognition', 'certificate_of_service'] LOOP
    res := public._lt_as(hr, format('SELECT public.save_hr_template_version(%L, %L, %L)', nm, 'P4 ' || nm, 'Final wording for {{doc.subject}}.'));
    IF res NOT LIKE 'ok:%' THEN RAISE EXCEPTION 'FAIL: could not save the % template: %', nm, res; END IF;
  END LOOP;

  -- "Update to latest" on the draft: the recorded version follows the template.
  res := public._lt_as(hr, format('UPDATE public.hr_documents SET template_id = %L WHERE id = %L',
    (SELECT id FROM public.hr_document_templates WHERE doc_type = 'warning' AND is_active), dWarn));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'a draft moves to the latest template, version recorded', true,
    res = 'ok:1' AND EXISTS (SELECT 1 FROM public.hr_documents d JOIN public.hr_document_templates t ON t.id = d.template_id
                              WHERE d.id = dWarn AND t.is_active AND d.template_version = t.version AND t.id <> draft_tpl));

  -- ── B. Warning: different approver, confidential record, exactly once ────
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dWarn));
  INSERT INTO rls_results VALUES ('hr', 'submit_hr_document', 'sends the warning once the wording is final', true, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.approve_hr_document(%L)', dWarn));
  INSERT INTO rls_results VALUES ('hr', 'approve_hr_document', 'author approves their own warning', false, res LIKE 'ok:%');
  res := public._p4_issue(dWarn, hr, adm);
  INSERT INTO rls_results VALUES ('adm', 'warning', 'issued after another person approves (' || res || ')', true, res LIKE 'ok:%');
  SELECT * INTO drow FROM public.hr_documents WHERE id = dWarn;
  INSERT INTO rls_results VALUES ('hr', 'warning', 'reference has the ALC/HR/WRN/<year>/<nnnn> shape', true, drow.ref_no ~ ref_re AND drow.ref_no LIKE 'ALC/HR/WRN/%');
  SELECT count(*) INTO n FROM public.disciplinary_records WHERE document_id = dWarn;
  SELECT id INTO wRec FROM public.disciplinary_records WHERE document_id = dWarn;
  INSERT INTO rls_results VALUES ('hr', 'disciplinary_records', 'issuing creates one record', true, n = 1);
  INSERT INTO rls_results VALUES ('hr', 'disciplinary_records', 'level and default 12-month expiry', true,
    EXISTS (SELECT 1 FROM public.disciplinary_records WHERE id = wRec AND level = 'final_written' AND status = 'active'
            AND incident_date = today - 5 AND expires_on = ((today - 5) + interval '12 months')::date));
  res := public._lt_as(hr, format('SELECT public.issue_hr_document(%L, %L)', dWarn, drow.issued_content));
  PERFORM public.hr_doc_apply_effects(drow);
  SELECT count(*) INTO n FROM public.disciplinary_records WHERE document_id = dWarn;
  INSERT INTO rls_results VALUES ('hr', 'disciplinary_records', 'retrying the issue creates nothing more', true, res NOT LIKE 'ok:%' AND n = 1);
  FOREACH nm IN ARRAY ARRAY['fin', 'stf'] LOOP
    res := public._lt_as((u ->> nm)::uuid, format('SELECT * FROM public.disciplinary_records WHERE employee_id = %L', empW));
    INSERT INTO rls_results VALUES (nm, 'disciplinary_records', 'reads warnings', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> nm)::uuid, format('SELECT * FROM public.hr_documents WHERE id = %L', dWarn));
    INSERT INTO rls_results VALUES (nm, 'hr_documents', 'reads the warning letter', false, res LIKE 'ok:%' AND res <> 'ok:0');
  END LOOP;
  res := public._lt_as(fin, format('INSERT INTO public.disciplinary_records (employee_id, level, offence_category, incident_date, expires_on, document_id) VALUES (%L, %L, %L, %L, %L, %L)',
    empW, 'verbal', 'x', today, today, dWarn));
  INSERT INTO rls_results VALUES ('fin', 'disciplinary_records', 'writes a warning', false, res LIKE 'ok:%');

  -- ── C. Recognition: cash reward waits for payroll ────────────────────────
  dRec := public._p4_draft(hr, 'recognition', empW, NULL, 'P4-recognition',
    jsonb_build_object('category', 'customer_praise', 'reason', 'Thanked by a client', 'rewardType', 'cash', 'amount', 50000));
  res := public._p4_issue(dRec, hr, hr);
  INSERT INTO rls_results VALUES ('hr', 'recognition', 'issued; the author may approve it (' || res || ')', true, res LIKE 'ok:%');
  SELECT count(*) INTO n FROM public.recognition_records WHERE document_id = dRec;
  SELECT id INTO rRec FROM public.recognition_records WHERE document_id = dRec;
  INSERT INTO rls_results VALUES ('hr', 'recognition_records', 'issuing creates one pending cash reward', true,
    n = 1 AND EXISTS (SELECT 1 FROM public.recognition_records WHERE id = rRec AND reward_type = 'cash' AND amount = 50000 AND payroll_status = 'pending'));
  SELECT * INTO drow FROM public.hr_documents WHERE id = dRec;
  PERFORM public.hr_doc_apply_effects(drow);
  SELECT count(*) INTO n FROM public.recognition_records WHERE document_id = dRec;
  INSERT INTO rls_results VALUES ('hr', 'recognition_records', 'running the effects again creates nothing more', true, n = 1);
  res := public._lt_as(fin, format('SELECT * FROM public.pending_cash_rewards() WHERE id = %L', rRec));
  INSERT INTO rls_results VALUES ('fin', 'pending_cash_rewards', 'finance sees the pending reward', true, res = 'ok:1');
  res := public._lt_as(stf, 'SELECT * FROM public.pending_cash_rewards()');
  INSERT INTO rls_results VALUES ('stf', 'pending_cash_rewards', 'staff sees pending rewards', false, res LIKE 'ok:%');
  res := public._lt_as(fin, format('SELECT * FROM public.recognition_records WHERE id = %L', rRec));
  INSERT INTO rls_results VALUES ('fin', 'recognition_records', 'finance reads the full record', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as(fin, format('SELECT public.mark_recognition_paid(%L, %L)', rRec, 'no-such-payroll'));
  INSERT INTO rls_results VALUES ('fin', 'mark_recognition_paid', 'marks paid against a payroll that does not exist', false, res LIKE 'ok:%');
  IF public._rlstest_seed('payroll', 'p4-pay', '{}'::jsonb) THEN
    payroll_id := public._rlstest_id('payroll', 'p4-pay');
    res := public._lt_as(stf, format('SELECT public.mark_recognition_paid(%L, %L)', rRec, payroll_id));
    INSERT INTO rls_results VALUES ('stf', 'mark_recognition_paid', 'staff marks a reward paid', false, res LIKE 'ok:%');
    res := public._lt_as(fin, format('SELECT public.mark_recognition_paid(%L, %L)', rRec, payroll_id));
    INSERT INTO rls_results VALUES ('fin', 'mark_recognition_paid', 'finance marks it paid in a payroll', true,
      res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.recognition_records WHERE id = rRec AND payroll_status = 'paid' AND paid_in_payroll_id = payroll_id));
    res := public._lt_as(fin, format('SELECT public.mark_recognition_paid(%L, %L)', rRec, payroll_id));
    INSERT INTO rls_results VALUES ('fin', 'mark_recognition_paid', 'marks the same reward paid twice', false, res LIKE 'ok:%');
  ELSE
    notes := notes || ('mark-paid checks skipped: could not seed a payroll row (' || current_setting('rlstest.last_err', true) || ')');
  END IF;
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'reward amounts stay out of the audit log', true,
    NOT EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'recognition_records' AND record_id = rRec::text AND (metadata -> 'new' ? 'amount' OR metadata -> 'old' ? 'amount')));

  -- Voiding the warning voids its record.
  res := public._lt_as(hr, format('SELECT public.void_hr_document(%L, %L)', dWarn, 'Issued to the wrong person'));
  INSERT INTO rls_results VALUES ('hr', 'disciplinary_records', 'voiding the warning voids the record', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.disciplinary_records WHERE id = wRec AND status = 'void'));

  -- ── D. Contract: one active contract per employee ────────────────────────
  dCon := public._p4_draft(hr, 'contract', empC, NULL, 'P4-contract', jsonb_build_object(
    'contractType', 'fixed_term', 'startDate', (today - 300)::text, 'endDate', (today + 30)::text,
    'position', 'Cook', 'salary', 800000, 'probationMonths', 0, 'noticeDays', 30));
  res := public._p4_issue(dCon, hr, adm);
  INSERT INTO rls_results VALUES ('hr', 'contract', 'issued (' || res || ')', true, res LIKE 'ok:%');
  SELECT count(*) INTO n FROM public.employment_contracts WHERE document_id = dCon;
  SELECT id INTO kC FROM public.employment_contracts WHERE document_id = dCon;
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'issuing creates one active contract from the letter', true,
    n = 1 AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kC AND status = 'active' AND source = 'letter'
                      AND end_date = today + 30 AND position = 'Cook' AND salary = 800000));
  SELECT * INTO drow FROM public.hr_documents WHERE id = dCon;
  res := public._lt_as(hr, format('SELECT public.issue_hr_document(%L, %L)', dCon, drow.issued_content));
  PERFORM public.hr_doc_apply_effects(drow);
  SELECT count(*) INTO n FROM public.employment_contracts WHERE document_id = dCon;
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'retrying the issue creates nothing more', true, res NOT LIKE 'ok:%' AND n = 1);

  dCon2 := public._p4_draft(hr, 'contract', empC, NULL, 'P4-contract-2', jsonb_build_object(
    'contractType', 'permanent', 'startDate', today::text, 'position', 'Cook', 'salary', 800000));
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dCon2));
  INSERT INTO rls_results VALUES ('hr', 'contract', 'a second contract while one is active', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.record_legacy_contract(%L, %L, %L, %L, %L)', empC, 'permanent', today, NULL, 'Cook'));
  INSERT INTO rls_results VALUES ('hr', 'record_legacy_contract', 'a second active contract recorded as legacy', false, res LIKE 'ok:%');
  BEGIN
    INSERT INTO public.employment_contracts (employee_id, contract_type, start_date, status, source) VALUES (empC, 'permanent', today, 'active', 'legacy');
    ok := false;
  EXCEPTION WHEN unique_violation THEN ok := true;
  END;
  INSERT INTO rls_results VALUES ('system', 'employment_contracts', 'the database itself allows one active contract', true, ok);
  res := public._lt_as(hr, format('INSERT INTO public.employment_contracts (employee_id, contract_type, start_date, status, source) VALUES (%L, %L, %L, %L, %L)',
    empK, 'permanent', today, 'active', 'legacy'));
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'writes a contract directly (not through a letter)', false, res LIKE 'ok:%');

  -- ── E. Reminders: once per threshold ─────────────────────────────────────
  res := public._lt_as(stf, format('SELECT public.run_contract_expiry_job(%L)', today));
  INSERT INTO rls_results VALUES ('stf', 'run_contract_expiry_job', 'staff runs the reminder job', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.run_contract_expiry_job(%L)', today));
  res := public._lt_as(hr, format('SELECT public.run_contract_expiry_job(%L)', today));
  INSERT INTO rls_results VALUES ('hr', 'contract_expiry_notices', 'a contract 30 days from its end gets one reminder, even if the job runs twice', true,
    res LIKE 'ok:%'
    AND (SELECT count(*) FROM public.contract_expiry_notices WHERE contract_id = kC) = 1
    AND EXISTS (SELECT 1 FROM public.contract_expiry_notices WHERE contract_id = kC AND threshold_days = 30)
    AND (SELECT count(*) FROM public.hr_notifications WHERE recipient_id = adm AND type = 'contract_expiry' AND link = '/hr/employees?open=' || empC) = 1);
  res := public._lt_as(hr, format('SELECT public.run_contract_expiry_job(%L)', today + 10));
  INSERT INTO rls_results VALUES ('hr', 'contract_expiry_notices', 'no reminder between thresholds (20 days left)', true,
    (SELECT count(*) FROM public.contract_expiry_notices WHERE contract_id = kC) = 1);
  res := public._lt_as(hr, format('SELECT public.run_contract_expiry_job(%L)', today + 23));
  INSERT INTO rls_results VALUES ('hr', 'contract_expiry_notices', 'the 7-day reminder is the second one', true,
    (SELECT count(*) FROM public.contract_expiry_notices WHERE contract_id = kC) = 2
    AND EXISTS (SELECT 1 FROM public.contract_expiry_notices WHERE contract_id = kC AND threshold_days = 7)
    AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kC AND status = 'active'));

  -- ── F. Extension: the chain, and voiding it ──────────────────────────────
  dExt := public._p4_draft(hr, 'extension', empC, NULL, 'P4-extension', jsonb_build_object(
    'contractId', kC, 'newEndDate', (today + 395)::text, 'newSalary', 900000, 'reason', 'Busy season'));
  res := public._p4_issue(dExt, hr, adm);
  INSERT INTO rls_results VALUES ('hr', 'extension', 'issued (' || res || ')', true, res LIKE 'ok:%');
  SELECT id INTO kChild FROM public.employment_contracts WHERE document_id = dExt;
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'the extended contract is marked extended', true,
    EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kC AND status = 'extended'));
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'the extension starts the day after and links back', true,
    EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kChild AND status = 'active' AND parent_contract_id = kC
            AND start_date = today + 31 AND end_date = today + 395 AND salary = 900000 AND position = 'Cook'));
  SELECT * INTO drow FROM public.hr_documents WHERE id = dExt;
  PERFORM public.hr_doc_apply_effects(drow);
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'running the effects again creates nothing more', true,
    (SELECT count(*) FROM public.employment_contracts WHERE parent_contract_id = kC) = 1);
  res := public._lt_as(hr, format('SELECT public.void_hr_document(%L, %L)', dExt, 'Wrong end date'));
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'voiding the extension voids it and the contract is active again', true,
    res LIKE 'ok:%'
    AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kChild AND status = 'void')
    AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kC AND status = 'active'));

  -- Past its end with no decision: one "overdue" reminder, then expired.
  res := public._lt_as(hr, format('SELECT public.run_contract_expiry_job(%L)', today + 31));
  INSERT INTO rls_results VALUES ('hr', 'contract_expiry_notices', 'an overdue contract gets one overdue reminder and is expired', true,
    res LIKE 'ok:%'
    AND EXISTS (SELECT 1 FROM public.contract_expiry_notices WHERE contract_id = kC AND threshold_days = 0)
    AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kC AND status = 'expired'));

  -- ── G. Offer: candidate, response, conversion, expiry ────────────────────
  res := public._lt_as(hr, 'INSERT INTO public.candidates (full_name, position, offer_status) VALUES (''P4 Candidate One'', ''Cook'', ''accepted'')');
  SELECT id INTO cand1 FROM public.candidates WHERE full_name = 'P4 Candidate One';
  INSERT INTO rls_results VALUES ('hr', 'candidates', 'a new candidate starts with no offer, whatever was sent', true,
    EXISTS (SELECT 1 FROM public.candidates WHERE id = cand1 AND offer_status = 'none'));
  dOffer := public._p4_draft(hr, 'offer', NULL, cand1, 'P4-offer', jsonb_build_object(
    'position', 'Cook', 'salary', 800000, 'startDate', (today + 20)::text, 'acceptanceDeadline', (today + 10)::text));
  res := public._p4_issue(dOffer, hr, adm);
  INSERT INTO rls_results VALUES ('hr', 'offer', 'issued to a candidate (' || res || ')', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'candidates', 'issuing marks the offer sent', true,
    EXISTS (SELECT 1 FROM public.candidates WHERE id = cand1 AND offer_status = 'offered' AND offer_document_id = dOffer));
  INSERT INTO rls_results VALUES ('hr', 'offer', 'the issued offer carries its OFF reference in its text', true,
    EXISTS (SELECT 1 FROM public.hr_documents WHERE id = dOffer AND issued_content ->> 'ref_no' LIKE 'ALC/HR/OFF/%' AND pdf_path IS NULL));
  res := public._lt_as(hr, format('UPDATE public.candidates SET offer_status = %L WHERE id = %L', 'accepted', cand1));
  INSERT INTO rls_results VALUES ('hr', 'candidates', 'sets the offer status by hand', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as(hr, format('UPDATE public.candidates SET employee_id = %L WHERE id = %L', empK, cand1));
  INSERT INTO rls_results VALUES ('hr', 'candidates', 'converts before the offer is accepted', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as(hr, format('SELECT public.respond_to_offer(%L, %L, %L)', cand1, 'accepted', today));
  INSERT INTO rls_results VALUES ('hr', 'respond_to_offer', 'records the acceptance', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.candidates WHERE id = cand1 AND offer_status = 'accepted' AND responded_at = today));
  res := public._lt_as(hr, format('UPDATE public.candidates SET employee_id = %L WHERE id = %L', empK, cand1));
  INSERT INTO rls_results VALUES ('hr', 'candidates', 'links the accepted candidate to the new employee', true, res = 'ok:1');
  res := public._lt_as(hr, format('UPDATE public.candidates SET employee_id = %L WHERE id = %L', empX, cand1));
  INSERT INTO rls_results VALUES ('hr', 'candidates', 'links them a second time', false, res LIKE 'ok:%' AND res <> 'ok:0');

  res := public._lt_as(hr, 'INSERT INTO public.candidates (full_name, position) VALUES (''P4 Candidate Two'', ''Waiter'')');
  SELECT id INTO cand2 FROM public.candidates WHERE full_name = 'P4 Candidate Two';
  dOffer2 := public._p4_draft(hr, 'offer', NULL, cand2, 'P4-offer-2', jsonb_build_object(
    'position', 'Waiter', 'salary', 500000, 'startDate', (today + 20)::text, 'acceptanceDeadline', (today + 1)::text));
  res := public._p4_issue(dOffer2, hr, adm);
  res := public._lt_as(hr, format('SELECT public.run_contract_expiry_job(%L)', today + 2));
  INSERT INTO rls_results VALUES ('hr', 'candidates', 'an offer past its deadline is expired by the daily job', true,
    EXISTS (SELECT 1 FROM public.candidates WHERE id = cand2 AND offer_status = 'expired'));

  -- ── H. Termination: different approver, ends employment only on issue ────
  res := public._lt_as(hr, format('SELECT public.record_legacy_contract(%L, %L, %L, %L, %L, %s, NULL, 30, %L)',
    empT, 'fixed_term', '2025-01-01', '2031-12-31', 'Chef', 700000, 'active'));
  SELECT id INTO kT FROM public.employment_contracts WHERE employee_id = empT AND status = 'active';
  INSERT INTO rls_results VALUES ('hr', 'record_legacy_contract', 'records an existing contract', true, res LIKE 'ok:%' AND kT IS NOT NULL);

  -- Leave in 2030 (4 Mar 2030 is a Monday; Mon-Sat working week): two approved
  -- requests and one pending, all ending after the last working day (6 Mar).
  SELECT id INTO annual FROM public.leave_types WHERE name = 'Annual';
  res := public._lt_as(hr, format('INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)', empT, annual, '2030-03-04', '2030-03-08'));
  res := public._lt_as(hr, format('INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)', empT, annual, '2030-03-11', '2030-03-13'));
  res := public._lt_as(hr, format('INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)', empT, annual, '2030-03-18', '2030-03-19'));
  SELECT id INTO L1 FROM public.leave_requests WHERE employee_id = empT AND start_date = '2030-03-04';
  SELECT id INTO L2 FROM public.leave_requests WHERE employee_id = empT AND start_date = '2030-03-11';
  SELECT id INTO L3 FROM public.leave_requests WHERE employee_id = empT AND start_date = '2030-03-18';
  res := public._lt_as(adm, format('SELECT public.review_leave_request(%L, %L)', L1, 'approved'));
  res := public._lt_as(adm, format('SELECT public.review_leave_request(%L, %L)', L2, 'approved'));
  IF L1 IS NULL OR L2 IS NULL OR L3 IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.leave_requests WHERE id IN (L1, L2) AND status = 'approved' HAVING count(*) = 2) THEN
    RAISE EXCEPTION 'FAIL: could not set up the leave for the termination test (last result: %)', res;
  END IF;

  dTerm := public._p4_draft(hr, 'termination', empT, NULL, 'P4-termination', jsonb_build_object(
    'terminationType', 'misconduct', 'noticeDate', '2030-03-01', 'lastWorkingDay', '2030-03-06',
    'reason', 'Repeated lateness', 'warningIds', '[]'::jsonb));
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dTerm));
  res := public._lt_as(hr, format('SELECT public.approve_hr_document(%L)', dTerm));
  INSERT INTO rls_results VALUES ('hr', 'approve_hr_document', 'author approves their own termination', false, res LIKE 'ok:%');
  res := public._lt_as(adm, format('SELECT public.approve_hr_document(%L)', dTerm));
  INSERT INTO rls_results VALUES ('adm', 'termination', 'approved, and the employee is still Active', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.employees WHERE id = empT AND status = 'Active'));
  res := public._p4_issue(dTerm, hr, adm);
  INSERT INTO rls_results VALUES ('hr', 'termination', 'issued (' || res || ')', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'employees', 'issuing makes the employee Inactive with the last day and reason', true,
    EXISTS (SELECT 1 FROM public.employees WHERE id = empT AND status = 'Inactive' AND "employmentEndDate" = '2030-03-06'
            AND "employmentEndReason" LIKE 'Misconduct: Repeated lateness%'));
  INSERT INTO rls_results VALUES ('hr', 'employment_contracts', 'the active contract is terminated at the last day', true,
    EXISTS (SELECT 1 FROM public.employment_contracts WHERE id = kT AND status = 'terminated' AND end_date = '2030-03-06'));
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'approved leave across the last day is shortened (5 -> 3 days)', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = L1 AND status = 'approved' AND end_date = '2030-03-06' AND days = 3));
  SELECT count(*) INTO n FROM public.attendance WHERE leave_request_id = L1;
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'only the leave days after the last day are removed (3 left)', true, n = 3);
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'approved leave after the last day is cancelled, with its attendance', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = L2 AND status = 'cancelled' AND decision_note = 'Employment ended 6 Mar 2030')
    AND NOT EXISTS (SELECT 1 FROM public.attendance WHERE leave_request_id = L2));
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'pending leave is cancelled with the note', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = L3 AND status = 'cancelled' AND decision_note = 'Employment ended 6 Mar 2030'));
  SELECT taken INTO v FROM public.leave_balances WHERE employee_id = empT AND leave_type_id = annual AND year = public.leave_year_of('2030-03-04');
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'days given back (8 taken -> 3)', true, v = 3);
  INSERT INTO rls_results VALUES ('adm', 'hr_notifications', 'HR is told, with the changes and a link', true,
    EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = adm AND type = 'employment_ended'
            AND link = '/hr/employees?open=' || empT AND body LIKE '%cancelled%'));

  res := public._lt_as(hr, format('SELECT public.void_hr_document(%L, %L)', dTerm, 'Settled by agreement'));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'voiding the termination does NOT reactivate the employee', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.employees WHERE id = empT AND status = 'Inactive'));

  -- ── I. Certificate of service ────────────────────────────────────────────
  -- Since 20261015000000 someone who has left is frozen until reactivated, so
  -- no letter at all (a certificate included) can be written for them.
  res := public._lt_as(hr, format(
    'INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L)',
    'certificate_of_service', empT,
    (SELECT id FROM public.hr_document_templates WHERE doc_type = 'certificate_of_service' AND is_active),
    'P4-certificate', '{"includeReason": false}'));
  INSERT INTO rls_results VALUES ('hr', 'certificate_of_service', 'written for someone who has left (frozen)', false, res LIKE 'ok:%');
  dCert2 := public._p4_draft(hr, 'certificate_of_service', empW, NULL, 'P4-certificate-2', '{"includeReason": false}');
  res := public._lt_as(hr, format('SELECT public.submit_hr_document(%L)', dCert2));
  INSERT INTO rls_results VALUES ('hr', 'certificate_of_service', 'sent for an employee who is still Active', false, res LIKE 'ok:%');

  -- ── J. Inactive only through the two paths ───────────────────────────────
  res := public._lt_as(hr, format('UPDATE public.employees SET status = %L WHERE id = %L', 'Inactive', empW));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'switches an employee to Inactive by editing', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as(hr, public._rlstest_insert_sql('employees', 'p4-new-inactive',
    jsonb_build_object('status', 'Inactive', 'department', 'P4Test', 'firstName', 'P4N', 'lastName', 'Tester')));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'adds a new employee as Inactive', false, res LIKE 'ok:%');
  res := public._lt_as(stf, format('SELECT public.end_employment_without_letter(%L, %L, %L)', empX, today, 'Stopped coming'));
  INSERT INTO rls_results VALUES ('stf', 'end_employment_without_letter', 'staff ends employment', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.end_employment_without_letter(%L, %L, %L)', empX, today, ' '));
  INSERT INTO rls_results VALUES ('hr', 'end_employment_without_letter', 'ends employment without a reason', false, res LIKE 'ok:%');
  res := public._lt_as(hr, format('SELECT public.end_employment_without_letter(%L, %L, %L)', empX, today, 'Stopped coming to work'));
  INSERT INTO rls_results VALUES ('hr', 'end_employment_without_letter', 'ends employment with a reason', true,
    res LIKE 'ok:%' AND EXISTS (SELECT 1 FROM public.employees WHERE id = empX AND status = 'Inactive' AND "employmentEndDate" = today
                                AND "employmentEndReason" = 'Stopped coming to work'));
  res := public._lt_as(hr, format('UPDATE public.employees SET status = %L WHERE id = %L', 'Active', empT));
  INSERT INTO rls_results VALUES ('hr', 'employees', 'reactivating clears the end date and reason', true,
    res = 'ok:1' AND EXISTS (SELECT 1 FROM public.employees WHERE id = empT AND status = 'Active'
                             AND "employmentEndDate" IS NULL AND "employmentEndReason" IS NULL));

  -- ── K. Who can read the new tables ───────────────────────────────────────
  FOREACH nm IN ARRAY ARRAY['candidates', 'employment_contracts', 'disciplinary_records', 'recognition_records', 'contract_expiry_notices'] LOOP
    res := public._lt_as(hr, format('SELECT * FROM public.%I', nm));
    INSERT INTO rls_results VALUES ('hr', nm, 'SELECT', true, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as(fin, format('SELECT * FROM public.%I', nm));
    INSERT INTO rls_results VALUES ('fin', nm, 'SELECT', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as(stf, format('SELECT * FROM public.%I', nm));
    INSERT INTO rls_results VALUES ('stf', nm, 'SELECT', false, res LIKE 'ok:%' AND res <> 'ok:0');
  END LOOP;
  res := public._lt_as(stf, 'INSERT INTO public.candidates (full_name) VALUES (''P4 Forged'')');
  INSERT INTO rls_results VALUES ('stf', 'candidates', 'INSERT', false, res LIKE 'ok:%');
  res := public._lt_as(fin, format('UPDATE public.recognition_records SET amount = 1 WHERE id = %L', rRec));
  INSERT INTO rls_results VALUES ('fin', 'recognition_records', 'UPDATE', false, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── Verdict (always an exception, so everything above is rolled back) ────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed. Failures: % %', failures, checks,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': expected ' || expected || ' got ' || actual, E'
' ORDER BY tbl, who, op) FROM rls_results WHERE expected IS DISTINCT FROM actual),
      array_to_string(notes, '; ');
  END IF;
  RAISE EXCEPTION 'PASS: all % HR letter checks passed. % This error is intentional: it rolls everything back.', checks, array_to_string(notes, '; ');
END
$test$;
