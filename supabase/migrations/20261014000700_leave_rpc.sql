-- Phase 2: the rules for leave, enforced in the database.
-- Depends on 20261020000000 (current_employee_id) and 20261020000100 (tables).
-- The notify_* calls resolve at run time and are defined in 20261020000400.
--
-- Everything here is SECURITY DEFINER with a fixed search_path, so it can
-- touch balances and attendance on behalf of a caller who has no direct write
-- rights, and every function checks the caller itself.

-- ── Internal helpers ───────────────────────────────────────────────────────

-- Creates the balance row for (employee, type, year) at the type's entitlement
-- if it does not exist yet, so a request never fails just because HR has not
-- run open_leave_year() for a newly hired employee.
CREATE OR REPLACE FUNCTION public.ensure_leave_balance(p_employee text, p_type uuid, p_year integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled)
  SELECT p_employee, lt.id, p_year, lt.days_per_year
  FROM public.leave_types lt WHERE lt.id = p_type AND lt.tracks_balance
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.leave_employee_name(p_employee text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT trim(concat_ws(' ', e."firstName", e."middleName", e."lastName")) FROM public.employees e WHERE e.id = p_employee;
$$;

-- Tells the person who filed a request (and the login linked to the employee,
-- if different) what happened to it.
CREATE OR REPLACE FUNCTION public.leave_notify_requester(p_req public.leave_requests, p_title text, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient uuid;
BEGIN
  FOR recipient IN
    SELECT DISTINCT u FROM (
      SELECT p_req.created_by AS u
      UNION ALL
      SELECT s.id FROM public.staff_users s WHERE s.employee_id = p_req.employee_id
    ) x WHERE u IS NOT NULL AND u IS DISTINCT FROM public.safe_auth_uid()
  LOOP
    PERFORM public.notify_user(recipient, 'leave_decision', p_title, p_body, '/hr/leave');
  END LOOP;
END;
$$;

-- ── 1. New requests: validate and normalise ────────────────────────────────
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
    SELECT b.entitled + b.carried_forward - b.taken INTO remaining
    FROM public.leave_balances b
    WHERE b.employee_id = NEW.employee_id AND b.leave_type_id = lt.id AND b.year = yr;
    IF NEW.days > remaining THEN
      RAISE EXCEPTION 'Not enough % leave: % day(s) left in %, but % requested.', lt.name, remaining, yr, NEW.days;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_request_before_insert ON public.leave_requests;
CREATE TRIGGER leave_request_before_insert
  BEFORE INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_request_before_insert();

-- ── 2. Requests can only change state through the functions below ──────────
-- HR has UPDATE rights on the table (to fix a reason or attachment), but
-- flipping status by hand would skip the attendance rows and the balance.
CREATE OR REPLACE FUNCTION public.leave_request_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
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

DROP TRIGGER IF EXISTS leave_request_guard ON public.leave_requests;
CREATE TRIGGER leave_request_guard
  BEFORE UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_request_guard();

-- The leave.rpc flag below lets the guard trigger know a change comes from one
-- of these functions. It is transaction-local and cleared again before each
-- function returns, so a later statement in the same transaction cannot ride on it.

-- ── 3. Approve / reject ────────────────────────────────────────────────────
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
    IF req.days > bal.entitled + bal.carried_forward - bal.taken THEN
      RAISE EXCEPTION 'Not enough % leave: % day(s) left in %, but this request is for % day(s).',
        lt.name, bal.entitled + bal.carried_forward - bal.taken, yr, req.days;
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

-- ── 4. Cancel ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_leave_request(p_id uuid, p_note text DEFAULT NULL)
RETURNS public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.leave_requests%ROWTYPE;
  lt public.leave_types%ROWTYPE;
  me uuid := public.safe_auth_uid();
  hr boolean := public.can_manage_hr();
BEGIN
  SELECT * INTO req FROM public.leave_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found.'; END IF;

  IF req.status = 'pending' THEN
    IF NOT (hr OR req.created_by = me OR req.employee_id = public.current_employee_id()) THEN
      RAISE EXCEPTION 'You can only cancel your own leave requests.' USING ERRCODE = '42501';
    END IF;
  ELSIF req.status = 'approved' THEN
    IF NOT hr THEN
      RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can cancel leave that is already approved.' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'This request is already % and cannot be cancelled.', req.status;
  END IF;

  SELECT * INTO lt FROM public.leave_types WHERE id = req.leave_type_id;
  PERFORM set_config('leave.rpc', '1', true);

  IF req.status = 'approved' THEN
    -- Undo exactly what approval did: the balance, and only this request's
    -- attendance rows (never rows HR entered by hand).
    IF lt.tracks_balance THEN
      UPDATE public.leave_balances SET taken = greatest(taken - req.days, 0)
       WHERE employee_id = req.employee_id AND leave_type_id = req.leave_type_id
         AND year = public.leave_year_of(req.start_date);
    END IF;
    DELETE FROM public.attendance WHERE leave_request_id = req.id;
  END IF;

  UPDATE public.leave_requests
     SET status = 'cancelled', cancelled_by = me, cancelled_at = now(),
         decision_note = coalesce(nullif(trim(p_note), ''), decision_note)
   WHERE id = p_id RETURNING * INTO req;

  PERFORM public.leave_notify_requester(req, 'Leave request cancelled',
    format('The %s leave from %s to %s was cancelled.', lt.name, req.start_date, req.end_date));
  PERFORM set_config('leave.rpc', '', true);
  RETURN req;
END;
$$;

-- ── 5. Open a leave year ───────────────────────────────────────────────────
-- Creates the year's balance rows for every active employee and applies each
-- type's max_carry_forward from the previous year. Safe to run repeatedly: it
-- only adds rows that are missing (also use it after hiring someone mid-year)
-- and never changes a row that exists. Runs for HR, or for the cron job, which
-- calls with the service-role key.
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
         least(lt.max_carry_forward, greatest(coalesce(prev.entitled + prev.carried_forward - prev.taken, 0), 0))
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

-- ── 6. Attendance rows owned by leave are protected ────────────────────────
-- A day covered by approved leave can only be changed or removed by HR (or by
-- cancelling the leave). Separately, nobody but HR can mark a day "Leave" by
-- hand: leave must be requested, so balances and approvals cannot be skipped.
-- Old manual Leave rows stay editable (by HR, and without changing status by
-- the person who may edit that row today).
CREATE OR REPLACE FUNCTION public.attendance_leave_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.safe_auth_uid();
BEGIN
  -- No signed-in user: service role / maintenance, not an end user.
  IF uid IS NULL OR public.can_manage_hr() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.leave_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'This day is covered by approved leave and cannot be removed here. Ask HR to cancel the leave request.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.leave_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'This day is covered by approved leave and cannot be changed here. Ask HR to cancel the leave request.';
  END IF;

  IF NEW.leave_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only the leave approval process can attach attendance to a leave request.';
  END IF;

  IF NEW.status = 'Leave' AND NOT (TG_OP = 'UPDATE' AND OLD.status = 'Leave') THEN
    RAISE EXCEPTION 'Leave cannot be marked on the attendance sheet directly. Submit a leave request instead; once approved it appears here automatically.';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.attendance') IS NULL THEN
    RAISE NOTICE 'Skipping attendance leave guard — public.attendance does not exist in this database';
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS attendance_leave_guard ON public.attendance;
  CREATE TRIGGER attendance_leave_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.attendance_leave_guard();
END $$;

-- ── 7. Who may call what ───────────────────────────────────────────────────
-- Functions default to executable by everyone, including the anonymous role.
-- The three RPCs check the caller themselves, but are still closed to anon;
-- internal helpers are not callable from the API at all.
REVOKE ALL ON FUNCTION public.ensure_leave_balance(text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_notify_requester(public.leave_requests, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_employee_name(text) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.review_leave_request(uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_leave_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_leave_year(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_leave_request(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_leave_year(integer) TO authenticated, service_role;
