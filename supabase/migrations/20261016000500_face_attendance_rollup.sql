-- Face attendance, Phase 1: roll a punch up into the day's attendance row.
--
-- apply_attendance_event(event_id) is internal: it is NOT callable from the
-- API. Later phases call it from their own SECURITY DEFINER functions (the
-- kiosk's clock-in, HR approving a punch that needed review).
--
--   * The day is the local day in Africa/Dar_es_Salaam; a UTC date would be
--     a day behind for punches between 00:00 and 03:00 local.
--   * Refused (exception) for an Inactive employee, and for a day covered by
--     leave (leave_request_id set, or an old hand-marked Leave).
--   * 'in': the first accepted clock-in of the day sets clock_in_time. Status
--     is Late after shift_start + late_grace_minutes, otherwise Present. A
--     day HR pre-marked Absent (or Present/Late) takes the new status; a
--     Half Day HR set is kept. A later 'in' on the same day changes nothing.
--   * 'out': sets clock_out_time (the latest one wins). Needs that day's
--     attendance row; a clock-out with no row is refused.
--   * needs_review = true: not applied. Returns 'pending_review'; HR's
--     approval (Phase 4) clears the flag and calls this again.
--   * Each event is applied once (applied_at). Returns 'applied',
--     'no_change', 'pending_review' or 'already_applied'.
--
-- Triggers on attendance still run. attendance_leave_guard accepts these
-- writes (they never touch leave_request_id or set Leave), and the freeze
-- (hr_refuse_if_employee_inactive) never fires because Inactive is refused
-- first, so no system-change flag is needed. audit_row_change records the
-- write under the caller (the kiosk device or the HR reviewer).

CREATE OR REPLACE FUNCTION public.apply_attendance_event(p_event_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev      public.attendance_events%ROWTYPE;
  emp     public.employees%ROWTYPE;
  cfg     public.face_attendance_settings%ROWTYPE;
  att     public.attendance%ROWTYPE;
  local_day date;
  at_time time(0);
  status_in text;
  n       integer;
BEGIN
  SELECT * INTO ev FROM public.attendance_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attendance event not found.'; END IF;
  IF ev.applied_at IS NOT NULL THEN RETURN 'already_applied'; END IF;
  IF ev.needs_review THEN RETURN 'pending_review'; END IF;

  SELECT * INTO emp FROM public.employees WHERE id = ev.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found.'; END IF;
  IF emp.status = 'Inactive' THEN
    RAISE EXCEPTION '% has left and their record is closed. Attendance cannot be recorded.',
      trim(concat_ws(' ', emp."firstName", emp."lastName"))
      USING HINT = 'EMPLOYEE_INACTIVE';
  END IF;

  SELECT * INTO cfg FROM public.face_attendance_settings WHERE id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Face attendance settings are missing.'; END IF;

  local_day := (ev.occurred_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
  at_time := (ev.occurred_at AT TIME ZONE 'Africa/Dar_es_Salaam')::time(0);
  -- time - time is an interval (negative before shift start), so this has
  -- no midnight wrap-around, unlike shift_start + grace.
  status_in := CASE WHEN at_time - cfg.shift_start > make_interval(mins => cfg.late_grace_minutes)
                    THEN 'Late' ELSE 'Present' END;

  SELECT * INTO att FROM public.attendance WHERE employee_id = ev.employee_id AND date = local_day FOR UPDATE;

  IF FOUND AND (att.leave_request_id IS NOT NULL OR att.status = 'Leave') THEN
    RAISE EXCEPTION '% is on leave on %. Attendance cannot be recorded for that day.',
      trim(concat_ws(' ', emp."firstName", emp."lastName")), local_day
      USING HINT = 'ON_LEAVE';
  END IF;

  IF ev.kind = 'in' THEN
    IF NOT FOUND THEN
      -- The legacy `employee` column is the name as the grid writes it.
      INSERT INTO public.attendance (employee_id, employee, date, status, clock_in_time, "updatedAt")
      VALUES (ev.employee_id, trim(concat_ws(' ', emp."firstName", emp."lastName")), local_day, status_in, at_time, now())
      ON CONFLICT (employee_id, date) DO NOTHING;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN
        -- Another punch created the row first: start again with it locked.
        RETURN public.apply_attendance_event(p_event_id);
      END IF;
    ELSIF att.clock_in_time IS NOT NULL AND att.clock_in_time <= at_time THEN
      UPDATE public.attendance_events SET applied_at = now() WHERE id = ev.id;
      RETURN 'no_change';
    ELSE
      UPDATE public.attendance
         SET clock_in_time = at_time,
             status = CASE WHEN att.status IN ('Present', 'Late', 'Absent') THEN status_in ELSE att.status END,
             "updatedAt" = now()
       WHERE id = att.id;
    END IF;

  ELSE -- 'out'
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No clock-in is recorded for % on %.',
        trim(concat_ws(' ', emp."firstName", emp."lastName")), local_day
        USING HINT = 'NO_CLOCK_IN';
    END IF;
    IF att.clock_in_time IS NOT NULL AND at_time < att.clock_in_time THEN
      RAISE EXCEPTION 'This clock-out (%) is before the clock-in (%).', at_time, att.clock_in_time
        USING HINT = 'OUT_BEFORE_IN';
    END IF;
    IF att.clock_out_time IS NOT NULL AND att.clock_out_time >= at_time THEN
      UPDATE public.attendance_events SET applied_at = now() WHERE id = ev.id;
      RETURN 'no_change';
    END IF;
    UPDATE public.attendance SET clock_out_time = at_time, "updatedAt" = now() WHERE id = att.id;
  END IF;

  UPDATE public.attendance_events SET applied_at = now() WHERE id = ev.id;
  RETURN 'applied';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_attendance_event(uuid) FROM PUBLIC, anon, authenticated;
