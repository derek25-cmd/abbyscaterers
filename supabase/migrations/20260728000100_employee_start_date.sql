-- Adds the employment start date, used to gate monthly payroll runs so an
-- employee isn't paid for periods before they actually started. Follows the
-- same convention as 20260727000200_employee_payroll_fields.sql (employees
-- columns are confirmed live camelCase).

DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE NOTICE 'Skipping employee start date migration — public.employees does not exist in this database';
    RETURN;
  END IF;

  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "employmentStartDate" DATE;
END $$;
