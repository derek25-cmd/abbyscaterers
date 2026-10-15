-- HR letters can be approved (or returned for changes) from the admin portal.
--
-- The admin portal signs people in with Clerk (portal_users), not with the HR
-- system's logins (staff_users), so the HR approval functions, which check
-- can_manage_hr(), do not recognise them. These functions are the portal's way
-- in, for portal users with the role super_admin or management:
--
--   portal_pending_hr_documents()          letters waiting for approval, with
--                                          the text as it will print
--   portal_approve_hr_document(id)         approve
--   portal_return_hr_document(id, note)    return to the author for changes
--
-- What the approver sees: the HR system saves a snapshot of the finished letter
-- (addressee, subject, paragraphs) in hr_documents.preview when it is sent for
-- approval. Like the rest of the content it is frozen once the letter leaves
-- draft, so the approver approves exactly what will be printed (the reference
-- number and the approver's name are added when it is issued).
--
-- The "someone other than the author must approve" rule (warnings,
-- terminations) works across both systems: the portal user and the author are
-- the same person when their email addresses match.
--
-- When a letter is sent for approval, the portal approvers get a portal
-- notification. Issuing (number, PDF, filing) stays in the HR system.
--
-- Depends on 20261015000000 (hr_employee_is_inactive) and Phases 3-4.

ALTER TABLE public.hr_documents
  ADD COLUMN IF NOT EXISTS preview jsonb,
  ADD COLUMN IF NOT EXISTS approved_by_portal text;   -- portal_users.id (Clerk) when approved in the portal

-- ── The guard: preview frozen, portal approver set only by the functions, and
-- no progress for someone who has left. Same body as 20261014002100 plus the
-- lines marked "Phase 6".
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
    NEW.approved_by_portal := NULL;                                               -- Phase 6
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
    OR NEW.preview IS DISTINCT FROM OLD.preview                                   -- Phase 6
  ) THEN
    RAISE EXCEPTION 'This document is no longer a draft, so its content is frozen. Return it to draft to edit it.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Phase 6: a letter for someone who has left cannot go forward (voiding still can).
    IF NEW.status IN ('pending_approval', 'approved', 'issued') AND NEW.employee_id IS NOT NULL
       AND public.hr_employee_is_inactive(NEW.employee_id) THEN
      RAISE EXCEPTION '% has left and their record is closed. Reactivate them (re-hire) before this letter can go forward.',
        coalesce(public.hr_employee_name(NEW.employee_id), NEW.employee_id);
    END IF;
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
    OR NEW.approved_by_portal IS DISTINCT FROM OLD.approved_by_portal            -- Phase 6
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
-- ── Who may approve in the portal ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_portal_hr_approver()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_portal_role(ARRAY['super_admin', 'management']);
$$;

