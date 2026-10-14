-- Phase 4: what each letter DOES, enforced in the database.
--
--   hr_doc_validate(doc, stage)   type-specific checks, run at submit, approve
--                                 and issue (and before a number is reserved)
--   hr_doc_apply_effects(doc)     the record changes of an issued letter, in the
--                                 SAME transaction as the issue
--   hr_doc_void_effects(doc)      what voiding an ISSUED letter undoes
--
-- submit/approve/issue/void are redefined here with the same signatures and the
-- same Phase 3 behaviour, plus these calls. Effects are idempotent: every record
-- carries document_id UNIQUE, and each effect checks for it first, so a retried
-- issue can never create a second record.
--
-- Depends on 20261115000000 (records) and Phases 1-3.

-- ── Small helpers ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_today()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
$$;

-- The line every seeded template starts with. While a letter's template still
-- contains it, the letter cannot be sent, approved or issued.
CREATE OR REPLACE FUNCTION public.hr_doc_draft_marker()
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'DRAFT TEMPLATE — HR Manager to replace this wording before use.'::text;
$$;

-- Typed reads from a letter's data, with messages HR can act on.
CREATE OR REPLACE FUNCTION public.hr_doc_date(p_data jsonb, p_key text, p_label text, p_required boolean DEFAULT true)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := nullif(trim(coalesce(p_data ->> p_key, '')), '');
BEGIN
  IF v IS NULL THEN
    IF p_required THEN RAISE EXCEPTION '% is missing.', p_label; END IF;
    RETURN NULL;
  END IF;
  RETURN v::date;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION '% is not a valid date.', p_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_doc_num(p_data jsonb, p_key text, p_label text, p_required boolean DEFAULT true)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := nullif(trim(coalesce(p_data ->> p_key, '')), '');
BEGIN
  IF v IS NULL THEN
    IF p_required THEN RAISE EXCEPTION '% is missing.', p_label; END IF;
    RETURN NULL;
  END IF;
  RETURN v::numeric;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION '% is not a number.', p_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_doc_text(p_data jsonb, p_key text, p_label text, p_required boolean DEFAULT true)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := nullif(trim(coalesce(p_data ->> p_key, '')), '');
