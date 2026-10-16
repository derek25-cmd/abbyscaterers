-- HR letters are exported, not stored.
--
-- Until now issuing a letter uploaded its PDF to the private hr-documents
-- bucket, and issue_hr_document() refused to issue without that file. Like
-- proforma invoices, invoices and delivery notes, the PDF is now built when it
-- is exported, from the record:
--
--   * issue_hr_document(id, content) saves the letter's final text (reference
--     number, date, addressee, subject, paragraphs, signatory, confidential) in
--     hr_documents.issued_content. It is frozen from then on: the same letter
--     exports with the same words every time, even if the employee's record or
--     the template changes later. The letterhead, signature and stamp images
--     come from the current settings, as they do for invoices.
--   * The old issue_hr_document(id, path, sha256) is removed.
--   * Nothing new is uploaded to hr-documents (the upload policy is dropped).
--     Files already there are left as they are, readable by HR roles.
--   * Letters issued before this change keep pdf_path/pdf_sha256; the app
--     exports them by rebuilding the letter from their template version.

ALTER TABLE public.hr_documents ADD COLUMN IF NOT EXISTS issued_content jsonb;

ALTER TABLE public.hr_documents DROP CONSTRAINT IF EXISTS hr_documents_issued_complete;
ALTER TABLE public.hr_documents ADD CONSTRAINT hr_documents_issued_complete
  CHECK (status <> 'issued' OR (ref_no IS NOT NULL AND issued_at IS NOT NULL
                                AND (issued_content IS NOT NULL OR pdf_path IS NOT NULL)));

-- ── The guard: issued_content is set only by issue_hr_document(). Same body as
-- 20261015000100 plus the lines marked "export, not stored".
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
    NEW.issued_content := NULL;                                                   -- export, not stored
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
    OR NEW.issued_content IS DISTINCT FROM OLD.issued_content                    -- export, not stored
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

-- ── Issue ──────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.issue_hr_document(uuid, text, text);

CREATE OR REPLACE FUNCTION public.issue_hr_document(p_id uuid, p_content jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
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

  -- The text that will be exported: complete, and carrying this letter's number.
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object'
     OR p_content ->> 'ref_no' IS DISTINCT FROM d.ref_no
     OR length(trim(coalesce(p_content ->> 'date', ''))) = 0
     OR length(trim(coalesce(p_content ->> 'subject', ''))) = 0
     OR jsonb_typeof(p_content -> 'addressee') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_content -> 'paragraphs') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_content -> 'paragraphs') = 0
     OR length(trim(coalesce(p_content #>> '{signatory,name}', ''))) = 0
     OR length(trim(coalesce(p_content #>> '{signatory,title}', ''))) = 0 THEN
    RAISE EXCEPTION 'The letter text is incomplete or does not carry this letter''s reference number.';
  END IF;
  PERFORM public.hr_doc_validate(d, 'issue');

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'issued', issued_content = p_content, issued_at = now()
   WHERE id = p_id RETURNING * INTO d;
  PERFORM public.hr_doc_apply_effects(d);
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d.ref_no;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_hr_document(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_hr_document(uuid, jsonb) TO authenticated;

-- ── Storage: nothing new is uploaded ───────────────────────────────────────
DROP POLICY IF EXISTS "hr_documents_storage_insert" ON storage.objects;
