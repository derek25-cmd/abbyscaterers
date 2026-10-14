-- Phase 3: the document lifecycle, as functions.
--   draft -> pending_approval -> approved -> issued          (any state but issued -> void)
--   pending_approval -> draft (returned with a note);  issued -> void only
-- Depends on 20261101000100 (tables and guards) and Phase 2 (notify_user).
--
-- Every function is SECURITY DEFINER with a fixed search_path, checks that the
-- caller can_manage_hr(), and runs as one transaction. They set the
-- hr_docs.rpc flag that lets the guard trigger on hr_documents accept a
-- lifecycle change; the flag is cleared before returning.
--
-- Issuing a letter is a three-step conversation with the browser, designed so a
-- failure part-way never leaves an issued row without a file:
--   1. reserve_hr_document_ref(id)   -> the number to print on the PDF (stored on
--                                       the still-'approved' row; asking again
--                                       returns the same number)
--   2. the browser builds the PDF and uploads it to the private bucket
--   3. issue_hr_document(id, path, sha256) -> checks the file really exists at
--                                       the expected path, then marks it issued

-- ── Helper: tell every other approver ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_doc_notify_approvers(p_exclude uuid, p_type text, p_title text, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r uuid;
BEGIN
  FOR r IN
    SELECT s.id FROM public.staff_users s
    WHERE s.is_active AND s.role IN ('admin', 'hr_manager', 'general_manager')
      AND s.id IS DISTINCT FROM p_exclude
  LOOP
    PERFORM public.notify_user(r, p_type, p_title, p_body, '/hr/documents');
  END LOOP;
END;
$$;

-- ── Submit ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_hr_document(p_id uuid)
RETURNS public.hr_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
  lbl text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft can be sent for approval. This document is %.', replace(d.status, '_', ' ');
  END IF;
  IF length(trim(coalesce(d.subject, ''))) = 0 THEN
    RAISE EXCEPTION 'Add a subject before sending the document for approval.';
  END IF;

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET status = 'pending_approval', return_note = NULL
   WHERE id = p_id RETURNING * INTO d;

  SELECT label INTO lbl FROM public.hr_document_types WHERE doc_type = d.doc_type;
  PERFORM public.hr_doc_notify_approvers(me, 'hr_document_submitted', 'Document waiting for approval',
    format('%s: %s', lbl, d.subject));
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;

-- ── Return to draft ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.return_hr_document(p_id uuid, p_note text)
RETURNS public.hr_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Please say what needs to change, so the author knows what to fix.';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a document waiting for approval can be returned. This document is %.', replace(d.status, '_', ' ');
  END IF;

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET status = 'draft', return_note = trim(p_note)
   WHERE id = p_id RETURNING * INTO d;

  IF d.created_by IS NOT NULL AND d.created_by IS DISTINCT FROM me THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_returned', 'Document returned for changes',
      format('%s: %s', d.subject, trim(p_note)), '/hr/documents');
  END IF;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;

-- ── Approve ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_hr_document(p_id uuid)
RETURNS public.hr_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
  needs_other boolean;
  derived_name text;
  derived_title text;
  my_role text;
  role_label text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can approve HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a document waiting for approval can be approved. This document is %.', replace(d.status, '_', ' ');
  END IF;

  SELECT requires_different_approver INTO needs_other FROM public.hr_document_types WHERE doc_type = d.doc_type;
  IF needs_other AND d.created_by = me THEN
    RAISE EXCEPTION 'This type of document must be approved by someone other than the person who wrote it.';
  END IF;

  -- The signatory is fixed now, from the approver, unless the author set one
  -- by hand on the draft. Snapshot, so editing the employee later cannot
  -- change an approved or issued letter.
  SELECT s.role INTO my_role FROM public.staff_users s WHERE s.id = me;
  role_label := CASE my_role
    WHEN 'hr_manager' THEN 'HR Manager' WHEN 'general_manager' THEN 'General Manager'
    WHEN 'admin' THEN 'Administrator' ELSE initcap(replace(coalesce(my_role, ''), '_', ' ')) END;

  SELECT trim(concat_ws(' ', e."firstName", e."middleName", e."lastName")), nullif(trim(e.role), '')
    INTO derived_name, derived_title
    FROM public.staff_users s JOIN public.employees e ON e.id = s.employee_id
   WHERE s.id = me;
  derived_name := coalesce(nullif(derived_name, ''), (SELECT email FROM public.staff_users WHERE id = me));
  derived_title := coalesce(derived_title, role_label);

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'approved', approved_by = me, approved_at = now(),
         signatory_name = coalesce(nullif(trim(signatory_name), ''), derived_name),
         signatory_title = coalesce(nullif(trim(signatory_title), ''), derived_title)
   WHERE id = p_id RETURNING * INTO d;

  IF d.created_by IS NOT NULL AND d.created_by IS DISTINCT FROM me THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_approved', 'Document approved',
      format('%s is approved and ready to issue.', d.subject), '/hr/documents');
  END IF;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;