BEGIN
  IF v IS NULL AND p_required THEN RAISE EXCEPTION '% is missing.', p_label; END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_employee_name(p_employee text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT trim(concat_ws(' ', e."firstName", e."lastName")) FROM public.employees e WHERE e.id = p_employee;
$$;

-- ── Validation ─────────────────────────────────────────────────────────────
-- stage: 'submit' | 'approve' | 'issue'. The same rules apply at every stage, so
-- a problem is caught as early as possible and checked again just before issue.
CREATE OR REPLACE FUNCTION public.hr_doc_validate(d public.hr_documents, p_stage text DEFAULT 'issue')
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tpl_body text;
  emp public.employees%ROWTYPE;
  cand public.candidates%ROWTYPE;
  k public.employment_contracts%ROWTYPE;
  v_type text; v_start date; v_end date; v_date date; v_date2 date; v_num numeric;
  w text;
BEGIN
  -- A letter written from draft template wording never goes further.
  SELECT body INTO tpl_body FROM public.hr_document_templates WHERE id = d.template_id;
  IF position(public.hr_doc_draft_marker() IN coalesce(tpl_body, '')) > 0 THEN
    RAISE EXCEPTION 'This letter was written from a DRAFT template. Ask the HR Manager to save the final wording under Templates, then use "Update to latest" on this letter.';
  END IF;

  IF d.doc_type = 'general_letter' THEN
    RETURN; -- unchanged from Phase 3
  END IF;

  -- ── Offer: for a candidate ──────────────────────────────────────────────
  IF d.doc_type = 'offer' THEN
    IF d.candidate_id IS NULL OR d.employee_id IS NOT NULL THEN
      RAISE EXCEPTION 'An offer letter is written for a candidate, not an employee.';
    END IF;
    SELECT * INTO cand FROM public.candidates WHERE id = d.candidate_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The candidate for this offer no longer exists.'; END IF;
    IF cand.employee_id IS NOT NULL THEN
      RAISE EXCEPTION '% is already an employee.', cand.full_name;
    END IF;
    IF cand.offer_status IN ('offered', 'accepted') AND cand.offer_document_id IS DISTINCT FROM d.id THEN
      RAISE EXCEPTION '% already has an offer that is open or accepted. Record the response to it (or void it) first.', cand.full_name;
    END IF;
    PERFORM public.hr_doc_text(d.data, 'position', 'The position');
    v_num := public.hr_doc_num(d.data, 'salary', 'The salary');
    IF v_num <= 0 THEN RAISE EXCEPTION 'The salary must be more than zero.'; END IF;
    PERFORM public.hr_doc_date(d.data, 'startDate', 'The start date');
    v_date := public.hr_doc_date(d.data, 'acceptanceDeadline', 'The acceptance deadline');
    IF p_stage = 'issue' AND v_date < public.hr_today() THEN
      RAISE EXCEPTION 'The acceptance deadline (%) has passed. Return the letter to draft and set a new one.', v_date;
    END IF;
    RETURN;
  END IF;

  -- ── Everything else: for an employee ────────────────────────────────────
  IF d.employee_id IS NULL OR d.candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'This letter is written for an employee.';
  END IF;
  SELECT * INTO emp FROM public.employees WHERE id = d.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The employee for this letter no longer exists.'; END IF;

  IF d.doc_type = 'certificate_of_service' THEN
    IF emp.status <> 'Inactive' OR emp."employmentEndDate" IS NULL THEN
      RAISE EXCEPTION 'A certificate of service is for someone whose employment has ended. % is still Active or has no end date.', public.hr_employee_name(emp.id);
    END IF;
    RETURN;
  END IF;

  IF emp.status <> 'Active' THEN
    RAISE EXCEPTION '% is not an active employee.', public.hr_employee_name(emp.id);
  END IF;

  IF d.doc_type = 'contract' THEN
    v_type := public.hr_doc_text(d.data, 'contractType', 'The contract type');
    IF v_type NOT IN ('permanent', 'fixed_term', 'probation', 'casual') THEN RAISE EXCEPTION 'Unknown contract type.'; END IF;
    v_start := public.hr_doc_date(d.data, 'startDate', 'The start date');
    v_end := public.hr_doc_date(d.data, 'endDate', 'The end date', v_type <> 'permanent');
    IF v_end IS NOT NULL AND v_end < v_start THEN RAISE EXCEPTION 'The end date cannot be before the start date.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'position', 'The position');
    v_num := public.hr_doc_num(d.data, 'salary', 'The salary');
    IF v_num < 0 THEN RAISE EXCEPTION 'The salary cannot be negative.'; END IF;
    IF EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = emp.id AND status = 'active') THEN
      RAISE EXCEPTION '% already has an active contract. Extend it, or let it end, before issuing a new one.', public.hr_employee_name(emp.id);
    END IF;

  ELSIF d.doc_type = 'extension' THEN
    BEGIN
      SELECT * INTO k FROM public.employment_contracts WHERE id = (d.data ->> 'contractId')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Choose the contract being extended.';
    END;
    IF k.id IS NULL OR k.employee_id <> emp.id THEN RAISE EXCEPTION 'Choose one of this employee''s contracts to extend.'; END IF;
    IF k.status <> 'active' THEN RAISE EXCEPTION 'The contract being extended is no longer active (it is %).', k.status; END IF;
    IF k.end_date IS NULL THEN RAISE EXCEPTION 'A permanent contract has no end date to extend.'; END IF;
    v_end := public.hr_doc_date(d.data, 'newEndDate', 'The new end date');
    IF v_end <= k.end_date THEN RAISE EXCEPTION 'The new end date must be after the current end date (%).', k.end_date; END IF;
    v_num := public.hr_doc_num(d.data, 'newSalary', 'The new salary', false);
    IF v_num IS NOT NULL AND v_num < 0 THEN RAISE EXCEPTION 'The new salary cannot be negative.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'reason', 'The reason');

  ELSIF d.doc_type = 'termination' THEN
    v_type := public.hr_doc_text(d.data, 'terminationType', 'The type of termination');
    IF v_type NOT IN ('resignation', 'end_of_contract', 'misconduct', 'poor_performance', 'redundancy', 'mutual_agreement', 'other') THEN
      RAISE EXCEPTION 'Unknown type of termination.';
    END IF;
    v_date := public.hr_doc_date(d.data, 'noticeDate', 'The notice date');
    v_date2 := public.hr_doc_date(d.data, 'lastWorkingDay', 'The last working day');
    IF v_date2 < v_date THEN RAISE EXCEPTION 'The last working day cannot be before the notice date.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'reason', 'The reason');
    IF jsonb_typeof(d.data -> 'warningIds') = 'array' THEN
      FOR w IN SELECT jsonb_array_elements_text(d.data -> 'warningIds') LOOP
        IF NOT EXISTS (SELECT 1 FROM public.disciplinary_records r WHERE r.id::text = w AND r.employee_id = emp.id AND r.status <> 'void') THEN
          RAISE EXCEPTION 'One of the linked warnings does not belong to this employee or has been voided.';
        END IF;
      END LOOP;
    END IF;

  ELSIF d.doc_type = 'warning' THEN
    v_type := public.hr_doc_text(d.data, 'level', 'The warning level');
    IF v_type NOT IN ('verbal', 'first_written', 'final_written') THEN RAISE EXCEPTION 'Unknown warning level.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'offenceCategory', 'The offence category');
    v_date := public.hr_doc_date(d.data, 'incidentDate', 'The incident date');
    IF v_date > public.hr_today() THEN RAISE EXCEPTION 'The incident date cannot be in the future.'; END IF;
    v_date2 := public.hr_doc_date(d.data, 'expiresOn', 'The expiry date', false);
    IF v_date2 IS NOT NULL AND v_date2 < v_date THEN RAISE EXCEPTION 'The warning cannot expire before the incident date.'; END IF;
    PERFORM public.hr_doc_text(d.data, 'description', 'The description');

  ELSIF d.doc_type = 'recognition' THEN
    v_type := public.hr_doc_text(d.data, 'category', 'The category');
    IF v_type NOT IN ('performance', 'long_service', 'conduct', 'customer_praise', 'other') THEN RAISE EXCEPTION 'Unknown recognition category.'; END IF;
    v_type := public.hr_doc_text(d.data, 'rewardType', 'The reward type');
    IF v_type NOT IN ('none', 'cash', 'voucher', 'gift', 'time_off') THEN RAISE EXCEPTION 'Unknown reward type.'; END IF;
    IF v_type = 'cash' THEN
      v_num := public.hr_doc_num(d.data, 'amount', 'The cash amount');
      IF v_num <= 0 THEN RAISE EXCEPTION 'A cash reward needs an amount above zero.'; END IF;
    END IF;
    PERFORM public.hr_doc_text(d.data, 'reason', 'The reason');
  END IF;
