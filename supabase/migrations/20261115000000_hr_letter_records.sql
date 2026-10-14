-- Phase 4: the records behind the seven HR letters.
--
-- A letter is evidence; the record is the history. Each issued letter creates
-- (or changes) exactly one record, linked back by `document_id UNIQUE`, so a
-- retried issue can never create a second one. Records are written ONLY by the
-- letter functions in 20261115000100 (and, for existing contracts, by
-- record_legacy_contract); HR reads them, nobody else does.
--
-- Depends on Phase 1 (can_manage_hr, set_updated_by, audit_row_change,
-- safe_auth_uid) and Phase 3 (hr_documents, hr_document_types).

-- ── 1. Candidates (job offers) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  phone text,
  email text,
  address text,
  position text,
  department text,
  proposed_salary numeric(14,2) CHECK (proposed_salary IS NULL OR proposed_salary >= 0),
  proposed_start_date date,
  notes text,
  offer_status text NOT NULL DEFAULT 'none'
    CHECK (offer_status IN ('none', 'offered', 'accepted', 'declined', 'expired', 'withdrawn')),
  offer_document_id uuid REFERENCES public.hr_documents(id) ON DELETE SET NULL,
  responded_at date,
  -- Set when the candidate is converted into an employee record.
  employee_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- hr_documents.candidate_id was created in Phase 3 without its foreign key.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_documents_candidate_id_fkey') THEN
    ALTER TABLE public.hr_documents
      ADD CONSTRAINT hr_documents_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ── 2. Employment contracts (the contract chain) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.employment_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  contract_type text NOT NULL CHECK (contract_type IN ('permanent', 'fixed_term', 'probation', 'casual')),
  start_date date NOT NULL,
  end_date date,
  position text,
  salary numeric(14,2) CHECK (salary IS NULL OR salary >= 0),
  probation_months integer CHECK (probation_months IS NULL OR probation_months >= 0),
  notice_days integer CHECK (notice_days IS NULL OR notice_days >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'extended', 'terminated', 'expired', 'void')),
  -- An extension points at the contract it extends; the chain is followed this way.
  parent_contract_id uuid REFERENCES public.employment_contracts(id) ON DELETE RESTRICT,
  -- The letter that created it. Null only for contracts recorded as legacy.
  document_id uuid UNIQUE REFERENCES public.hr_documents(id) ON DELETE RESTRICT,
  source text NOT NULL DEFAULT 'letter' CHECK (source IN ('letter', 'legacy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employment_contracts_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT employment_contracts_end_unless_permanent CHECK (contract_type = 'permanent' OR end_date IS NOT NULL),
  CONSTRAINT employment_contracts_letter_has_document CHECK (source = 'legacy' OR document_id IS NOT NULL)
);

-- At most one active contract per employee.
CREATE UNIQUE INDEX IF NOT EXISTS employment_contracts_one_active
  ON public.employment_contracts (employee_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_employment_contracts_end ON public.employment_contracts (end_date) WHERE status = 'active';

-- ── 3. Disciplinary records (warnings) — confidential ──────────────────────
CREATE TABLE IF NOT EXISTS public.disciplinary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  level text NOT NULL CHECK (level IN ('verbal', 'first_written', 'final_written')),
  offence_category text NOT NULL,
  incident_date date NOT NULL,
  expires_on date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'void')),
  document_id uuid NOT NULL UNIQUE REFERENCES public.hr_documents(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_records_dates CHECK (expires_on >= incident_date)
);
CREATE INDEX IF NOT EXISTS idx_disciplinary_employee ON public.disciplinary_records (employee_id, status);

