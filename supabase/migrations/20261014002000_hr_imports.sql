-- Phase 5: entering existing data at go-live.
--
--  1. Leave already taken this year BEFORE go-live (opening balances). It goes in
--     a separate column, leave_balances.opening_taken, so the system's own
--     `taken` (moved only by approvals and cancellations) is never overwritten:
--         remaining = entitled + carried_forward - opening_taken - taken
--     The three places that compute "remaining" (filing a request, approving
--     it, carrying days into the next year) are redefined below with that
--     formula; everything else in them is unchanged from 20261014000700.
--     Opening balances can be entered only for the go-live year.
--  2. Batch importers for existing contracts and opening balances: one call per
--     file, all or nothing (any bad row rolls the whole file back), at most 500
--     rows, HR roles only, and a summary line in the Audit Trail. Each row is
--     also audited by the row triggers.
--
-- Depends on Phases 1-4 and 20261014001900 (app_settings.hr_go_live_at).

-- ── 1. Opening balances ────────────────────────────────────────────────────
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS opening_taken numeric(6,1) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_balances_opening_taken_check') THEN
    ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_opening_taken_check CHECK (opening_taken >= 0);
  END IF;
END $$;

-- HR may edit balances directly (entitlement, carried forward), but the opening
-- figure only through set_opening_leave_taken(), which checks the year.
CREATE OR REPLACE FUNCTION public.leave_balances_opening_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.safe_auth_uid() IS NULL OR coalesce(current_setting('leave.opening', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.opening_taken <> 0)
     OR (TG_OP = 'UPDATE' AND NEW.opening_taken IS DISTINCT FROM OLD.opening_taken) THEN
    RAISE EXCEPTION 'Leave taken before go-live is entered with "Import opening balances" on the Leave page.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_balances_opening_guard ON public.leave_balances;
CREATE TRIGGER leave_balances_opening_guard
  BEFORE INSERT OR UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.leave_balances_opening_guard();

-- The leave year opening balances belong to: the go-live year (this year until
-- hr_go_live_at is set).
CREATE OR REPLACE FUNCTION public.hr_go_live_year()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(year FROM (coalesce((SELECT hr_go_live_at FROM public.app_settings WHERE id = true), now())
                            AT TIME ZONE 'Africa/Dar_es_Salaam'))::integer;
$$;

CREATE OR REPLACE FUNCTION public.set_opening_leave_taken(p_employee text, p_type uuid, p_year integer, p_days numeric)
RETURNS public.leave_balances LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lt public.leave_types%ROWTYPE;
  b public.leave_balances%ROWTYPE;
  live_year integer := public.hr_go_live_year();
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can enter opening leave balances.' USING ERRCODE = '42501';
  END IF;
  IF p_year IS DISTINCT FROM live_year OR public.leave_year_of(public.hr_today()) > live_year THEN
    RAISE EXCEPTION 'Opening balances can only be entered for the go-live year (%).', live_year;
  END IF;
  IF p_days IS NULL OR p_days < 0 OR p_days <> round(p_days * 2) / 2 THEN
    RAISE EXCEPTION 'Days taken must be zero or more, in whole or half days.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee) THEN
    RAISE EXCEPTION 'Employee % not found.', p_employee;
  END IF;
  SELECT * INTO lt FROM public.leave_types WHERE id = p_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave type not found.'; END IF;
  IF NOT lt.tracks_balance THEN
    RAISE EXCEPTION '% leave has no balance, so there is nothing to enter.', lt.name;
  END IF;

  PERFORM public.ensure_leave_balance(p_employee, p_type, p_year);
  SELECT * INTO b FROM public.leave_balances
   WHERE employee_id = p_employee AND leave_type_id = p_type AND year = p_year FOR UPDATE;
  IF p_days + b.taken > b.entitled + b.carried_forward THEN
    RAISE EXCEPTION '% days of % leave is more than % has left in % (% entitled, % carried, % taken in the system).',
      p_days, lt.name, public.leave_employee_name(p_employee), p_year, b.entitled, b.carried_forward, b.taken;
  END IF;

  PERFORM set_config('leave.opening', '1', true);
  UPDATE public.leave_balances SET opening_taken = p_days WHERE id = b.id RETURNING * INTO b;
  PERFORM set_config('leave.opening', '', true);
  RETURN b;
END;
$$;

-- ── 2. "Remaining" includes the opening figure ─────────────────────────────
-- Filing a request (same body as 20261014000700, remaining formula changed).
CREATE OR REPLACE FUNCTION public.leave_request_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lt public.leave_types%ROWTYPE;
  linked text := public.current_employee_id();
  remaining numeric;
  yr integer;
BEGIN
  -- Whatever the client sent, a new request is pending, unreviewed and owned
  -- by the caller.
  NEW.status := 'pending';
  NEW.decided_by := NULL; NEW.decided_at := NULL; NEW.decision_note := NULL;
  NEW.approved_by := NULL; NEW.approved_at := NULL;
  NEW.cancelled_by := NULL; NEW.cancelled_at := NULL;
  NEW.created_by := public.safe_auth_uid();

  SELECT * INTO lt FROM public.leave_types WHERE id = NEW.leave_type_id;
  IF NOT FOUND OR NOT lt.is_active THEN
    RAISE EXCEPTION 'This leave type is not available. Please choose another.';
  END IF;

  -- A login linked to an employee files leave for that employee only. HR
  -- roles (and logins not linked to anyone, e.g. a clerk) may file for others.
  IF NOT public.can_manage_hr() AND linked IS NOT NULL AND NEW.employee_id <> linked THEN
    RAISE EXCEPTION 'You can only apply for leave for yourself.' USING ERRCODE = '42501';
  END IF;

  yr := public.leave_year_of(NEW.start_date);
  IF yr <> public.leave_year_of(NEW.end_date) THEN
    RAISE EXCEPTION 'A leave request cannot run across two leave years. Please file one request up to 31 December and another from 1 January.';
  END IF;

  NEW.days := public.leave_working_days(NEW.start_date, NEW.end_date);
  IF NEW.days IS NULL OR NEW.days <= 0 THEN
    RAISE EXCEPTION 'These dates contain no working days (only Sundays or public holidays). Please choose different dates.';
  END IF;

  IF lt.requires_attachment AND coalesce(trim(NEW.attachment_path), '') = '' THEN
    RAISE EXCEPTION '% leave needs a supporting document. Please attach one.', lt.name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.employee_id = NEW.employee_id AND r.status IN ('pending', 'approved')
      AND r.start_date <= NEW.end_date AND r.end_date >= NEW.start_date
  ) THEN
    RAISE EXCEPTION 'This employee already has pending or approved leave that overlaps these dates.';
  END IF;

  IF lt.tracks_balance THEN
    PERFORM public.ensure_leave_balance(NEW.employee_id, lt.id, yr);
    SELECT b.entitled + b.carried_forward - b.opening_taken - b.taken INTO remaining        -- Phase 5
    FROM public.leave_balances b
    WHERE b.employee_id = NEW.employee_id AND b.leave_type_id = lt.id AND b.year = yr;
    IF NEW.days > remaining THEN
      RAISE EXCEPTION 'Not enough % leave: % day(s) left in %, but % requested.', lt.name, remaining, yr, NEW.days;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Approving (same body as 20261014000700, remaining formula changed).