END;
$$;

-- ── Ending employment (termination letter, or "without a letter") ─────────
-- One place does it all, so both paths behave the same: the employee becomes
-- Inactive with an end date and reason, their active contract is terminated, and
-- leave after the last working day is cancelled (approved leave gives its days
-- back and loses its attendance rows; leave that straddles the last day is cut
-- short; pending requests are cancelled). Returns a list of what changed.
CREATE OR REPLACE FUNCTION public.hr_end_employment(p_employee text, p_last_day date, p_reason text)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changes text[] := '{}';
  r public.leave_requests%ROWTYPE;
  lt public.leave_types%ROWTYPE;
  k public.employment_contracts%ROWTYPE;
  new_days numeric;
  me uuid := public.safe_auth_uid();
  note text := 'Employment ended ' || to_char(p_last_day, 'FMDD Mon YYYY');
BEGIN
  PERFORM set_config('app.hr_ending_employment', 'on', true);
  UPDATE public.employees
     SET status = 'Inactive', "employmentEndDate" = p_last_day, "employmentEndReason" = p_reason
   WHERE id = p_employee;
  PERFORM set_config('app.hr_ending_employment', '', true);
  changes := changes || format('Employee set to Inactive; last working day %s.', to_char(p_last_day, 'FMDD Mon YYYY'));

  UPDATE public.employment_contracts
     SET status = 'terminated', end_date = greatest(p_last_day, start_date)
   WHERE employee_id = p_employee AND status = 'active'
  RETURNING * INTO k;
  IF FOUND THEN
    changes := changes || format('Contract starting %s marked terminated.', to_char(k.start_date, 'FMDD Mon YYYY'));
  END IF;

  PERFORM set_config('leave.rpc', '1', true);
  FOR r IN
    SELECT * FROM public.leave_requests
     WHERE employee_id = p_employee AND status IN ('approved', 'pending') AND end_date > p_last_day
     ORDER BY start_date FOR UPDATE
  LOOP
    SELECT * INTO lt FROM public.leave_types WHERE id = r.leave_type_id;
    IF r.status = 'pending' THEN
      UPDATE public.leave_requests SET status = 'cancelled', cancelled_by = me, cancelled_at = now(), decision_note = note WHERE id = r.id;
      changes := changes || format('Pending %s leave %s to %s cancelled.', lt.name, r.start_date, r.end_date);
      CONTINUE;
    END IF;

    new_days := CASE WHEN r.start_date > p_last_day THEN 0 ELSE public.leave_working_days(r.start_date, p_last_day) END;
    IF new_days <= 0 THEN
      -- Entirely after the last day: cancel, give the days back, clear its attendance.
      IF lt.tracks_balance THEN
        UPDATE public.leave_balances SET taken = greatest(taken - r.days, 0)
         WHERE employee_id = r.employee_id AND leave_type_id = r.leave_type_id AND year = public.leave_year_of(r.start_date);
      END IF;
      DELETE FROM public.attendance WHERE leave_request_id = r.id;
      UPDATE public.leave_requests SET status = 'cancelled', cancelled_by = me, cancelled_at = now(), decision_note = note WHERE id = r.id;
      changes := changes || format('Approved %s leave %s to %s cancelled; %s day(s) returned.', lt.name, r.start_date, r.end_date, r.days);
    ELSE
      -- Straddles the last day: keep the part up to it.
      IF lt.tracks_balance THEN
        UPDATE public.leave_balances SET taken = greatest(taken - (r.days - new_days), 0)
         WHERE employee_id = r.employee_id AND leave_type_id = r.leave_type_id AND year = public.leave_year_of(r.start_date);
      END IF;
      DELETE FROM public.attendance WHERE leave_request_id = r.id AND date::date > p_last_day;
      UPDATE public.leave_requests
         SET end_date = p_last_day, days = new_days,
             decision_note = concat_ws(' ', nullif(decision_note, ''), '(' || note || '; shortened.)')
       WHERE id = r.id;
      changes := changes || format('Approved %s leave %s to %s shortened to end %s (%s day(s)).', lt.name, r.start_date, r.end_date, p_last_day, new_days);
    END IF;
  END LOOP;
  PERFORM set_config('leave.rpc', '', true);

  RETURN changes;