-- ── 4. Recognition records (rewards) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recognition_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('performance', 'long_service', 'conduct', 'customer_praise', 'other')),
  reward_type text NOT NULL CHECK (reward_type IN ('none', 'cash', 'voucher', 'gift', 'time_off')),
  amount numeric(14,2) CHECK (amount IS NULL OR amount >= 0),
  -- Payroll is not changed automatically: cash rewards wait here until finance
  -- or HR records which payroll paid them.
  payroll_status text NOT NULL DEFAULT 'not_applicable' CHECK (payroll_status IN ('not_applicable', 'pending', 'paid')),
  paid_in_payroll_id text REFERENCES public.payroll(id) ON DELETE RESTRICT,
  -- Voiding the letter voids the record (the brief lists no status column; one
  -- is needed so a voided reward stops showing as pending).
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  document_id uuid NOT NULL UNIQUE REFERENCES public.hr_documents(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recognition_cash_has_amount CHECK (reward_type <> 'cash' OR (amount IS NOT NULL AND amount > 0)),
  CONSTRAINT recognition_paid_has_payroll CHECK (payroll_status <> 'paid' OR paid_in_payroll_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_recognition_pending ON public.recognition_records (payroll_status) WHERE payroll_status = 'pending';

-- ── 5. Contract-expiry reminders already sent ──────────────────────────────
-- One row per (contract, threshold): 60, 30, 7 days before, and 0 = overdue.
CREATE TABLE IF NOT EXISTS public.contract_expiry_notices (
  contract_id uuid NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
  threshold_days integer NOT NULL CHECK (threshold_days IN (0, 7, 30, 60)),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contract_id, threshold_days)
);

-- ── 6. Who/when columns, updated_by, audit ─────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['candidates', 'employment_contracts', 'disciplinary_records', 'recognition_records']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT public.safe_auth_uid()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_at timestamptz', t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_by ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_by BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_by()', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['candidates', 'employment_contracts', 'disciplinary_records', 'recognition_records', 'contract_expiry_notices']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t
    );
  END LOOP;
END $$;

-- ── 7. RLS: HR roles only ──────────────────────────────────────────────────
-- staff and finance read nothing here; disciplinary records in particular are
-- confidential. Finance sees pending cash rewards only through
-- pending_cash_rewards(), which returns a few columns and nothing else.
DO $$
DECLARE
  t text;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['candidates', 'employment_contracts', 'disciplinary_records', 'recognition_records', 'contract_expiry_notices']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- Reads for HR. Contracts, warnings, rewards and notices are written only by
    -- the SECURITY DEFINER functions, so HR gets no direct write policy on them;
    -- candidates are ordinary records HR keeps by hand.
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_manage_hr())', t || '_hr_select', t);
    IF t = 'candidates' THEN
      EXECUTE 'CREATE POLICY candidates_hr_insert ON public.candidates FOR INSERT TO authenticated WITH CHECK (public.can_manage_hr())';
      EXECUTE 'CREATE POLICY candidates_hr_update ON public.candidates FOR UPDATE TO authenticated USING (public.can_manage_hr()) WITH CHECK (public.can_manage_hr())';
      EXECUTE 'CREATE POLICY candidates_hr_delete ON public.candidates FOR DELETE TO authenticated USING (public.can_manage_hr())';
    END IF;
  END LOOP;
END $$;

-- A candidate's offer status moves only through the offer letter and
-- respond_to_offer(); editing the candidate by hand must not fake an offer.
CREATE OR REPLACE FUNCTION public.candidates_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('hr_docs.rpc', true), '') = '1' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.offer_status := 'none'; NEW.offer_document_id := NULL; NEW.responded_at := NULL; NEW.employee_id := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.offer_status <> 'none' OR OLD.offer_document_id IS NOT NULL OR OLD.employee_id IS NOT NULL THEN
      RAISE EXCEPTION 'This candidate has an offer or an employee record on file and cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.offer_status IS DISTINCT FROM OLD.offer_status OR NEW.offer_document_id IS DISTINCT FROM OLD.offer_document_id
     OR NEW.responded_at IS DISTINCT FROM OLD.responded_at THEN
    RAISE EXCEPTION 'The offer status changes only through the offer letter and Record response.';
  END IF;
  -- Linking to an employee happens once, on conversion, after acceptance.
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    IF OLD.employee_id IS NOT NULL THEN
      RAISE EXCEPTION 'This candidate is already linked to an employee record.';
    END IF;
    IF OLD.offer_status <> 'accepted' THEN
      RAISE EXCEPTION 'Only a candidate who has accepted an offer can be converted into an employee.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidates_guard ON public.candidates;
CREATE TRIGGER candidates_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.candidates_guard();

