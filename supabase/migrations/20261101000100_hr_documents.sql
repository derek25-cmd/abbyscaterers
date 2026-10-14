-- Phase 3: the shared HR documents engine — types, versioned templates, the
-- document register, reference-number counters and private file storage.
-- Phase 4 adds the seven letter types on top; nothing here changes then.
-- Depends on Phase 1 (can_manage_hr, set_updated_by, audit_row_change,
-- safe_auth_uid) and 20261101000000.
--
-- Access: only can_manage_hr() (admin, hr_manager, general_manager) can see or
-- touch any of this. staff and finance get nothing, from the tables or the
-- bucket. The lifecycle is enforced by the functions in 20261101000300, and the
-- triggers below make the rules hold even against a direct API call.

-- ── 1. Document types ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_document_types (
  doc_type text PRIMARY KEY,
  -- Three letters, used in the reference number: ALC/HR/<code>/<year>/<nnnn>.
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{3}$'),
  label text NOT NULL,
  -- true: the author cannot approve their own document (Phase 4 turns this on
  -- for termination and warning).
  requires_different_approver boolean NOT NULL DEFAULT false,
  -- Default for the CONFIDENTIAL footer on new documents of this type.
  confidential_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The full list now, so Phase 4 needs no constraint change.
INSERT INTO public.hr_document_types (doc_type, code, label, confidential_default) VALUES
  ('general_letter',         'GEN', 'General letter',         false),
  ('offer',                  'OFF', 'Offer letter',           true),
  ('contract',               'CON', 'Employment contract',    true),
  ('extension',              'EXT', 'Contract extension',     true),
  ('termination',            'TER', 'Termination letter',     true),
  ('warning',                'WRN', 'Warning letter',         true),
  ('recognition',            'REC', 'Letter of recognition',  false),
  ('certificate_of_service', 'COS', 'Certificate of service', false)
ON CONFLICT (doc_type) DO NOTHING;

-- ── 2. Templates (versioned) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL REFERENCES public.hr_document_types(doc_type) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version >= 1),
  title text NOT NULL,
  body text NOT NULL,
  -- Stamp app_settings.signature_url on the letter. Off by default: the
  -- signature block prints the approver's name and title for a wet signature.
  use_stored_signature boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_document_templates_version_key UNIQUE (doc_type, version)
);

-- At most one active version per type.
CREATE UNIQUE INDEX IF NOT EXISTS hr_document_templates_one_active
  ON public.hr_document_templates (doc_type) WHERE is_active;