END;
$$;

-- An employee becomes Inactive only by ending employment through one of the two
-- paths above (the flag is set only inside hr_end_employment). Reactivating is
-- allowed (it needs HR rights through RLS) and clears the end date and reason.
CREATE OR REPLACE FUNCTION public.employees_status_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ending boolean := coalesce(current_setting('app.hr_ending_employment', true), '') = 'on';
BEGIN
  -- No signed-in user: maintenance or migrations, not an end user.
  IF public.safe_auth_uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Inactive' AND NOT ending THEN
      RAISE EXCEPTION 'A new employee is always added as Active.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'Active' AND NEW.status = 'Inactive' AND NOT ending THEN
    RAISE EXCEPTION 'Employment is ended with a termination letter, or with "End employment without a letter". It cannot be switched off here.';
  END IF;
  IF OLD.status = 'Inactive' AND NEW.status = 'Active' THEN
    NEW."employmentEndDate" := NULL;
    NEW."employmentEndReason" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_status_guard ON public.employees;
CREATE TRIGGER employees_status_guard
  BEFORE INSERT OR UPDATE OF status ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_status_guard();

CREATE OR REPLACE FUNCTION public.end_employment_without_letter(p_employee text, p_end_date date, p_reason text)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp public.employees%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can end employment.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Give the reason employment is ending; it is kept on the employee record.';
  END IF;
  IF p_end_date IS NULL THEN RAISE EXCEPTION 'Choose the last working day.'; END IF;
  SELECT * INTO emp FROM public.employees WHERE id = p_employee FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found.'; END IF;
  IF emp.status <> 'Active' THEN RAISE EXCEPTION 'This employee is not active.'; END IF;
  RETURN public.hr_end_employment(p_employee, p_end_date, trim(p_reason));
END;
$$;

-- ── Effects of issuing ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_doc_apply_effects(d public.hr_documents)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k public.employment_contracts%ROWTYPE;
  v_type text; v_end date; v_incident date; v_last date;
  changes text[];
  type_label text;
  emp_name text;