-- ── Letters waiting for approval ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_pending_hr_documents()
RETURNS TABLE (
  id uuid, doc_type text, type_label text, subject text, person text, author_email text,
  written_at timestamptz, confidential boolean, needs_other_approver boolean, written_by_me boolean,
  preview jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_email text;
BEGIN
  IF NOT public.is_portal_hr_approver() THEN
    RAISE EXCEPTION 'Only portal super admins and management can approve HR letters.' USING ERRCODE = '42501';
  END IF;
  SELECT lower(email) INTO my_email FROM public.portal_users WHERE id = public.portal_uid();
  RETURN QUERY
    SELECT d.id, d.doc_type, t.label, d.subject,
           coalesce(public.hr_employee_name(d.employee_id), c.full_name, '—'),
           s.email, d.created_at, d.confidential, t.requires_different_approver,
           (lower(s.email) = my_email), d.preview
      FROM public.hr_documents d
      JOIN public.hr_document_types t ON t.doc_type = d.doc_type
      LEFT JOIN public.staff_users s ON s.id = d.created_by
      LEFT JOIN public.candidates c ON c.id = d.candidate_id
     WHERE d.status = 'pending_approval'
     ORDER BY d.created_at;
END;
$$;

-- ── Approve ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_approve_hr_document(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  pu public.portal_users%ROWTYPE;
  author_email text;
  needs_other boolean;
  staff_id uuid;
  derived_name text;
  derived_title text;
BEGIN
  IF NOT public.is_portal_hr_approver() THEN
    RAISE EXCEPTION 'Only portal super admins and management can approve HR letters.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO pu FROM public.portal_users WHERE id = public.portal_uid();
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Letter not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a letter waiting for approval can be approved. This one is %.', replace(d.status, '_', ' ');
  END IF;

  SELECT email INTO author_email FROM public.staff_users WHERE id = d.created_by;
  SELECT requires_different_approver INTO needs_other FROM public.hr_document_types WHERE doc_type = d.doc_type;
  IF needs_other AND lower(author_email) = lower(pu.email) THEN
    RAISE EXCEPTION 'This type of letter must be approved by someone other than the person who wrote it.';
  END IF;
  PERFORM public.hr_doc_validate(d, 'approve');

  -- The signatory: from the HR system's record of the same person (by email),
  -- otherwise the portal user's name and role.
  SELECT s.id, trim(concat_ws(' ', e."firstName", e."middleName", e."lastName")), nullif(trim(e.role), '')
    INTO staff_id, derived_name, derived_title
    FROM public.staff_users s LEFT JOIN public.employees e ON e.id = s.employee_id
   WHERE lower(s.email) = lower(pu.email) AND s.is_active
   LIMIT 1;
  derived_name := coalesce(nullif(derived_name, ''), nullif(trim(pu.full_name), ''), pu.email);
  derived_title := coalesce(derived_title, CASE pu.role WHEN 'super_admin' THEN 'Administrator' ELSE 'Management' END);

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'approved', approved_by = staff_id, approved_by_portal = pu.id, approved_at = now(),
         signatory_name = coalesce(nullif(trim(signatory_name), ''), derived_name),
         signatory_title = coalesce(nullif(trim(signatory_title), ''), derived_title)
   WHERE id = p_id RETURNING * INTO d;
  PERFORM set_config('hr_docs.rpc', '', true);

  IF d.created_by IS NOT NULL THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_approved', 'Document approved',
      format('%s was approved in the admin portal by %s and is ready to issue.', d.subject, coalesce(nullif(trim(pu.full_name), ''), pu.email)),
      '/hr/documents');
  END IF;
  -- The row audit cannot name a portal user (no HR login), so say who it was.
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (staff_id, 'hr_documents.portal_approve', 'hr_documents', d.id::text,
          jsonb_build_object('portal_user', pu.id, 'email', pu.email, 'name', pu.full_name, 'role', pu.role));
END;
$$;

-- ── Return for changes ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_return_hr_document(p_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  pu public.portal_users%ROWTYPE;
BEGIN
  IF NOT public.is_portal_hr_approver() THEN
    RAISE EXCEPTION 'Only portal super admins and management can return HR letters.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Say what needs to change, so the author knows.';
  END IF;
  SELECT * INTO pu FROM public.portal_users WHERE id = public.portal_uid();
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Letter not found.'; END IF;
  IF d.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only a letter waiting for approval can be returned. This one is %.', replace(d.status, '_', ' ');
  END IF;

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents SET status = 'draft', return_note = trim(p_note) WHERE id = p_id RETURNING * INTO d;
  PERFORM set_config('hr_docs.rpc', '', true);

  IF d.created_by IS NOT NULL THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_returned', 'Document returned for changes',
      format('%s was returned by %s: %s', d.subject, coalesce(nullif(trim(pu.full_name), ''), pu.email), trim(p_note)),
      '/hr/documents');
  END IF;
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (NULL, 'hr_documents.portal_return', 'hr_documents', d.id::text,
          jsonb_build_object('portal_user', pu.id, 'email', pu.email, 'name', pu.full_name, 'note', trim(p_note)));
END;
$$;

-- ── Tell the portal approvers when a letter is waiting ─────────────────────
CREATE OR REPLACE FUNCTION public.hr_documents_notify_portal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lbl text;
BEGIN
  IF NEW.status = 'pending_approval' AND OLD.status IS DISTINCT FROM 'pending_approval' THEN
    SELECT label INTO lbl FROM public.hr_document_types WHERE doc_type = NEW.doc_type;
    INSERT INTO public.portal_notifications (portal_user_id, type, title, body)
    SELECT pu.id, 'hr_letter_submitted', 'HR letter waiting for approval',
           format('%s: %s', coalesce(lbl, NEW.doc_type), NEW.subject)
      FROM public.portal_users pu
     WHERE pu.is_active AND pu.role IN ('super_admin', 'management');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS hr_documents_notify_portal ON public.hr_documents;
CREATE TRIGGER hr_documents_notify_portal
  AFTER UPDATE OF status ON public.hr_documents
  FOR EACH ROW EXECUTE FUNCTION public.hr_documents_notify_portal();

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.hr_documents_notify_portal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_portal_hr_approver() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_portal_hr_approver() TO authenticated;
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.portal_pending_hr_documents()',
    'public.portal_approve_hr_document(uuid)',
    'public.portal_return_hr_document(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
