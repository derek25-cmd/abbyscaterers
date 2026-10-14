-- Phase 5: removing the UAT test data before go-live.
--
-- UAT runs on the live database with clearly marked test data:
--   employees    id 'UAT-001'... (created by scripts/setup-uat.js), or a first
--                name starting 'UAT ' (people added through the app during UAT,
--                e.g. a candidate converted to an employee)
--   candidates   full name starting 'UAT ', or converted into a UAT employee
--   logins       email containing '+uat-' (base+uat-<role>@...), or linked to
--                a UAT employee
--
-- cleanup_uat_data(p_dry_run) removes everything belonging to those, and only
-- that. With p_dry_run = true (the default) it changes nothing and reports what
-- it would remove. Only the service role can call it (the SQL editor, or
-- scripts/cleanup-uat.js); signed-in users cannot.
--
-- Records protected by guards (issued letters, approved leave) are removed by
-- letting those guards through for UAT rows only, while a transaction-local
-- flag (app.uat_cleanup) is on: hr_documents_guard and leave_request_guard are
-- redefined below with that one addition, otherwise unchanged.
--
-- Afterwards each reference-number counter is set back to the highest number
-- still used by a real letter (0 if none), so real letters start at 0001.
-- audit_log is never edited: the deletions are audited like any other change,
-- and one final 'uat.cleanup' event records the counts and the files to remove.
-- Files are removed through the Storage API (Supabase does not allow deleting
-- storage objects with SQL): scripts/cleanup-uat.js does it.

