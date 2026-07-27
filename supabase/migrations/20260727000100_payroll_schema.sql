-- Adds itemized statutory-deduction columns to the existing `payroll` table
-- and formalizes constraints that were missing (only `id` was NOT NULL —
-- see prior session's audit). This table has no earlier tracked
-- CREATE TABLE migration (only 20260529124000_accounting_five_ledgers.sql's
-- ADD COLUMN calls against an assumed-existing table) — same untracked-
-- schema-drift pattern as orders.client_id found earlier this session.
--
-- Verified against the live database before writing this migration (via
-- read-only checks, not assumptions):
--   - Core columns are genuinely camelCase-quoted (employeeId, basicSalary,
--     grossSalary, netSalary, etc.) — matching src/db/schema.sql's dump,
--     NOT the same lowercase-drift the `sales` table turned out to have.
--   - The newer columns already added by 20260529124000 (event_id,
--     staff_type, days_worked, daily_rate, wcf_contrib) are snake_case —
--     new columns here follow that same newer-addition convention.
--   - Zero orphaned "employeeId" references against employees.id (1 live
--     payroll row total) — the new FK is added as a normal validated
--     constraint, not NOT VALID.
--   - Only 1 live row, all zeros — NOT NULL DEFAULT 0 backfills it safely.

DO $$
BEGIN
  IF to_regclass('public.payroll') IS NULL THEN
    RAISE NOTICE 'Skipping payroll schema migration — public.payroll does not exist in this database';
    RETURN;
  END IF;

  -- Itemized statutory deduction columns (replacing the single free-typed
  -- "deductions" lump sum with real components; "deductions" itself is kept
  -- as a persisted computed total written by the calc engine, not user-typed).
  ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS paye_amount NUMERIC NOT NULL DEFAULT 0;
  ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS nssf_employee NUMERIC NOT NULL DEFAULT 0;
  ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS nssf_employer NUMERIC NOT NULL DEFAULT 0;
  ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS sdl_amount NUMERIC NOT NULL DEFAULT 0;
  ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS other_deductions NUMERIC NOT NULL DEFAULT 0;

  -- Pins which rate version computed this payslip, so historical payslips
  -- stay correct/auditable if tax_rates change later. Nullable: existing
  -- rows (and any computed before this table existed) have no attributable
  -- version.
  IF to_regclass('public.tax_rates') IS NOT NULL THEN
    ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS tax_rate_version_id UUID REFERENCES public.tax_rates(id);
  END IF;

  -- wcf_contrib already exists (added by 20260529124000) but was left
  -- nullable with no default — bring it in line with the new columns.
  UPDATE public.payroll SET wcf_contrib = 0 WHERE wcf_contrib IS NULL;
  ALTER TABLE public.payroll ALTER COLUMN wcf_contrib SET DEFAULT 0;
  ALTER TABLE public.payroll ALTER COLUMN wcf_contrib SET NOT NULL;

  -- Core money columns had no NOT NULL/CHECK constraints at all (only "id"
  -- was required) — backfill any existing NULLs to 0, then constrain.
  UPDATE public.payroll SET "basicSalary" = 0 WHERE "basicSalary" IS NULL;
  UPDATE public.payroll SET allowances = 0 WHERE allowances IS NULL;
  UPDATE public.payroll SET deductions = 0 WHERE deductions IS NULL;
  UPDATE public.payroll SET "grossSalary" = 0 WHERE "grossSalary" IS NULL;
  UPDATE public.payroll SET "netSalary" = 0 WHERE "netSalary" IS NULL;

  ALTER TABLE public.payroll ALTER COLUMN "basicSalary" SET DEFAULT 0;
  ALTER TABLE public.payroll ALTER COLUMN "basicSalary" SET NOT NULL;
  ALTER TABLE public.payroll ALTER COLUMN allowances SET DEFAULT 0;
  ALTER TABLE public.payroll ALTER COLUMN allowances SET NOT NULL;
  ALTER TABLE public.payroll ALTER COLUMN deductions SET DEFAULT 0;
  ALTER TABLE public.payroll ALTER COLUMN deductions SET NOT NULL;
  ALTER TABLE public.payroll ALTER COLUMN "grossSalary" SET DEFAULT 0;
  ALTER TABLE public.payroll ALTER COLUMN "grossSalary" SET NOT NULL;
  ALTER TABLE public.payroll ALTER COLUMN "netSalary" SET DEFAULT 0;
  ALTER TABLE public.payroll ALTER COLUMN "netSalary" SET NOT NULL;

  -- Non-negative checks on every money column (idempotent via name check,
  -- ADD CONSTRAINT has no IF NOT EXISTS clause in Postgres).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_basic_salary_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_basic_salary_nonneg CHECK ("basicSalary" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_allowances_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_allowances_nonneg CHECK (allowances >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_deductions_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_deductions_nonneg CHECK (deductions >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_gross_salary_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_gross_salary_nonneg CHECK ("grossSalary" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_net_salary_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_net_salary_nonneg CHECK ("netSalary" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_paye_amount_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_paye_amount_nonneg CHECK (paye_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_nssf_employee_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_nssf_employee_nonneg CHECK (nssf_employee >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_nssf_employer_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_nssf_employer_nonneg CHECK (nssf_employer >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_sdl_amount_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_sdl_amount_nonneg CHECK (sdl_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_other_deductions_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_other_deductions_nonneg CHECK (other_deductions >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_wcf_contrib_nonneg') THEN
    ALTER TABLE public.payroll ADD CONSTRAINT payroll_wcf_contrib_nonneg CHECK (wcf_contrib >= 0);
  END IF;

  -- FK to employees — verified zero orphans live, safe to add validated.
  IF to_regclass('public.employees') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_employee_id_fkey')
  THEN
    ALTER TABLE public.payroll
      ADD CONSTRAINT payroll_employee_id_fkey
      FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON public.payroll ("employeeId");
  CREATE INDEX IF NOT EXISTS idx_payroll_pay_period_start ON public.payroll ("payPeriodStart");

  RAISE NOTICE 'payroll schema migration applied';
END $$;