-- ── 3. Documents ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null until a number is reserved for issue; unique, and never reused (the
  -- counter only goes up, and a void keeps its number).
  ref_no text UNIQUE,
  doc_type text NOT NULL REFERENCES public.hr_document_types(doc_type) ON DELETE RESTRICT,
  employee_id text REFERENCES public.employees(id) ON DELETE RESTRICT,
  -- Phase 4 creates `candidates` and adds the foreign key.
  candidate_id uuid,
  template_id uuid NOT NULL REFERENCES public.hr_document_templates(id) ON DELETE RESTRICT,
  template_version integer NOT NULL,
  subject text NOT NULL,
  -- The values the template placeholders are filled from. Frozen at approval.
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'issued', 'void')),
  return_note text,
  void_reason text,
  voided_by uuid,
  voided_at timestamptz,
  -- Who signs. Copied from the approver at approval, so a later change to that
  -- employee record cannot alter an approved or issued letter. The author may
  -- override both while the document is a draft.
  signatory_name text,
  signatory_title text,
  -- Storage path in the private hr-documents bucket and the SHA-256 (hex) of
  -- exactly those bytes, so a stored file can be checked against the record.
  pdf_path text,
  pdf_sha256 text CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'),
  confidential boolean NOT NULL DEFAULT false,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_documents_has_person CHECK (employee_id IS NOT NULL OR candidate_id IS NOT NULL),
  CONSTRAINT hr_documents_issued_complete
    CHECK (status <> 'issued' OR (ref_no IS NOT NULL AND pdf_path IS NOT NULL AND pdf_sha256 IS NOT NULL AND issued_at IS NOT NULL)),
  CONSTRAINT hr_documents_void_reason
    CHECK (status <> 'void' OR length(trim(coalesce(void_reason, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON public.hr_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_status ON public.hr_documents (status, created_at DESC);

-- ── 4. Reference counters ──────────────────────────────────────────────────
-- Numbering restarts each year per type. Deliberately NOT claim_ids(): that
-- function is executable by the anonymous role with any counter name, so
-- anyone holding the public key could burn letter numbers. This table has RLS
-- enabled and NO policies: it is reachable only through the SECURITY DEFINER
-- functions in 20261101000300.
CREATE TABLE IF NOT EXISTS public.hr_document_counters (
  doc_type text NOT NULL REFERENCES public.hr_document_types(doc_type) ON DELETE RESTRICT,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  last_value integer NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (doc_type, year)
);
ALTER TABLE public.hr_document_counters ENABLE ROW LEVEL SECURITY;

-- ── 5. Who/when columns, updated_by, audit ─────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hr_document_types', 'hr_document_templates', 'hr_documents']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT public.safe_auth_uid()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_at timestamptz', t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_by ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_by BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_by()', t);
  END LOOP;

  -- The counters are audited too (each issue moves one), but have no who/when
  -- columns: the document row records who issued it.
  FOREACH t IN ARRAY ARRAY['hr_document_types', 'hr_document_templates', 'hr_documents', 'hr_document_counters']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t
    );
  END LOOP;
END $$;

-- ── 6. RLS: HR roles only, for everything ──────────────────────────────────
DO $$
DECLARE
  t text;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['hr_document_types', 'hr_document_templates', 'hr_documents']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_manage_hr()) WITH CHECK (public.can_manage_hr())',
      t || '_hr_only', t
    );
  END LOOP;
END $$;

-- ── 7. Types: only the two settings are editable ───────────────────────────
CREATE OR REPLACE FUNCTION public.hr_document_types_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Document types cannot be deleted.';
  END IF;
  IF TG_OP = 'INSERT' THEN
    RETURN NEW; -- the list is seeded; Phase 4 adds none, but a migration may
  END IF;
  IF NEW.doc_type IS DISTINCT FROM OLD.doc_type OR NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'A document type''s name and code cannot be changed: they are part of issued reference numbers.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hr_document_types_guard ON public.hr_document_types;
CREATE TRIGGER hr_document_types_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.hr_document_types
  FOR EACH ROW EXECUTE FUNCTION public.hr_document_types_guard();

-- ── 8. Templates: a version never changes ──────────────────────────────────
-- Saving a template creates a NEW version (save_hr_template_version); the
-- wording an old document was built from must stay as it was.
CREATE OR REPLACE FUNCTION public.hr_document_templates_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.hr_documents d WHERE d.template_id = OLD.id) THEN
      RAISE EXCEPTION 'This template version is used by existing documents and cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.doc_type IS DISTINCT FROM OLD.doc_type OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.use_stored_signature IS DISTINCT FROM OLD.use_stored_signature THEN
    RAISE EXCEPTION 'A saved template version cannot be edited. Save a new version instead.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hr_document_templates_guard ON public.hr_document_templates;
CREATE TRIGGER hr_document_templates_guard
  BEFORE UPDATE OR DELETE ON public.hr_document_templates
  FOR EACH ROW EXECUTE FUNCTION public.hr_document_templates_guard();

-- ── 9. Documents: the lifecycle rules, enforced whoever the caller is ──────
-- A direct API write may only edit the CONTENT of a draft. Every lifecycle
-- column (status, ref_no, approval, issue, void, signatory-from-approver) moves
-- only inside the SECURITY DEFINER functions, which set the hr_docs.rpc flag.
-- Even then the rules below apply: allowed transitions only, an approved
-- document's content is frozen, an issued one accepts nothing but a void, and
-- a reference number never changes once set.
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

DROP TRIGGER IF EXISTS hr_documents_guard ON public.hr_documents;
CREATE TRIGGER hr_documents_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.hr_documents
  FOR EACH ROW EXECUTE FUNCTION public.hr_documents_guard();

-- ── 10. Private storage for the issued PDFs ────────────────────────────────
-- Not public, and never opened through getPublicUrl: only signed URLs, created
-- by an HR user. Objects are write-once: no UPDATE and no DELETE policy, so an
-- issued file cannot be replaced or removed through the API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('hr-documents', 'hr-documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "hr_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_storage_select" ON storage.objects;

CREATE POLICY "hr_documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents' AND public.can_manage_hr());

CREATE POLICY "hr_documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents' AND public.can_manage_hr());