-- ── Who is test data ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_uat_employee(p_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_id LIKE 'UAT-%'
      OR EXISTS (SELECT 1 FROM public.employees e
                  WHERE e.id = p_id AND (e."firstName" LIKE 'UAT %' OR e."firstName" = 'UAT'));
$$;

CREATE OR REPLACE FUNCTION public.is_uat_candidate(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.candidates c
                  WHERE c.id = p_id AND (c.full_name LIKE 'UAT %'
                                         OR (c.employee_id IS NOT NULL AND public.is_uat_employee(c.employee_id))));
$$;

CREATE OR REPLACE FUNCTION public.uat_cleanup_on()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.uat_cleanup', true), '') = 'on';
$$;

-- ── Guards: let the cleanup through, for UAT rows only ─────────────────────
-- Same body as 20261014001600 plus the marked lines.
CREATE OR REPLACE FUNCTION public.hr_documents_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  via_rpc boolean := coalesce(current_setting('hr_docs.rpc', true), '') = '1';
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Whatever the client sent, a new document is a blank draft.
    NEW.status := 'draft';
    NEW.ref_no := NULL;
    NEW.return_note := NULL; NEW.void_reason := NULL; NEW.voided_by := NULL; NEW.voided_at := NULL;
    NEW.pdf_path := NULL; NEW.pdf_sha256 := NULL; NEW.issued_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    -- The recorded template version is the template's own, not the client's.
    SELECT t.version INTO NEW.template_version
    FROM public.hr_document_templates t
    WHERE t.id = NEW.template_id AND t.doc_type = NEW.doc_type;
    IF NEW.template_version IS NULL THEN
      RAISE EXCEPTION 'That template does not belong to this type of document.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Phase 5: the UAT cleanup removes test letters whatever their stage.
    IF public.uat_cleanup_on()
       AND ((OLD.employee_id IS NOT NULL AND public.is_uat_employee(OLD.employee_id))
            OR (OLD.candidate_id IS NOT NULL AND public.is_uat_candidate(OLD.candidate_id))) THEN
      RETURN OLD;
    END IF;
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only a draft can be deleted. Void this document instead; its reference number stays on record.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE ---------------------------------------------------------------
  IF OLD.ref_no IS NOT NULL AND NEW.ref_no IS DISTINCT FROM OLD.ref_no THEN
    RAISE EXCEPTION 'A reference number cannot be changed once it has been reserved.';
  END IF;

  IF OLD.status = 'issued' THEN
    IF NOT (via_rpc AND NEW.status = 'void' AND length(trim(coalesce(NEW.void_reason, ''))) > 0) THEN
      RAISE EXCEPTION 'An issued document cannot be changed. It can only be voided, with a reason, and then reissued as a new document.';
    END IF;
    IF to_jsonb(NEW) - ARRAY['status', 'void_reason', 'voided_by', 'voided_at', 'updated_by']
       IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status', 'void_reason', 'voided_by', 'voided_at', 'updated_by'] THEN
      RAISE EXCEPTION 'Voiding an issued document changes nothing else about it.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'A voided document cannot be changed.';
  END IF;

  -- A draft moved to another template takes that template's version.
  IF OLD.status = 'draft' AND NEW.template_id IS DISTINCT FROM OLD.template_id THEN
    SELECT t.version INTO NEW.template_version
    FROM public.hr_document_templates t
    WHERE t.id = NEW.template_id AND t.doc_type = NEW.doc_type;
    IF NEW.template_version IS NULL THEN
      RAISE EXCEPTION 'That template does not belong to this type of document.';
    END IF;
  END IF;

  -- Content freezes as soon as the document leaves draft (it is what the
  -- approver reviews, and what the PDF is built from).
  IF OLD.status <> 'draft' AND (
       NEW.data IS DISTINCT FROM OLD.data OR NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.template_version IS DISTINCT FROM OLD.template_version OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id OR NEW.subject IS DISTINCT FROM OLD.subject
    OR NEW.doc_type IS DISTINCT FROM OLD.doc_type OR NEW.confidential IS DISTINCT FROM OLD.confidential
  ) THEN
    RAISE EXCEPTION 'This document is no longer a draft, so its content is frozen. Return it to draft to edit it.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT via_rpc THEN
      RAISE EXCEPTION 'Use Submit, Approve, Issue or Void to move a document between stages.';
    END IF;
    IF NOT ((OLD.status, NEW.status) IN (
         ('draft', 'pending_approval'), ('pending_approval', 'draft'), ('pending_approval', 'approved'),
         ('approved', 'issued'), ('draft', 'void'), ('pending_approval', 'void'), ('approved', 'void'))) THEN
      RAISE EXCEPTION 'A document cannot go from % to %.', OLD.status, NEW.status;
    END IF;
  ELSIF NOT via_rpc AND (
       NEW.ref_no IS DISTINCT FROM OLD.ref_no OR NEW.return_note IS DISTINCT FROM OLD.return_note
    OR NEW.void_reason IS DISTINCT FROM OLD.void_reason OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
    OR NEW.voided_at IS DISTINCT FROM OLD.voided_at OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path
    OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256 OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'That field is set by the approval and issue process and cannot be edited directly.';
  END IF;

  -- The signatory may be overridden by hand only while still a draft.
  IF NOT via_rpc AND OLD.status <> 'draft'
     AND (NEW.signatory_name IS DISTINCT FROM OLD.signatory_name OR NEW.signatory_title IS DISTINCT FROM OLD.signatory_title) THEN
    RAISE EXCEPTION 'The signatory can only be changed while the document is a draft.';
  END IF;

  RETURN NEW;
END;
$$;

-- Same body as 20261014000700 plus the marked lines.
CREATE OR REPLACE FUNCTION public.leave_request_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Phase 5: the UAT cleanup removes test leave whatever its status.
    IF public.uat_cleanup_on() AND public.is_uat_employee(OLD.employee_id) THEN
      RETURN OLD;
    END IF;
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'Approved leave cannot be deleted. Cancel it instead, which restores the balance and clears the attendance days.';
    END IF;
    RETURN OLD;
  END IF;

  IF coalesce(current_setting('leave.rpc', true), '') <> '1' AND (
       NEW.status IS DISTINCT FROM OLD.status OR NEW.days IS DISTINCT FROM OLD.days
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.leave_type_id IS DISTINCT FROM OLD.leave_type_id
    OR NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.decided_by IS DISTINCT FROM OLD.decided_by OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
    OR NEW.decision_note IS DISTINCT FROM OLD.decision_note
    OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'A leave request cannot be edited directly. Use Approve, Reject or Cancel.';
  END IF;
  RETURN NEW;
END;
$$;

-- ── The cleanup ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_uat_data(p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  emps text[];
  cands uuid[];
  logins uuid[];
  docs uuid[];
  contracts uuid[];
  leave_ids uuid[];
  files jsonb;
  counts jsonb := '{}'::jsonb;
  others jsonb := '[]'::jsonb;
  counters jsonb := '[]'::jsonb;
  fk RECORD;
  n integer;
  c RECORD;
  new_value integer;
BEGIN
  -- The service role (scripts) or the SQL editor (no signed-in user) only.
  IF public.safe_auth_uid() IS NOT NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'The UAT cleanup can only be run with the service role.' USING ERRCODE = '42501';
  END IF;

  -- Who is test data (see the header).
  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO emps
    FROM public.employees WHERE id LIKE 'UAT-%' OR "firstName" LIKE 'UAT %' OR "firstName" = 'UAT';
  SELECT coalesce(array_agg(id), '{}') INTO cands
    FROM public.candidates WHERE full_name LIKE 'UAT %' OR employee_id = ANY (emps);
  SELECT coalesce(array_agg(id), '{}') INTO logins
    FROM public.staff_users WHERE email ILIKE '%+uat-%' OR employee_id = ANY (emps);
  SELECT coalesce(array_agg(id), '{}') INTO docs
    FROM public.hr_documents WHERE employee_id = ANY (emps) OR candidate_id = ANY (cands);
  SELECT coalesce(array_agg(id), '{}') INTO contracts
    FROM public.employment_contracts WHERE employee_id = ANY (emps);
  SELECT coalesce(array_agg(id), '{}') INTO leave_ids
    FROM public.leave_requests WHERE employee_id = ANY (emps);

  -- Files: everything stored under a UAT employee's or candidate's folder, plus
  -- leave attachments of UAT leave (stored under the uploader's login id).
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'path', o.name) ORDER BY o.bucket_id, o.name), '[]'::jsonb)
    INTO files
    FROM storage.objects o
   WHERE (o.bucket_id = 'hr-documents'
          AND (split_part(o.name, '/', 1) = ANY (emps)
               OR split_part(o.name, '/', 1) = ANY (SELECT 'candidate-' || x::text FROM unnest(cands) x)))
      OR (o.bucket_id = 'leave-attachments'
          AND (o.name IN (SELECT attachment_path FROM public.leave_requests WHERE id = ANY (leave_ids) AND attachment_path IS NOT NULL)
               OR split_part(o.name, '/', 1) = ANY (SELECT x::text FROM unnest(logins) x)));

  counts := jsonb_build_object(
    'employees', cardinality(emps),
    'candidates', cardinality(cands),
    'logins', cardinality(logins),
    'hr_documents', cardinality(docs),
    'employment_contracts', cardinality(contracts),
    'contract_expiry_notices', (SELECT count(*) FROM public.contract_expiry_notices WHERE contract_id = ANY (contracts)),
    'disciplinary_records', (SELECT count(*) FROM public.disciplinary_records WHERE employee_id = ANY (emps)),
    'recognition_records', (SELECT count(*) FROM public.recognition_records WHERE employee_id = ANY (emps)),
    'leave_requests', cardinality(leave_ids),
    'leave_balances', (SELECT count(*) FROM public.leave_balances WHERE employee_id = ANY (emps)),
    'attendance', (SELECT count(*) FROM public.attendance WHERE employee_id = ANY (emps)),
    'hr_notifications', (SELECT count(*) FROM public.hr_notifications
                          WHERE recipient_id = ANY (logins)
                             OR EXISTS (SELECT 1 FROM unnest(emps) e WHERE hr_notifications.link = '/hr/employees?open=' || e)),
    'files', jsonb_array_length(files));

  -- Any other table that points at a UAT employee (e.g. payroll, training):
  -- removed too, and listed, so nothing is left behind or silently blocked.
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND array_length(c.conkey, 1) = 1
       AND c.conrelid::regclass::text NOT IN ('staff_users', 'candidates', 'hr_documents', 'employment_contracts',
             'disciplinary_records', 'recognition_records', 'leave_requests', 'leave_balances', 'attendance')
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col) INTO n USING emps;
    IF n > 0 THEN others := others || jsonb_build_object('table', fk.tbl::text, 'column', fk.col, 'rows', n); END IF;
  END LOOP;

  -- Reference numbers each counter goes back to.
  FOR c IN SELECT * FROM public.hr_document_counters LOOP
    SELECT coalesce(max(substring(d.ref_no FROM '[0-9]+$')::int), 0) INTO new_value
      FROM public.hr_documents d
     WHERE d.doc_type = c.doc_type AND d.ref_no IS NOT NULL AND split_part(d.ref_no, '/', 4)::int = c.year
       AND NOT (d.id = ANY (docs));
    counters := counters || jsonb_build_object('doc_type', c.doc_type, 'year', c.year, 'from', c.last_value, 'to', new_value);
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'would_remove', counts,
      'other_tables', others,
      'employees', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', trim(concat_ws(' ', e."firstName", e."lastName"))) ORDER BY e.id), '[]')
                      FROM public.employees e WHERE e.id = ANY (emps)),
      'logins', (SELECT coalesce(jsonb_agg(s.email ORDER BY s.email), '[]') FROM public.staff_users s WHERE s.id = ANY (logins)),
      'candidates', (SELECT coalesce(jsonb_agg(x.full_name ORDER BY x.full_name), '[]') FROM public.candidates x WHERE x.id = ANY (cands)),
      'counters', counters,
      'files', files);
  END IF;

  -- ── Remove (children first) ──────────────────────────────────────────────
  PERFORM set_config('app.uat_cleanup', 'on', true);
  PERFORM set_config('hr_docs.rpc', '1', true);   -- candidates_guard: offers on test candidates
  PERFORM set_config('leave.rpc', '1', true);

  DELETE FROM public.hr_notifications
   WHERE recipient_id = ANY (logins)
      OR EXISTS (SELECT 1 FROM unnest(emps) e WHERE hr_notifications.link = '/hr/employees?open=' || e);
  DELETE FROM public.recognition_records WHERE employee_id = ANY (emps);
  DELETE FROM public.disciplinary_records WHERE employee_id = ANY (emps);
  DELETE FROM public.contract_expiry_notices WHERE contract_id = ANY (contracts);
  UPDATE public.employment_contracts SET parent_contract_id = NULL WHERE id = ANY (contracts) AND parent_contract_id IS NOT NULL;
  DELETE FROM public.employment_contracts WHERE id = ANY (contracts);
  DELETE FROM public.attendance WHERE employee_id = ANY (emps);
  DELETE FROM public.leave_requests WHERE id = ANY (leave_ids);
  DELETE FROM public.leave_balances WHERE employee_id = ANY (emps);
  DELETE FROM public.hr_documents WHERE id = ANY (docs);
  DELETE FROM public.candidates WHERE id = ANY (cands);
  FOR fk IN SELECT x ->> 'table' AS tbl, x ->> 'column' AS col FROM jsonb_array_elements(others) x LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', fk.tbl, fk.col) USING emps;
  END LOOP;
  DELETE FROM auth.users WHERE id = ANY (logins);          -- staff_users rows go with them (ON DELETE CASCADE)
  DELETE FROM public.staff_users WHERE id = ANY (logins);  -- in case a row had no auth user
  DELETE FROM public.employees WHERE id = ANY (emps);

  FOR c IN SELECT * FROM jsonb_to_recordset(counters) AS t(doc_type text, year integer, "from" integer, "to" integer) LOOP
    UPDATE public.hr_document_counters SET last_value = c."to" WHERE doc_type = c.doc_type AND year = c.year;
  END LOOP;

  PERFORM set_config('leave.rpc', '', true);
  PERFORM set_config('hr_docs.rpc', '', true);
  PERFORM set_config('app.uat_cleanup', '', true);

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (NULL, 'uat.cleanup', 'employees', 'uat',
          jsonb_build_object('removed', counts, 'other_tables', others, 'counters', counters, 'files', files));

  RETURN jsonb_build_object('dry_run', false, 'removed', counts, 'other_tables', others, 'counters', counters, 'files', files);
END;
$$;

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.cleanup_uat_data(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_uat_data(boolean) TO service_role;
REVOKE ALL ON FUNCTION public.is_uat_employee(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_uat_candidate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_uat_employee(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_uat_candidate(uuid) TO authenticated;