BEGIN
  IF d.doc_type = 'offer' THEN
    PERFORM set_config('hr_docs.rpc', '1', true);
    UPDATE public.candidates
       SET offer_status = 'offered', offer_document_id = d.id, responded_at = NULL
     WHERE id = d.candidate_id AND offer_document_id IS DISTINCT FROM d.id;
    RETURN;
  END IF;

  IF d.doc_type = 'contract' THEN
    IF EXISTS (SELECT 1 FROM public.employment_contracts WHERE document_id = d.id) THEN RETURN; END IF;
    v_type := d.data ->> 'contractType';
    INSERT INTO public.employment_contracts
      (employee_id, contract_type, start_date, end_date, position, salary, probation_months, notice_days, status, document_id, source)
    VALUES (
      d.employee_id, v_type,
      public.hr_doc_date(d.data, 'startDate', 'The start date'),
      public.hr_doc_date(d.data, 'endDate', 'The end date', v_type <> 'permanent'),
      public.hr_doc_text(d.data, 'position', 'The position'),
      public.hr_doc_num(d.data, 'salary', 'The salary'),
      public.hr_doc_num(d.data, 'probationMonths', 'Probation', false)::integer,
      public.hr_doc_num(d.data, 'noticeDays', 'Notice', false)::integer,
      'active', d.id, 'letter'
    );
    UPDATE public.employees SET "employmentStartDate" = public.hr_doc_date(d.data, 'startDate', 'The start date')
     WHERE id = d.employee_id AND "employmentStartDate" IS NULL;
    RETURN;
  END IF;

  IF d.doc_type = 'extension' THEN
    IF EXISTS (SELECT 1 FROM public.employment_contracts WHERE document_id = d.id) THEN RETURN; END IF;
    SELECT * INTO k FROM public.employment_contracts WHERE id = (d.data ->> 'contractId')::uuid FOR UPDATE;
    v_end := public.hr_doc_date(d.data, 'newEndDate', 'The new end date');
    -- Parent first, so the one-active-contract rule is never broken in between.
    UPDATE public.employment_contracts SET status = 'extended' WHERE id = k.id;
    INSERT INTO public.employment_contracts
      (employee_id, contract_type, start_date, end_date, position, salary, probation_months, notice_days,
       status, parent_contract_id, document_id, source)
    VALUES (
      k.employee_id, k.contract_type, k.end_date + 1, v_end, k.position,
      coalesce(public.hr_doc_num(d.data, 'newSalary', 'The new salary', false), k.salary),
      0, k.notice_days, 'active', k.id, d.id, 'letter'
    );
    RETURN;
  END IF;

  IF d.doc_type = 'termination' THEN
    -- Idempotent: if the employee is already Inactive this letter has run.
    IF EXISTS (SELECT 1 FROM public.employees WHERE id = d.employee_id AND status = 'Inactive') THEN RETURN; END IF;
    v_last := public.hr_doc_date(d.data, 'lastWorkingDay', 'The last working day');
    type_label := initcap(replace(d.data ->> 'terminationType', '_', ' '));
    changes := public.hr_end_employment(
      d.employee_id, v_last,
      left(type_label || ': ' || coalesce(d.data ->> 'reason', ''), 1000)
    );
    emp_name := public.hr_employee_name(d.employee_id);
    PERFORM public.notify_hr_roles(
      'employment_ended',
      format('Employment ended: %s', emp_name),
      format('Termination letter %s was issued. %s Consider issuing a Certificate of Service.', d.ref_no, array_to_string(changes, ' ')),
      '/hr/employees?open=' || d.employee_id
    );
    RETURN;
  END IF;

  IF d.doc_type = 'warning' THEN
    IF EXISTS (SELECT 1 FROM public.disciplinary_records WHERE document_id = d.id) THEN RETURN; END IF;
    v_incident := public.hr_doc_date(d.data, 'incidentDate', 'The incident date');
    INSERT INTO public.disciplinary_records (employee_id, level, offence_category, incident_date, expires_on, status, document_id)
    VALUES (
      d.employee_id, d.data ->> 'level', d.data ->> 'offenceCategory', v_incident,
      coalesce(public.hr_doc_date(d.data, 'expiresOn', 'The expiry date', false), (v_incident + interval '12 months')::date),
      'active', d.id
    );
    RETURN;
  END IF;

  IF d.doc_type = 'recognition' THEN
    IF EXISTS (SELECT 1 FROM public.recognition_records WHERE document_id = d.id) THEN RETURN; END IF;
    v_type := d.data ->> 'rewardType';
    INSERT INTO public.recognition_records (employee_id, category, reward_type, amount, payroll_status, status, document_id)
    VALUES (
      d.employee_id, d.data ->> 'category', v_type,
      CASE WHEN v_type = 'cash' THEN public.hr_doc_num(d.data, 'amount', 'The cash amount') ELSE public.hr_doc_num(d.data, 'amount', 'The amount', false) END,
      CASE WHEN v_type = 'cash' THEN 'pending' ELSE 'not_applicable' END,
      'active', d.id
    );
    RETURN;
  END IF;

  -- general_letter, certificate_of_service: no record changes.