CREATE OR REPLACE FUNCTION public.review_leave_request(
  p_id uuid, p_decision text, p_note text DEFAULT NULL, p_replace_absent boolean DEFAULT false
)
RETURNS public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.leave_requests%ROWTYPE;
  lt public.leave_types%ROWTYPE;
  bal public.leave_balances%ROWTYPE;
  me uuid := public.safe_auth_uid();
  yr integer;
  emp_name text;
  conflicts jsonb;
  hard_conflicts integer;
  d date;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can approve or reject leave.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected.';
  END IF;

  SELECT * INTO req FROM public.leave_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found.'; END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is already % and can no longer be reviewed.', req.status;
  END IF;
  IF req.employee_id = public.current_employee_id() THEN
    RAISE EXCEPTION 'You cannot approve or reject your own leave. Another Admin, HR Manager or General Manager must do it.';
  END IF;

  SELECT * INTO lt FROM public.leave_types WHERE id = req.leave_type_id;
  yr := public.leave_year_of(req.start_date);
  emp_name := public.leave_employee_name(req.employee_id);
  PERFORM set_config('leave.rpc', '1', true);

  -- Reject ------------------------------------------------------------------
  IF p_decision = 'rejected' THEN
    IF coalesce(length(trim(p_note)), 0) < 3 THEN
      RAISE EXCEPTION 'Please give a short reason, so the employee knows why the request was rejected.';
    END IF;
    UPDATE public.leave_requests
       SET status = 'rejected', decided_by = me, decided_at = now(), decision_note = trim(p_note)
     WHERE id = p_id RETURNING * INTO req;
    PERFORM public.leave_notify_requester(req, 'Leave request rejected',
      format('Your %s leave from %s to %s was rejected: %s', lt.name, req.start_date, req.end_date, trim(p_note)));
    PERFORM set_config('leave.rpc', '', true);
    RETURN req;
  END IF;

  -- Approve -----------------------------------------------------------------
  IF lt.tracks_balance THEN
    PERFORM public.ensure_leave_balance(req.employee_id, lt.id, yr);
    SELECT * INTO bal FROM public.leave_balances
     WHERE employee_id = req.employee_id AND leave_type_id = lt.id AND year = yr FOR UPDATE;
    IF req.days > bal.entitled + bal.carried_forward - bal.opening_taken - bal.taken THEN          -- Phase 5
      RAISE EXCEPTION 'Not enough % leave: % day(s) left in %, but this request is for % day(s).',
        lt.name, bal.entitled + bal.carried_forward - bal.opening_taken - bal.taken, yr, req.days;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.id <> req.id AND r.employee_id = req.employee_id AND r.status = 'approved'
      AND r.start_date <= req.end_date AND r.end_date >= req.start_date
  ) THEN
    RAISE EXCEPTION 'This employee already has approved leave that overlaps these dates.';
  END IF;

  -- Attendance already recorded on these days. Present / Late / Half Day are
  -- never overwritten (HR corrects the attendance or the dates first); Absent
  -- can be replaced only when the approver says so; a manual Leave row with no
  -- request behind it is simply adopted.
  SELECT coalesce(jsonb_agg(jsonb_build_object('date', a.date, 'status', a.status) ORDER BY a.date), '[]'::jsonb),
         count(*) FILTER (WHERE a.status <> 'Absent' OR NOT p_replace_absent)
    INTO conflicts, hard_conflicts
    FROM public.attendance a
   WHERE a.employee_id = req.employee_id
     AND a.date::date IN (SELECT public.leave_working_dates(req.start_date, req.end_date))
     AND NOT (a.status = 'Leave' AND a.leave_request_id IS NULL)
     AND a.leave_request_id IS DISTINCT FROM req.id;

  IF hard_conflicts > 0 THEN
    RAISE EXCEPTION 'Attendance is already recorded on % of these days, so the leave cannot be approved yet.', jsonb_array_length(conflicts)
      USING DETAIL = conflicts::text,
            HINT = CASE WHEN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(conflicts) c WHERE c ->> 'status' <> 'Absent')
                        THEN 'ONLY_ABSENT' ELSE 'MUST_CORRECT' END;
  END IF;

  FOR d IN SELECT * FROM public.leave_working_dates(req.start_date, req.end_date) LOOP
    INSERT INTO public.attendance (employee_id, employee, date, status, notes, leave_request_id)
    VALUES (req.employee_id, emp_name, d, 'Leave', format('%s leave (approved)', lt.name), req.id)
    ON CONFLICT (employee_id, date) DO UPDATE
      SET status = 'Leave', leave_request_id = EXCLUDED.leave_request_id, notes = EXCLUDED.notes,
          clock_in_time = NULL, clock_out_time = NULL;
  END LOOP;

  IF lt.tracks_balance THEN
    UPDATE public.leave_balances SET taken = taken + req.days WHERE id = bal.id;
  END IF;

  UPDATE public.leave_requests
     SET status = 'approved', approved_by = me, approved_at = now(),
         decided_by = me, decided_at = now(), decision_note = nullif(trim(p_note), '')
   WHERE id = p_id RETURNING * INTO req;

  PERFORM public.leave_notify_requester(req, 'Leave request approved',
    format('Your %s leave from %s to %s (%s day(s)) was approved.', lt.name, req.start_date, req.end_date, req.days));
  PERFORM set_config('leave.rpc', '', true);
  RETURN req;