-- ── Reserve the reference number ───────────────────────────────────────────
-- Idempotent: the first call claims the next number for this type and year and
-- stores it on the approved document; every later call returns the same one, so
-- the number printed on the PDF is always the number on record. The counter is
-- incremented in a single INSERT ... ON CONFLICT DO UPDATE, so two people issuing
-- at once cannot receive the same number. Year is in Dar es Salaam time.
CREATE OR REPLACE FUNCTION public.reserve_hr_document_ref(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  type_code text;
  yr integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Africa/Dar_es_Salaam'))::integer;
  n integer;
  ref text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'approved' THEN
    RAISE EXCEPTION 'A reference number is only given to an approved document. This document is %.', replace(d.status, '_', ' ');
  END IF;
  IF d.ref_no IS NOT NULL THEN
    RETURN d.ref_no;
  END IF;

  SELECT code INTO type_code FROM public.hr_document_types WHERE doc_type = d.doc_type;
  INSERT INTO public.hr_document_counters (doc_type, year, last_value) VALUES (d.doc_type, yr, 1)
  ON CONFLICT (doc_type, year) DO UPDATE SET last_value = public.hr_document_counters.last_value + 1
  RETURNING last_value INTO n;

  -- At least four digits; never truncate once a year passes 9999.
  ref := format('ALC/HR/%s/%s/%s', type_code, yr, repeat('0', greatest(4 - length(n::text), 0)) || n::text);

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET ref_no = ref WHERE id = p_id;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN ref;
END;
$$;

-- ── Issue ──────────────────────────────────────────────────────────────────
-- Refuses unless the PDF is actually in the bucket at the one path this
-- document's reference number dictates, so "issued" always means "a file exists".
CREATE OR REPLACE FUNCTION public.issue_hr_document(p_id uuid, p_pdf_path text, p_pdf_sha256 text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  expected text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can issue HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved document can be issued. This document is %.', replace(d.status, '_', ' ');
  END IF;
  IF d.ref_no IS NULL THEN
    RAISE EXCEPTION 'No reference number has been reserved for this document yet.';
  END IF;

  expected := CASE WHEN d.employee_id IS NOT NULL THEN d.employee_id ELSE 'candidate-' || d.candidate_id::text END
              || '/' || replace(d.ref_no, '/', '_') || '.pdf';
  IF p_pdf_path IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'The file path does not match this document''s reference number.';
  END IF;
  IF p_pdf_sha256 IS NULL OR p_pdf_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'The file checksum is missing or not valid.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'hr-documents' AND name = p_pdf_path) THEN
    RAISE EXCEPTION 'The PDF has not been uploaded yet, so the document cannot be issued.';
  END IF;

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'issued', pdf_path = p_pdf_path, pdf_sha256 = p_pdf_sha256, issued_at = now()
   WHERE id = p_id;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d.ref_no;
END;
$$;

-- ── Void ───────────────────────────────────────────────────────────────────
-- Any document that is not already void, including an issued one (which is then
-- reissued as a new document). A void keeps its number: the register accounts
-- for every number in the series.
CREATE OR REPLACE FUNCTION public.void_hr_document(p_id uuid, p_reason text)
RETURNS public.hr_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can void HR documents.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Please give a reason for voiding this document.';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  IF d.status = 'void' THEN RAISE EXCEPTION 'This document is already void.'; END IF;

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'void', void_reason = trim(p_reason), voided_by = me, voided_at = now()
   WHERE id = p_id RETURNING * INTO d;

  IF d.created_by IS NOT NULL AND d.created_by IS DISTINCT FROM me THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_void', 'Document voided',
      format('%s was voided: %s', d.subject, trim(p_reason)), '/hr/documents');
  END IF;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;

-- ── Save a template as a new version ───────────────────────────────────────
-- One transaction: the previous active version is switched off and the new one
-- switched on, so there is never a moment with two active versions or none.
-- Existing documents keep the version they were built from.
CREATE OR REPLACE FUNCTION public.save_hr_template_version(
  p_doc_type text, p_title text, p_body text, p_use_stored_signature boolean DEFAULT false
)
RETURNS public.hr_document_templates LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.hr_document_templates%ROWTYPE;
  next_version integer;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can edit HR templates.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_title, ''))) = 0 OR length(trim(coalesce(p_body, ''))) = 0 THEN
    RAISE EXCEPTION 'A template needs a title and some text.';
  END IF;
  -- Serialise concurrent saves for the same type.
  PERFORM 1 FROM public.hr_document_types WHERE doc_type = p_doc_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown document type.'; END IF;

  SELECT coalesce(max(version), 0) + 1 INTO next_version FROM public.hr_document_templates WHERE doc_type = p_doc_type;
  UPDATE public.hr_document_templates SET is_active = false WHERE doc_type = p_doc_type AND is_active;
  INSERT INTO public.hr_document_templates (doc_type, version, title, body, use_stored_signature, is_active)
  VALUES (p_doc_type, next_version, trim(p_title), p_body, coalesce(p_use_stored_signature, false), true)
  RETURNING * INTO t;
  RETURN t;
END;
$$;

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.hr_doc_notify_approvers(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_hr_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_hr_document(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_hr_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_hr_document_ref(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_hr_document(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_hr_document(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_hr_template_version(text, text, text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_hr_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_hr_document(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_hr_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_hr_document_ref(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_hr_document(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_hr_document(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_hr_template_version(text, text, text, boolean) TO authenticated;
