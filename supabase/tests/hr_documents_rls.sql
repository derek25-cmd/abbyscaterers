-- HR documents engine tests (Phase 3): who can see what, the lifecycle, the
-- freezing rules, reference numbers, template versions, audit masking and the
-- Admin-only company settings.
--
-- RUN AGAINST A LOCAL OR STAGING DATABASE ONLY, never production, after all
-- migrations through 20261014001500 are applied. Same harness as
-- hr_ops_rls.sql and leave_rls.sql: ONE statement that works with the hosted
-- `postgres` role and ALWAYS ends in an exception that starts with PASS: or
-- FAIL:, which rolls back everything it created.
--
-- It acts as: hr (hr_manager), adm (admin), fin (finance), stf (plain staff).
-- Storage checks are skipped, with a note in the result, if the postgres role
-- is not allowed to write storage.objects.

DO $test$
DECLARE
  people constant text[] := ARRAY['hr', 'adm', 'fin', 'stf'];
  roles_ constant jsonb := '{"hr": "hr_manager", "adm": "admin", "fin": "finance", "stf": "staff"}';
  u jsonb := '{}'::jsonb;
  nm text; uid uuid; res text; n integer; ok boolean; ok2 boolean;
  emp text; tpl uuid; tpl_version integer; prev_max integer;
  d0 uuid; d1 uuid; d2 uuid; d3 uuid; d4 uuid; d5 uuid; dforged uuid;
  ref1 text; ref1b text; ref2 text; seq1 integer; seq2 integer; path1 text;
  ref_re constant text := '^ALC/HR/GEN/[0-9]{4}/[0-9]{4,}$';
  sha constant text := 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  have_storage boolean := true;
  notes text[] := '{}'; failures integer; checks integer;
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

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  FOREACH nm IN ARRAY people LOOP
    uid := md5('hdtest-user-' || nm)::uuid;
    u := u || jsonb_build_object(nm, uid);
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, nm || '@hdtest.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_users (id, email, role, is_active)
    VALUES (uid, nm || '@hdtest.local', roles_ ->> nm, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  END LOOP;

  IF NOT public._rlstest_seed('employees', 'hd-A', jsonb_build_object('status', 'Active', 'department', 'HdTest', 'firstName', 'Test', 'lastName', 'Person')) THEN
    RAISE EXCEPTION 'FAIL: could not seed an employee (%)', current_setting('rlstest.last_err', true);
  END IF;
  emp := public._rlstest_id('employees', 'hd-A');

  SELECT id, version INTO tpl, tpl_version FROM public.hr_document_templates WHERE doc_type = 'general_letter' AND is_active;
  IF tpl IS NULL THEN
    RAISE EXCEPTION 'FAIL: no active general_letter template. Apply 20261014001500_hr_documents_seed.sql first.';
  END IF;

  -- A draft created by the owner, so there is something for the denied roles to fail to see.
  INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, data)
  VALUES ('general_letter', emp, tpl, 'HD-seed', '{"body": "seed"}') RETURNING id INTO d0;

  -- ── A. staff and finance see nothing ─────────────────────────────────────
  FOREACH nm IN ARRAY ARRAY['hr', 'fin', 'stf'] LOOP
    uid := (u ->> nm)::uuid;
    res := public._lt_as(uid, 'SELECT * FROM public.hr_documents');
    INSERT INTO rls_results VALUES (nm, 'hr_documents', 'SELECT', nm = 'hr', res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as(uid, 'SELECT * FROM public.hr_document_templates');
    INSERT INTO rls_results VALUES (nm, 'hr_document_templates', 'SELECT', nm = 'hr', res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as(uid, 'SELECT * FROM public.hr_document_types');
    INSERT INTO rls_results VALUES (nm, 'hr_document_types', 'SELECT', nm = 'hr', res LIKE 'ok:%' AND res <> 'ok:0');

    IF nm <> 'hr' THEN
      res := public._lt_as(uid, format(
        'INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject) VALUES (%L, %L, %L, %L)', 'general_letter', emp, tpl, 'forged'));
      INSERT INTO rls_results VALUES (nm, 'hr_documents', 'INSERT', false, res LIKE 'ok:%');
      res := public._lt_as(uid, format('UPDATE public.hr_documents SET subject = %L WHERE id = %L', 'edited', d0));
      INSERT INTO rls_results VALUES (nm, 'hr_documents', 'UPDATE', false, res LIKE 'ok:%' AND res <> 'ok:0');
      res := public._lt_as(uid, format('DELETE FROM public.hr_documents WHERE id = %L', d0));
      INSERT INTO rls_results VALUES (nm, 'hr_documents', 'DELETE', false, res LIKE 'ok:%' AND res <> 'ok:0');
      res := public._lt_as(uid, format('UPDATE public.hr_document_templates SET is_active = false WHERE id = %L', tpl));
      INSERT INTO rls_results VALUES (nm, 'hr_document_templates', 'UPDATE', false, res LIKE 'ok:%' AND res <> 'ok:0');
      res := public._lt_as(uid, 'UPDATE public.hr_document_types SET requires_different_approver = true');
      INSERT INTO rls_results VALUES (nm, 'hr_document_types', 'UPDATE', false, res LIKE 'ok:%' AND res <> 'ok:0');
    END IF;
  END LOOP;

  -- ── B. the bucket ────────────────────────────────────────────────────────
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('hr-documents', emp || '/hd-seed.pdf');
    FOREACH nm IN ARRAY ARRAY['hr', 'adm', 'fin', 'stf'] LOOP
      res := public._lt_as((u ->> nm)::uuid, 'SELECT * FROM storage.objects WHERE bucket_id = ''hr-documents''');
      INSERT INTO rls_results VALUES (nm, 'storage.objects', 'reads HR documents', nm IN ('hr', 'adm'), res LIKE 'ok:%' AND res <> 'ok:0');
    END LOOP;
    res := public._lt_as((u ->> 'stf')::uuid, format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'hr-documents', 'x/forged.pdf'));
    INSERT INTO rls_results VALUES ('stf', 'storage.objects', 'uploads an HR document', false, res LIKE 'ok:%');
    res := public._lt_as((u ->> 'fin')::uuid, format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'hr-documents', 'x/forged.pdf'));
    INSERT INTO rls_results VALUES ('fin', 'storage.objects', 'uploads an HR document', false, res LIKE 'ok:%');
    res := public._lt_as((u ->> 'hr')::uuid, format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'hr-documents', emp || '/hd-hr-upload.pdf'));
    INSERT INTO rls_results VALUES ('hr', 'storage.objects', 'uploads an HR document', true, res LIKE 'ok:%');
    -- Write-once: no policy lets anyone replace or remove a stored file.
    res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE storage.objects SET name = %L WHERE bucket_id = %L AND name = %L', emp || '/renamed.pdf', 'hr-documents', emp || '/hd-seed.pdf'));
    INSERT INTO rls_results VALUES ('hr', 'storage.objects', 'replaces a stored file', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'adm')::uuid, format('DELETE FROM storage.objects WHERE bucket_id = %L AND name = %L', 'hr-documents', emp || '/hd-seed.pdf'));
    INSERT INTO rls_results VALUES ('adm', 'storage.objects', 'deletes a stored file', false, res LIKE 'ok:%' AND res <> 'ok:0');
    INSERT INTO rls_results VALUES ('system', 'storage.buckets', 'hr-documents bucket is private', true,
      EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'hr-documents' AND public = false));
  EXCEPTION WHEN insufficient_privilege THEN
    have_storage := false;
    notes := notes || 'storage checks skipped (the postgres role cannot write storage.objects here)';
  END;

  -- ── C. drafts: content only ──────────────────────────────────────────────
  res := public._lt_as((u ->> 'hr')::uuid, format(
    'INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L)',
    'general_letter', emp, tpl, 'HD-1', '{"body": "Hello"}'));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'HR creates a draft', true, res LIKE 'ok:%');
  SELECT id INTO d1 FROM public.hr_documents WHERE subject = 'HD-1';
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'draft records the template version itself', true,
    EXISTS (SELECT 1 FROM public.hr_documents WHERE id = d1 AND status = 'draft' AND template_version = tpl_version AND ref_no IS NULL));

  -- Fields a client must not be able to set on creation.
  res := public._lt_as((u ->> 'hr')::uuid, format(
    'INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, status, ref_no, pdf_path, pdf_sha256, issued_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, now())',
    'general_letter', emp, tpl, 'HD-forged', 'issued', 'ALC/HR/GEN/2026/9999', 'x/y.pdf', sha));
  SELECT id INTO dforged FROM public.hr_documents WHERE subject = 'HD-forged';
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'a forged "issued" row is saved as a blank draft', true,
    EXISTS (SELECT 1 FROM public.hr_documents WHERE id = dforged AND status = 'draft' AND ref_no IS NULL AND pdf_path IS NULL AND issued_at IS NULL));

  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET status = %L WHERE id = %L', 'approved', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'moves stage by editing the row', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET ref_no = %L WHERE id = %L', 'ALC/HR/GEN/2026/0001', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'sets a reference number by hand', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET approved_by = %L WHERE id = %L', u ->> 'hr', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'sets the approver by hand', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET subject = %L, data = %L WHERE id = %L', 'HD-1 edited', '{"body": "Changed"}', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'edits a draft', true, res = 'ok:1');

  -- ── D. submit, notify, freeze ────────────────────────────────────────────
  FOREACH nm IN ARRAY ARRAY['stf', 'fin'] LOOP
    res := public._lt_as((u ->> nm)::uuid, format('SELECT public.submit_hr_document(%L)', d1));
    INSERT INTO rls_results VALUES (nm, 'submit_hr_document', 'runs it', false, res LIKE 'ok:%');
  END LOOP;
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.submit_hr_document(%L)', d1));
  INSERT INTO rls_results VALUES ('hr', 'submit_hr_document', 'HR sends a draft for approval', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('adm', 'hr_notifications', 'other approver is told', true,
    EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = (u ->> 'adm')::uuid AND type = 'hr_document_submitted'));
  INSERT INTO rls_results VALUES ('hr', 'hr_notifications', 'the author is not told about their own submission', true,
    NOT EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = (u ->> 'hr')::uuid AND type = 'hr_document_submitted'));

  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET data = %L WHERE id = %L', '{"body": "Sneaky"}', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'edits content once it is waiting for approval', false, res LIKE 'ok:%' AND res <> 'ok:0');

  FOREACH nm IN ARRAY ARRAY['stf', 'fin'] LOOP
    res := public._lt_as((u ->> nm)::uuid, format('SELECT public.approve_hr_document(%L)', d1));
    INSERT INTO rls_results VALUES (nm, 'approve_hr_document', 'runs it', false, res LIKE 'ok:%');
  END LOOP;

  -- ── E. approve: signatory snapshot, then frozen ──────────────────────────
  res := public._lt_as((u ->> 'adm')::uuid, format('SELECT public.approve_hr_document(%L)', d1));
  INSERT INTO rls_results VALUES ('adm', 'approve_hr_document', 'Admin approves', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('adm', 'hr_documents', 'approver and time recorded', true,
    EXISTS (SELECT 1 FROM public.hr_documents WHERE id = d1 AND status = 'approved' AND approved_by = (u ->> 'adm')::uuid AND approved_at IS NOT NULL));
  INSERT INTO rls_results VALUES ('adm', 'hr_documents', 'signatory taken from the approver', true,
    EXISTS (SELECT 1 FROM public.hr_documents WHERE id = d1 AND signatory_name = 'adm@hdtest.local' AND signatory_title = 'Administrator'));

  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET data = %L WHERE id = %L', '{"body": "After approval"}', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'edits the data of an approved document', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET subject = %L WHERE id = %L', 'Changed subject', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'edits the subject of an approved document', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET employee_id = %L WHERE id = %L', public._rlstest_id('employees', 'fk-hd-other'), d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'changes the person of an approved document', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.return_hr_document(%L, %L)', d1, 'too late'));
  INSERT INTO rls_results VALUES ('hr', 'return_hr_document', 'returns an approved document to draft', false, res LIKE 'ok:%');

  -- ── F. reference numbers ─────────────────────────────────────────────────
  res := public._lt_as((u ->> 'stf')::uuid, format('SELECT public.reserve_hr_document_ref(%L)', d1));
  INSERT INTO rls_results VALUES ('stf', 'reserve_hr_document_ref', 'runs it', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.reserve_hr_document_ref(%L)', d0));
  INSERT INTO rls_results VALUES ('hr', 'reserve_hr_document_ref', 'reserves a number for a draft', false, res LIKE 'ok:%');

  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.reserve_hr_document_ref(%L)', d1));
  INSERT INTO rls_results VALUES ('hr', 'reserve_hr_document_ref', 'reserves a number for an approved document', true, res LIKE 'ok:%');
  SELECT ref_no INTO ref1 FROM public.hr_documents WHERE id = d1;
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'reference has the ALC/HR/GEN/<year>/<nnnn> shape', true, ref1 ~ ref_re);
  res := public._lt_as((u ->> 'adm')::uuid, format('SELECT public.reserve_hr_document_ref(%L)', d1));
  SELECT ref_no INTO ref1b FROM public.hr_documents WHERE id = d1;
  INSERT INTO rls_results VALUES ('adm', 'reserve_hr_document_ref', 'asking again returns the same number', true, ref1b = ref1);
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET ref_no = %L WHERE id = %L', 'ALC/HR/GEN/2026/7777', d1));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'changes a reserved number', false, res LIKE 'ok:%' AND res <> 'ok:0');
  INSERT INTO rls_results VALUES ('hr', 'hr_document_counters', 'the counter is not readable by HR, only through the functions', true,
    (public._lt_as((u ->> 'hr')::uuid, 'SELECT * FROM public.hr_document_counters') = 'ok:0'
     OR public._lt_as((u ->> 'hr')::uuid, 'SELECT * FROM public.hr_document_counters') LIKE 'err:42501%')
    AND EXISTS (SELECT 1 FROM public.hr_document_counters));
  res := public._lt_as((u ->> 'hr')::uuid, 'INSERT INTO public.hr_document_counters (doc_type, year, last_value) VALUES (''general_letter'', 2999, 1)');
  INSERT INTO rls_results VALUES ('hr', 'hr_document_counters', 'writes the counter directly', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, 'UPDATE public.hr_document_counters SET last_value = 0');
  INSERT INTO rls_results VALUES ('hr', 'hr_document_counters', 'resets the counter', false, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── G. issue: only with a real file at the right path ────────────────────
  path1 := emp || '/' || replace(ref1, '/', '_') || '.pdf';
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.issue_hr_document(%L, %L, %L)', d1, path1, sha));
  INSERT INTO rls_results VALUES ('hr', 'issue_hr_document', 'issues with no file uploaded', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.issue_hr_document(%L, %L, %L)', d1, emp || '/some-other-file.pdf', sha));
  INSERT INTO rls_results VALUES ('hr', 'issue_hr_document', 'issues with a path that does not match the number', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'still approved after every failed attempt', true,
    EXISTS (SELECT 1 FROM public.hr_documents WHERE id = d1 AND status = 'approved' AND ref_no = ref1));

  IF have_storage THEN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('hr-documents', path1);
    res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.issue_hr_document(%L, %L, %L)', d1, path1, 'not-a-hash'));
    INSERT INTO rls_results VALUES ('hr', 'issue_hr_document', 'issues with an invalid checksum (file present)', false, res LIKE 'ok:%');
    INSERT INTO rls_results VALUES ('hr', 'issue_hr_document', 'the checksum refusal says so', true, res LIKE '%checksum%');
    res := public._lt_as((u ->> 'stf')::uuid, format('SELECT public.issue_hr_document(%L, %L, %L)', d1, path1, sha));
    INSERT INTO rls_results VALUES ('stf', 'issue_hr_document', 'staff issues', false, res LIKE 'ok:%');
    res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.issue_hr_document(%L, %L, %L)', d1, path1, sha));
    INSERT INTO rls_results VALUES ('hr', 'issue_hr_document', 'issues once the file is stored', true, res LIKE 'ok:%');
    INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'issued with the file path, fingerprint and time', true,
      EXISTS (SELECT 1 FROM public.hr_documents WHERE id = d1 AND status = 'issued' AND pdf_path = path1 AND pdf_sha256 = sha AND issued_at IS NOT NULL));

    -- An issued document accepts nothing but a void with a reason.
    res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET subject = %L WHERE id = %L', 'Edited after issue', d1));
    INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'edits an issued document', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET pdf_sha256 = %L WHERE id = %L', repeat('0', 64), d1));
    INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'changes the recorded fingerprint', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET status = %L, void_reason = %L WHERE id = %L', 'void', 'by hand', d1));
    INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'voids by editing the row', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.hr_documents WHERE id = %L', d1));
    INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'deletes an issued document', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.void_hr_document(%L, %L)', d1, '  '));
    INSERT INTO rls_results VALUES ('hr', 'void_hr_document', 'voids without a reason', false, res LIKE 'ok:%');
    res := public._lt_as((u ->> 'stf')::uuid, format('SELECT public.void_hr_document(%L, %L)', d1, 'because'));
    INSERT INTO rls_results VALUES ('stf', 'void_hr_document', 'staff voids', false, res LIKE 'ok:%');
    res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.void_hr_document(%L, %L)', d1, 'Wrong date on the letter'));
    INSERT INTO rls_results VALUES ('hr', 'void_hr_document', 'voids an issued document with a reason', true, res LIKE 'ok:%');
    INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'a void keeps its number, file and reason', true,
      EXISTS (SELECT 1 FROM public.hr_documents WHERE id = d1 AND status = 'void' AND ref_no = ref1 AND pdf_path = path1 AND void_reason = 'Wrong date on the letter' AND voided_by IS NOT NULL));
    res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET void_reason = %L WHERE id = %L', 'rewritten', d1));
    INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'edits a voided document', false, res LIKE 'ok:%' AND res <> 'ok:0');
  END IF;

  -- ── H. numbers are never reused, and stay unique ─────────────────────────
  FOREACH nm IN ARRAY ARRAY['d2', 'd3'] LOOP
    res := public._lt_as((u ->> 'hr')::uuid, format(
      'INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L)',
      'general_letter', emp, tpl, 'HD-' || nm, '{"body": "x"}'));
  END LOOP;
  SELECT id INTO d2 FROM public.hr_documents WHERE subject = 'HD-d2';
  SELECT id INTO d3 FROM public.hr_documents WHERE subject = 'HD-d3';
  FOREACH nm IN ARRAY ARRAY['d2', 'd3'] LOOP
    res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.submit_hr_document(%L)', CASE nm WHEN 'd2' THEN d2 ELSE d3 END));
    res := public._lt_as((u ->> 'adm')::uuid, format('SELECT public.approve_hr_document(%L)', CASE nm WHEN 'd2' THEN d2 ELSE d3 END));
  END LOOP;
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.reserve_hr_document_ref(%L)', d2));
  SELECT ref_no INTO ref2 FROM public.hr_documents WHERE id = d2;
  seq1 := substring(ref1 from '[0-9]+$')::integer;
  seq2 := substring(ref2 from '[0-9]+$')::integer;
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'the next number follows the last, even after a void', true,
    ref2 ~ ref_re AND substring(ref1 from '^.*/') = substring(ref2 from '^.*/') AND seq2 = seq1 + 1);

  -- Two documents can never hold the same number (the owner forces it, with the lifecycle flag, to prove the constraint).
  PERFORM set_config('hr_docs.rpc', '1', true);
  BEGIN
    UPDATE public.hr_documents SET ref_no = ref1 WHERE id = d3;
    ok := false;
  EXCEPTION WHEN unique_violation THEN ok := true;
  END;
  PERFORM set_config('hr_docs.rpc', '', true);
  INSERT INTO rls_results VALUES ('system', 'hr_documents', 'ref_no is unique', true, ok);

  -- ── I. deleting ──────────────────────────────────────────────────────────
  res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.hr_documents WHERE id = %L', d2));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'deletes an approved document', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.hr_documents WHERE id = %L', d0));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'deletes a draft', true, res = 'ok:1');

  -- ── J. the different-approver rule ───────────────────────────────────────
  UPDATE public.hr_document_types SET requires_different_approver = true WHERE doc_type = 'general_letter';
  res := public._lt_as((u ->> 'hr')::uuid, format(
    'INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L)',
    'general_letter', emp, tpl, 'HD-4', '{"body": "x"}'));
  SELECT id INTO d4 FROM public.hr_documents WHERE subject = 'HD-4';
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.submit_hr_document(%L)', d4));
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.approve_hr_document(%L)', d4));
  INSERT INTO rls_results VALUES ('hr', 'approve_hr_document', 'author approves their own document (rule on)', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'approve_hr_document', 'the refusal says why', true, res LIKE '%someone other than the person who wrote it%');
  res := public._lt_as((u ->> 'adm')::uuid, format('SELECT public.approve_hr_document(%L)', d4));
  INSERT INTO rls_results VALUES ('adm', 'approve_hr_document', 'a different approver approves it', true, res LIKE 'ok:%');
  UPDATE public.hr_document_types SET requires_different_approver = false WHERE doc_type = 'general_letter';

  -- ── K. templates: a saved version never changes ──────────────────────────
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_document_templates SET body = %L WHERE id = %L', 'REWRITTEN', tpl));
  INSERT INTO rls_results VALUES ('hr', 'hr_document_templates', 'edits a saved version', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.hr_document_templates WHERE id = %L', tpl));
  INSERT INTO rls_results VALUES ('hr', 'hr_document_templates', 'deletes a version that letters used', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'stf')::uuid, format('SELECT public.save_hr_template_version(%L, %L, %L)', 'general_letter', 'T', 'B'));
  INSERT INTO rls_results VALUES ('stf', 'save_hr_template_version', 'staff saves a template', false, res LIKE 'ok:%');
  SELECT max(version) INTO prev_max FROM public.hr_document_templates WHERE doc_type = 'general_letter';
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.save_hr_template_version(%L, %L, %L)', 'general_letter', 'General letter', 'Dear {{employee.fullName}}, TEMPLATE-V2-WORDING {{{body}}}'));
  INSERT INTO rls_results VALUES ('hr', 'save_hr_template_version', 'HR saves a new version', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'hr_document_templates', 'exactly one version is active, and it is the new one', true,
    (SELECT count(*) FROM public.hr_document_templates WHERE doc_type = 'general_letter' AND is_active) = 1
    AND EXISTS (SELECT 1 FROM public.hr_document_templates WHERE doc_type = 'general_letter' AND is_active AND version = prev_max + 1 AND body LIKE '%TEMPLATE-V2-WORDING%'));
  INSERT INTO rls_results VALUES ('hr', 'hr_documents', 'letters already written keep their version', true,
    EXISTS (SELECT 1 FROM public.hr_documents WHERE id = d1 AND template_version = tpl_version AND template_id = tpl));

  -- ── L. audit: letter contents stay out, wording changes stay in ──────────
  res := public._lt_as((u ->> 'hr')::uuid, format(
    'INSERT INTO public.hr_documents (doc_type, employee_id, template_id, subject, data) VALUES (%L, %L, %L, %L, %L)',
    'general_letter', emp, (SELECT id FROM public.hr_document_templates WHERE doc_type = 'general_letter' AND is_active), 'HD-5', '{"body": "SECRET-LETTER-TEXT first"}'));
  SELECT id INTO d5 FROM public.hr_documents WHERE subject = 'HD-5';
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.hr_documents SET data = %L WHERE id = %L', '{"body": "SECRET-LETTER-TEXT second"}', d5));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'letter content is not copied into the audit log', true,
    NOT EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'hr_documents' AND record_id = d5::text AND metadata::text LIKE '%SECRET-LETTER-TEXT%'));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'but the change to the content is recorded', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'hr_documents' AND record_id = d5::text AND action = 'hr_documents.update' AND metadata -> 'changed_fields' ? 'data'));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'subject and status are not masked', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'hr_documents' AND record_id = d5::text AND metadata -> 'new' ->> 'subject' = 'HD-5' AND metadata -> 'new' ->> 'status' = 'draft'));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'template wording changes stay visible', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'hr_document_templates' AND metadata::text LIKE '%TEMPLATE-V2-WORDING%'));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'approval is recorded with who', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'hr_documents.approve' AND record_id = d1::text AND actor_id = (u ->> 'adm')::uuid));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'counter moves are recorded against type/year', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'hr_document_counters' AND record_id LIKE 'general_letter/%'));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'Phase 1 masks still apply (monthlySalary stays out)', true,
    NOT EXISTS (SELECT 1 FROM public.audit_log WHERE table_name = 'employees' AND record_id = emp AND metadata -> 'new' ? 'monthlySalary'));

  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT * FROM public.audit_log WHERE table_name = %L AND record_id = %L', 'hr_documents', d5::text));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'HR Manager can read the document history', true, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'stf')::uuid, format('SELECT * FROM public.audit_log WHERE table_name = %L AND record_id = %L', 'hr_documents', d5::text));
  INSERT INTO rls_results VALUES ('stf', 'audit_log', 'staff cannot read it', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'fin')::uuid, format('SELECT * FROM public.audit_log WHERE table_name = %L', 'hr_document_templates'));
  INSERT INTO rls_results VALUES ('fin', 'audit_log', 'finance cannot read it', false, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── M. company details: Admin only ───────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.app_settings) THEN
    FOREACH nm IN ARRAY ARRAY['stf', 'fin', 'hr'] LOOP
      res := public._lt_as((u ->> nm)::uuid, 'UPDATE public.app_settings SET company_name = ''Not allowed'' WHERE id = true');
      INSERT INTO rls_results VALUES (nm, 'app_settings', 'changes the company name', false, res LIKE 'ok:%' AND res <> 'ok:0');
    END LOOP;
    res := public._lt_as((u ->> 'stf')::uuid, 'UPDATE public.app_settings SET header_url = header_url WHERE id = true');
    INSERT INTO rls_results VALUES ('stf', 'app_settings', 'other settings are unaffected by the guard', true, res LIKE 'ok:%');
    res := public._lt_as((u ->> 'adm')::uuid, 'UPDATE public.app_settings SET company_name = ''Test Company Ltd'' WHERE id = true');
    INSERT INTO rls_results VALUES ('adm', 'app_settings', 'Admin changes the company name', true, res = 'ok:1');
  END IF;

  -- ── Verdict (always an exception, so everything above is rolled back) ────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed. Failures: % %', failures, checks,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': expected ' || expected || ' got ' || actual, E'
' ORDER BY tbl, who, op) FROM rls_results WHERE expected IS DISTINCT FROM actual),
      array_to_string(notes, '; ');
  END IF;
  RAISE EXCEPTION 'PASS: all % HR document checks passed. % This error is intentional: it rolls everything back.', checks, array_to_string(notes, '; ');
END
$test$;