END;
$$;

-- ── Effects of voiding an ISSUED letter ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_doc_void_effects(d public.hr_documents)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  child public.employment_contracts%ROWTYPE;
  parent public.employment_contracts%ROWTYPE;
BEGIN
  IF d.doc_type = 'offer' THEN
    PERFORM set_config('hr_docs.rpc', '1', true);
    UPDATE public.candidates SET offer_status = 'none', offer_document_id = NULL, responded_at = NULL
     WHERE offer_document_id = d.id;

  ELSIF d.doc_type = 'contract' THEN
    UPDATE public.employment_contracts SET status = 'void' WHERE document_id = d.id;

  ELSIF d.doc_type = 'extension' THEN
    UPDATE public.employment_contracts SET status = 'void' WHERE document_id = d.id RETURNING * INTO child;
    IF FOUND AND child.parent_contract_id IS NOT NULL THEN
      SELECT * INTO parent FROM public.employment_contracts WHERE id = child.parent_contract_id FOR UPDATE;
      -- Back to active only if nothing else continues it and the employee has no
      -- other active contract (e.g. a new contract issued since).
      IF parent.status = 'extended'
         AND NOT EXISTS (SELECT 1 FROM public.employment_contracts c WHERE c.parent_contract_id = parent.id AND c.status <> 'void')
         AND NOT EXISTS (SELECT 1 FROM public.employment_contracts c WHERE c.employee_id = parent.employee_id AND c.status = 'active') THEN
        UPDATE public.employment_contracts SET status = 'active' WHERE id = parent.id;
      END IF;
    END IF;

  ELSIF d.doc_type = 'warning' THEN
    UPDATE public.disciplinary_records SET status = 'void' WHERE document_id = d.id;

  ELSIF d.doc_type = 'recognition' THEN
    -- A reward already paid stays recorded as paid; HR settles that by hand.
    UPDATE public.recognition_records
       SET status = 'void', payroll_status = CASE WHEN payroll_status = 'pending' THEN 'not_applicable' ELSE payroll_status END
     WHERE document_id = d.id;
  END IF;
  -- termination: the employee is deliberately NOT reactivated (the app tells HR
  -- to reactivate by hand if that is intended). certificate / general: nothing.
END;
$$;

-- ── The lifecycle functions, redefined with validation and effects ─────────
-- Bodies are the Phase 3 bodies (20261101000300) plus the marked additions.

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
  PERFORM public.hr_doc_validate(d, 'submit');                       -- Phase 4

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
  PERFORM public.hr_doc_validate(d, 'approve');                      -- Phase 4

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

