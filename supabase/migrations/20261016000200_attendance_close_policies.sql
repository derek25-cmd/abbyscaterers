-- Face attendance, Phase 1: attendance is written only by HR (and, from
-- Phase 3, by the attendance kiosk through SECURITY DEFINER functions).
--
-- Until now (20261014000200_hr_ops_rls.sql) any active staff member could
-- read every attendance row, insert rows for anyone, and correct a row they
-- created on the same day. With a kiosk recording clock-in and clock-out,
-- a self-entered attendance row would let anyone mark themselves present
-- without coming in. From here:
--
--   * HR (can_manage_hr(): admin, hr_manager, general_manager): full CRUD,
--     as before. The attendance grid keeps working for them unchanged.
--   * everyone else: SELECT their own rows only (employee_id =
--     current_employee_id()). A login not linked to an employee sees none.
--   * no other client writes. Kiosk punches arrive through
--     apply_attendance_event() (20261016000500), which bypasses RLS.
--
-- Same discipline as 20261014000200: drop every existing policy by its real
-- name from pg_policies, because one leftover permissive policy would OR
-- the new ones away. portal_% policies are kept: portal_read_attendance
-- (20260901190000) is the admin portal's attendance report (Clerk sessions).
--
-- The catering-system grid hides its edit controls for non-HR users in the
-- same change, and the staff guides now say attendance is recorded at the
-- kiosk.

DO $$
DECLARE
  pol RECORD;
  own_rows constant text :=
    'public.can_manage_hr() OR (public.current_employee_id() IS NOT NULL AND employee_id = public.current_employee_id())';
BEGIN
  IF to_regclass('public.attendance') IS NULL THEN
    RAISE NOTICE 'Skipping attendance policies — public.attendance does not exist in this database';
    RETURN;
  END IF;

  ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attendance'
      AND policyname NOT LIKE 'portal\_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.attendance', pol.policyname);
  END LOOP;

  EXECUTE format('CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated USING (%s)', own_rows);
  CREATE POLICY attendance_insert ON public.attendance
    FOR INSERT TO authenticated WITH CHECK (public.can_manage_hr());
  CREATE POLICY attendance_update ON public.attendance
    FOR UPDATE TO authenticated USING (public.can_manage_hr()) WITH CHECK (public.can_manage_hr());
  CREATE POLICY attendance_delete ON public.attendance
    FOR DELETE TO authenticated USING (public.can_manage_hr());

  RAISE NOTICE 'attendance: HR full access, staff read their own rows, no other writes';
END $$;

-- ── Guard: the portal's report policy must have survived ───────────────────
DO $$
BEGIN
  IF to_regclass('public.attendance') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = 'portal_read_attendance'
  ) THEN
    RAISE EXCEPTION 'portal_read_attendance is missing — admin portal attendance report would break';
  END IF;
END $$;