END;
$$;

-- Opening a year: days carried over count the opening figure too (same body
-- as 20261014000700, carry formula changed).
CREATE OR REPLACE FUNCTION public.open_leave_year(p_year integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  created integer;
BEGIN
  IF NOT (public.can_manage_hr() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only HR can open a leave year.' USING ERRCODE = '42501';
  END IF;
  IF p_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Invalid year.'; END IF;

  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled, carried_forward)
  SELECT e.id, lt.id, p_year, lt.days_per_year,
         least(lt.max_carry_forward,
               greatest(coalesce(prev.entitled + prev.carried_forward - prev.opening_taken - prev.taken, 0), 0))   -- Phase 5
    FROM public.employees e
   CROSS JOIN public.leave_types lt
    LEFT JOIN public.leave_balances prev
      ON prev.employee_id = e.id AND prev.leave_type_id = lt.id AND prev.year = p_year - 1
   WHERE e.status = 'Active' AND lt.is_active AND lt.tracks_balance
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END;
$$;

-- ── 3. Batch importers (one file = one transaction) ────────────────────────
-- Opening balances. Rows: {"employee_id", "leave_type" (name), "year", "taken_before_go_live"}.
CREATE OR REPLACE FUNCTION public.import_opening_leave(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb;
  i integer := 0;
  type_id uuid;
  seen text[] := '{}';
  k text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can import opening balances.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'The file has no rows to import.';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'At most 500 rows per file (this one has %). Split it into smaller files.', jsonb_array_length(p_rows);
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    i := i + 1;
    BEGIN
      SELECT id INTO type_id FROM public.leave_types WHERE lower(name) = lower(trim(r ->> 'leave_type'));
      IF type_id IS NULL THEN RAISE EXCEPTION 'unknown leave type "%"', r ->> 'leave_type'; END IF;
      k := trim(r ->> 'employee_id') || '/' || type_id::text || '/' || trim(r ->> 'year');
      IF k = ANY (seen) THEN RAISE EXCEPTION 'the same employee, leave type and year appear twice in the file'; END IF;
      seen := seen || k;
      PERFORM public.set_opening_leave_taken(trim(r ->> 'employee_id'), type_id, (r ->> 'year')::integer,
                                             (r ->> 'taken_before_go_live')::numeric);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Row %: %. Nothing was imported.', i, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), 'import.opening_leave', 'leave_balances', 'import', jsonb_build_object('rows', i));
  RETURN jsonb_build_object('imported', i);
END;
$$;

-- Existing contracts. Rows: {"employee_id", "contract_type", "start_date",
-- "end_date", "position", "salary", "notice_days"}. A contract that has
-- already ended is recorded as expired, the rest as the current (active) one.
CREATE OR REPLACE FUNCTION public.import_legacy_contracts(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb;
  i integer := 0;
  n_active integer := 0;
  n_expired integer := 0;
  emp public.employees%ROWTYPE;
  v_type text; v_start date; v_end date; v_status text; v_position text;
  today date := public.hr_today();
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can import contracts.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'The file has no rows to import.';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'At most 500 rows per file (this one has %). Split it into smaller files.', jsonb_array_length(p_rows);
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    i := i + 1;
    BEGIN
      SELECT * INTO emp FROM public.employees WHERE id = trim(r ->> 'employee_id');
      IF NOT FOUND THEN RAISE EXCEPTION 'employee "%" not found', r ->> 'employee_id'; END IF;
      v_type := lower(trim(r ->> 'contract_type'));
      IF v_type NOT IN ('permanent', 'fixed_term', 'probation', 'casual') THEN
        RAISE EXCEPTION 'contract type must be permanent, fixed_term, probation or casual';
      END IF;
      v_start := public.hr_doc_date(r, 'start_date', 'the start date');
      v_end := public.hr_doc_date(r, 'end_date', 'the end date (needed unless permanent)', v_type <> 'permanent');
      IF v_end IS NOT NULL AND v_end < v_start THEN RAISE EXCEPTION 'the end date is before the start date'; END IF;
      v_position := public.hr_doc_text(r, 'position', 'the position');
      v_status := CASE WHEN v_end IS NOT NULL AND v_end < today THEN 'expired' ELSE 'active' END;
      IF v_status = 'active' AND emp.status <> 'Active' THEN
        RAISE EXCEPTION '% is not an active employee, so this can only be a past contract (end date before today)', public.hr_employee_name(emp.id);
      END IF;
      IF v_status = 'active' AND EXISTS (SELECT 1 FROM public.employment_contracts WHERE employee_id = emp.id AND status = 'active') THEN
        RAISE EXCEPTION '% already has an active contract', public.hr_employee_name(emp.id);
      END IF;
      PERFORM public.record_legacy_contract(
        emp.id, v_type, v_start, v_end, v_position,
        public.hr_doc_num(r, 'salary', 'the salary', false),
        NULL,
        public.hr_doc_num(r, 'notice_days', 'the notice period', false)::integer,
        v_status);
      IF v_status = 'active' THEN n_active := n_active + 1; ELSE n_expired := n_expired + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Row %: %. Nothing was imported.', i, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), 'import.legacy_contracts', 'employment_contracts', 'import',
          jsonb_build_object('rows', i, 'active', n_active, 'expired', n_expired));
  RETURN jsonb_build_object('imported', i, 'active', n_active, 'expired', n_expired);
END;
$$;

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.leave_balances_opening_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_go_live_year() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_go_live_year() TO authenticated;
REVOKE ALL ON FUNCTION public.set_opening_leave_taken(text, uuid, integer, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_opening_leave(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_legacy_contracts(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_opening_leave_taken(text, uuid, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_opening_leave(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_legacy_contracts(jsonb) TO authenticated;