-- Run the issue-time checks without changing anything: called before a number
-- is reserved, so a letter that cannot be issued costs neither a number nor a file.
CREATE OR REPLACE FUNCTION public.validate_hr_document(p_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can work with HR documents.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.hr_documents WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.'; END IF;
  PERFORM public.hr_doc_validate(d, 'issue');
END;
$$;

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
  PERFORM public.hr_doc_validate(d, 'issue');                        -- Phase 4: final guard

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'issued', pdf_path = p_pdf_path, pdf_sha256 = p_pdf_sha256, issued_at = now()
   WHERE id = p_id RETURNING * INTO d;
  PERFORM public.hr_doc_apply_effects(d);                            -- Phase 4: same transaction
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d.ref_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_hr_document(p_id uuid, p_reason text)
RETURNS public.hr_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.hr_documents%ROWTYPE;
  me uuid := public.safe_auth_uid();
  was_issued boolean;
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
  was_issued := d.status = 'issued';

  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.hr_documents
     SET status = 'void', void_reason = trim(p_reason), voided_by = me, voided_at = now()
   WHERE id = p_id RETURNING * INTO d;
  IF was_issued THEN
    PERFORM public.hr_doc_void_effects(d);                           -- Phase 4
  END IF;

  IF d.created_by IS NOT NULL AND d.created_by IS DISTINCT FROM me THEN
    PERFORM public.notify_user(d.created_by, 'hr_document_void', 'Document voided',
      format('%s was voided: %s', d.subject, trim(p_reason)), '/hr/documents');
  END IF;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN d;
END;
$$;

-- ── Offers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_to_offer(p_candidate uuid, p_response text, p_date date DEFAULT NULL)
RETURNS public.candidates LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.candidates%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can record an offer response.' USING ERRCODE = '42501';
  END IF;
  IF p_response NOT IN ('accepted', 'declined', 'withdrawn') THEN
    RAISE EXCEPTION 'The response must be accepted, declined or withdrawn.';
  END IF;
  SELECT * INTO c FROM public.candidates WHERE id = p_candidate FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found.'; END IF;
  IF c.offer_status <> 'offered' THEN
    RAISE EXCEPTION 'There is no open offer for % (the offer is %).', c.full_name, c.offer_status;
  END IF;
  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.candidates SET offer_status = p_response, responded_at = coalesce(p_date, public.hr_today())
   WHERE id = p_candidate RETURNING * INTO c;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN c;
END;
$$;

-- Offers whose acceptance deadline (from the offer letter) has passed.
CREATE OR REPLACE FUNCTION public.expire_offers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR can expire offers.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('hr_docs.rpc', '1', true);
  UPDATE public.candidates c SET offer_status = 'expired'
    FROM public.hr_documents d
   WHERE c.offer_status = 'offered' AND d.id = c.offer_document_id
     AND nullif(d.data ->> 'acceptanceDeadline', '')::date < public.hr_today();
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('hr_docs.rpc', '', true);
  RETURN n;
END;
$$;

-- ── Contracts recorded without a letter (existing staff) ───────────────────
CREATE OR REPLACE FUNCTION public.record_legacy_contract(
  p_employee text, p_contract_type text, p_start date, p_end date, p_position text,
  p_salary numeric DEFAULT NULL, p_probation_months integer DEFAULT NULL, p_notice_days integer DEFAULT NULL,
  p_status text DEFAULT 'active'
)
RETURNS public.employment_contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k public.employment_contracts%ROWTYPE;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can record contracts.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'An existing contract is recorded as active (current) or expired (past).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee) THEN RAISE EXCEPTION 'Employee not found.'; END IF;
  IF p_status = 'active' AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = p_employee AND status = 'active') THEN
    RAISE EXCEPTION 'This employee already has an active contract on record.';
  END IF;
  INSERT INTO public.employment_contracts
    (employee_id, contract_type, start_date, end_date, position, salary, probation_months, notice_days, status, source)
  VALUES (p_employee, p_contract_type, p_start, p_end, nullif(trim(p_position), ''), p_salary, p_probation_months, p_notice_days, p_status, 'legacy')
  RETURNING * INTO k;
  RETURN k;
END;
$$;

