-- Adds employment-end tracking to employees, for the "Fire / End Employment"
-- action: when an employee is marked Inactive via that flow, the reason and
-- last working date are captured instead of just flipping the status flag.
-- Follows the same convention as 20260727000200_employee_payroll_fields.sql
-- (employees columns are confirmed live camelCase).

DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE NOTICE 'Skipping employee termination fields migration — public.employees does not exist in this database';
    RETURN;
  END IF;

  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "employmentEndDate" DATE;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "employmentEndReason" TEXT;
END $$;