-- ── 8. Approval settings for the letter types ──────────────────────────────
UPDATE public.hr_document_types
   SET requires_different_approver = (doc_type IN ('termination', 'warning')),
       confidential_default = (doc_type IN ('termination', 'warning'))
 WHERE doc_type IN ('offer', 'contract', 'extension', 'termination', 'warning', 'recognition', 'certificate_of_service');

-- ── 9. Audit: mask money; HR Manager can read the new tables ───────────────
-- Same body as 20261101000200, with three more mask entries. Every earlier
-- mask is kept exactly as it was.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- table -> columns recorded as "changed", never as a value. '*' applies to
  -- every audited table (the Phase 1 list); add a table's own entry to extend.
  mask_map  constant jsonb := '{
    "*": ["nationalId", "tin", "bankAccountNumber", "monthlySalary"],
    "hr_documents": ["data"],
    "candidates": ["proposed_salary"],
    "employment_contracts": ["salary"],
    "recognition_records": ["amount"]
  }'::jsonb;
  masked    text[] := ARRAY(SELECT jsonb_array_elements_text(mask_map -> '*'))
                      || COALESCE(ARRAY(SELECT jsonb_array_elements_text(mask_map -> TG_TABLE_NAME)), ARRAY[]::text[]);
  -- Bookkeeping columns that change on every write; logging them would make
  -- every update look like it changed something.
  noise     constant text[] := ARRAY['updated_by', 'updatedAt', 'updated_at'];
  old_j     jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  new_j     jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  changed   text[];
  op        text := lower(TG_OP);
  rec_id    text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(k ORDER BY k) INTO changed FROM jsonb_object_keys(new_j) k WHERE k <> ALL (noise);
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(k ORDER BY k) INTO changed FROM jsonb_object_keys(old_j) k WHERE k <> ALL (noise);
  ELSE
    SELECT array_agg(k ORDER BY k) INTO changed
    FROM jsonb_object_keys(new_j) k
    WHERE k <> ALL (noise) AND new_j -> k IS DISTINCT FROM old_j -> k;

    -- An UPDATE that only touched bookkeeping columns is not worth a row.
    IF changed IS NULL THEN
      RETURN NULL;
    END IF;

    -- Approvals get their own action so they can be filtered on.
    IF old_j ->> 'approved_at' IS NULL AND new_j ->> 'approved_at' IS NOT NULL THEN
      op := 'approve';
    END IF;
  END IF;

  -- The record's id; for tables keyed differently, its key ("type", "type/year"
  -- or, for reminder notices, "contract/threshold").
  rec_id := COALESCE(
    new_j ->> 'id', old_j ->> 'id',
    NULLIF(concat_ws('/', COALESCE(new_j ->> 'doc_type', old_j ->> 'doc_type'), COALESCE(new_j ->> 'year', old_j ->> 'year')), ''),
    NULLIF(concat_ws('/', COALESCE(new_j ->> 'contract_id', old_j ->> 'contract_id'), COALESCE(new_j ->> 'threshold_days', old_j ->> 'threshold_days')), '')
  );

  -- Strip masked values from the snapshots (keys stay in changed_fields).
  old_j := old_j - masked;
  new_j := new_j - masked;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (
    public.safe_auth_uid(),
    TG_TABLE_NAME || '.' || op,
    TG_TABLE_NAME,
    rec_id,
    jsonb_build_object('old', old_j, 'new', new_j, 'changed_fields', COALESCE(to_jsonb(changed), '[]'::jsonb))
  );
  RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS audit_log_select_hr ON public.audit_log;
CREATE POLICY audit_log_select_hr ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_staff_role(ARRAY['hr_manager'])
    AND table_name IN (
      'employees', 'attendance', 'positions', 'training_participants',
      'training_evaluations', 'payroll',
      'leave_requests', 'leave_balances', 'leave_types', 'leave_settings', 'public_holidays',
      'hr_document_types', 'hr_document_templates', 'hr_documents', 'hr_document_counters',
      'candidates', 'employment_contracts', 'disciplinary_records', 'recognition_records', 'contract_expiry_notices'
    )
  );

-- ── 10. "Update to latest": a draft may switch to a newer template version ─
-- Same body as the Phase 3 guard (20261101000100) plus one rule: when a DRAFT's
-- template changes, its recorded version is re-read from that template (and the
-- template must belong to the same type), exactly as on insert. Everything else
-- is unchanged.
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