-- ── Cash rewards (finance sees only these columns) ─────────────────────────
CREATE OR REPLACE FUNCTION public.pending_cash_rewards()
RETURNS TABLE (id uuid, employee_id text, employee_name text, amount numeric, awarded_on date, category text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.can_manage_hr() OR public.has_staff_role(ARRAY['finance'])) THEN
    RAISE EXCEPTION 'Only HR and finance can see pending rewards.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.id, r.employee_id, public.hr_employee_name(r.employee_id), r.amount,
           (d.issued_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date, r.category
      FROM public.recognition_records r
      JOIN public.hr_documents d ON d.id = r.document_id
     WHERE r.status = 'active' AND r.reward_type = 'cash' AND r.payroll_status = 'pending'
     ORDER BY d.issued_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_recognition_paid(p_id uuid, p_payroll_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.recognition_records%ROWTYPE;
BEGIN
  IF NOT (public.can_manage_hr() OR public.has_staff_role(ARRAY['finance'])) THEN
    RAISE EXCEPTION 'Only HR and finance can mark rewards as paid.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.recognition_records WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found.'; END IF;
  IF r.reward_type <> 'cash' OR r.status <> 'active' OR r.payroll_status <> 'pending' THEN
    RAISE EXCEPTION 'Only an active cash reward waiting for payroll can be marked as paid.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll WHERE id = p_payroll_id) THEN
    RAISE EXCEPTION 'That payroll record does not exist.';
  END IF;
  UPDATE public.recognition_records SET payroll_status = 'paid', paid_in_payroll_id = p_payroll_id WHERE id = p_id;
END;
$$;

-- ── Contract-expiry reminders ──────────────────────────────────────────────
-- Active contracts ending in exactly 60, 30 or 7 days, or already past their end
-- date (threshold 0, "overdue"), for which that reminder has not been sent.
CREATE OR REPLACE FUNCTION public.contracts_due_for_reminder(p_today date)
RETURNS TABLE (contract_id uuid, employee_id text, employee_name text, end_date date, threshold_days integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR can see contract reminders.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.employee_id, public.hr_employee_name(c.employee_id), c.end_date, t.th
      FROM public.employment_contracts c
     CROSS JOIN LATERAL (
       SELECT CASE WHEN c.end_date < p_today THEN 0
                   WHEN (c.end_date - p_today) IN (60, 30, 7) THEN (c.end_date - p_today)
              END AS th
     ) t
     WHERE c.status = 'active' AND c.end_date IS NOT NULL AND t.th IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.contract_expiry_notices n WHERE n.contract_id = c.id AND n.threshold_days = t.th)
     ORDER BY t.th DESC, c.end_date;
END;
$$;

-- The daily job, in one transaction, in the agreed order:
--   1. 60/30/7-day reminders  2. one "overdue" reminder  3. mark past-due
--   contracts expired  4. expire offers  (and expire lapsed warnings)
CREATE OR REPLACE FUNCTION public.run_contract_expiry_job(p_today date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date := coalesce(p_today, public.hr_today());
  rec RECORD;
  sent integer := 0;
  overdue integer := 0;
  expired_contracts integer;
  expired_offers integer;
  expired_warnings integer;
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR or the scheduled job can run contract reminders.' USING ERRCODE = '42501';
  END IF;

  FOR rec IN SELECT * FROM public.contracts_due_for_reminder(today) LOOP
    PERFORM public.notify_hr_roles(
      'contract_expiry',
      CASE WHEN rec.threshold_days = 0 THEN format('Contract overdue: %s', rec.employee_name)
           ELSE format('Contract ends in %s days: %s', rec.threshold_days, rec.employee_name) END,
      CASE WHEN rec.threshold_days = 0
           THEN format('%s''s contract ended on %s and no decision was recorded. It is now marked expired; extend it or end the employment.', rec.employee_name, to_char(rec.end_date, 'FMDD Mon YYYY'))
           ELSE format('%s''s contract ends on %s. Prepare an extension or plan the end of employment.', rec.employee_name, to_char(rec.end_date, 'FMDD Mon YYYY')) END,
      '/hr/employees?open=' || rec.employee_id
    );
    INSERT INTO public.contract_expiry_notices (contract_id, threshold_days) VALUES (rec.contract_id, rec.threshold_days)
    ON CONFLICT DO NOTHING;
    IF rec.threshold_days = 0 THEN overdue := overdue + 1; ELSE sent := sent + 1; END IF;
  END LOOP;

  UPDATE public.employment_contracts SET status = 'expired' WHERE status = 'active' AND end_date < today;
  GET DIAGNOSTICS expired_contracts = ROW_COUNT;

  expired_offers := public.expire_offers();

  UPDATE public.disciplinary_records SET status = 'expired' WHERE status = 'active' AND expires_on < today;
  GET DIAGNOSTICS expired_warnings = ROW_COUNT;

  RETURN jsonb_build_object('day', today, 'reminders', sent, 'overdue', overdue,
    'contracts_expired', expired_contracts, 'offers_expired', expired_offers, 'warnings_expired', expired_warnings);
END;
$$;

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.hr_doc_validate(public.hr_documents, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_doc_apply_effects(public.hr_documents) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_doc_void_effects(public.hr_documents) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_end_employment(text, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_employee_name(text) FROM PUBLIC, anon;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.validate_hr_document(uuid)',
    'public.end_employment_without_letter(text, date, text)',
    'public.respond_to_offer(uuid, text, date)',
    'public.record_legacy_contract(text, text, date, date, text, numeric, integer, integer, text)',
    'public.pending_cash_rewards()',
    'public.mark_recognition_paid(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.expire_offers()',
    'public.contracts_due_for_reminder(date)',
    'public.run_contract_expiry_job(date)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;
