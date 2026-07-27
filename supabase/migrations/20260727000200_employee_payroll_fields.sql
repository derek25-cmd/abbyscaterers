-- Adds the employee-level fields the payroll rebuild needs (bank details
-- for payment records, NSSF number). Verified live: `employees` columns are
-- genuinely camelCase (confirmed via read-only OpenAPI check this session,
-- unlike `sales`/`payroll` which needed defensive handling) — matching that
-- existing convention for these new columns too.

DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE NOTICE 'Skipping employee payroll fields migration — public.employees does not exist in this database';
    RETURN;
  END IF;

  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "bankName" TEXT;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "nssfNumber" TEXT;
END $$;
