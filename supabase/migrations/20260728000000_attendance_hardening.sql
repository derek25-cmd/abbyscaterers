-- Hardens the `attendance` table, which was never brought into either the
-- constraint pass (20260726000200_money_column_constraints.sql covered
-- other tables, not this one) or the RLS sweep
-- (20260714000100_tighten_finance_rls.sql's table list omitted it) —
-- confirmed by grepping every migration for "attendance" and separately for
-- "CREATE POLICY"/"ENABLE ROW LEVEL SECURITY": zero overlap before this file.
--
-- Base table has no tracked CREATE TABLE (only
-- 20240802000000_attendance_refactor.sql's ALTER TABLE against an
-- assumed-existing table) — same untracked-drift pattern as orders/payroll,
-- so this migration is defensive throughout, never assumes a clean slate.

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF to_regclass('public.attendance') IS NULL THEN
    RAISE NOTICE 'Skipping attendance hardening migration — public.attendance does not exist in this database';
    RETURN;
  END IF;

  -- Backfill any NULLs before constraining (same order as the payroll
  -- constraints migration: backfill, then NOT NULL, then CHECK).
  UPDATE public.attendance SET status = 'Present' WHERE status IS NULL;
  ALTER TABLE public.attendance ALTER COLUMN status SET DEFAULT 'Present';
  ALTER TABLE public.attendance ALTER COLUMN status SET NOT NULL;

  ALTER TABLE public.attendance ALTER COLUMN date SET NOT NULL;
  ALTER TABLE public.attendance ALTER COLUMN employee_id SET NOT NULL;

  -- Re-assert the unique constraint the app's upsert(onConflict) relies on
  -- to prevent duplicate employee/day rows — idempotent, in case a prior
  -- out-of-band change dropped it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_employee_id_date_key'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);
  END IF;

  -- The grid and monthly report both filter by date range; this table had
  -- no index on date at all.
  CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
  CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance (employee_id, date);

  -- RLS: same discipline as 20260714000100_tighten_finance_rls.sql — drop
  -- whatever policies actually exist (by their real names, not a guessed
  -- one) rather than assuming none do, then apply exactly one.
  ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attendance'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.attendance', pol.policyname);
  END LOOP;

  CREATE POLICY staff_manage_attendance ON public.attendance
    FOR ALL TO authenticated
    USING (public.is_active_staff())
    WITH CHECK (public.is_active_staff());

  RAISE NOTICE 'attendance hardening migration applied';
END $$;
