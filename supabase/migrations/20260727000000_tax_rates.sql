-- Admin-configurable statutory payroll rates (PAYE bands, NSSF, SDL, WCF).
-- Tanzania's Finance Act changes these periodically — this table lets an
-- admin update them without a code deploy. Effective-dated (effective_from/
-- effective_to) so historical payslips stay attributable to the rates that
-- actually produced them, even after rates change later.
--
-- Depends on public.is_admin() / public.is_active_staff() from
-- 20260714000000_add_roles.sql (confirmed live this session via a read-only
-- check before writing this migration).

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL,
  effective_to DATE, -- NULL = currently active
  -- Progressive PAYE bands: [{"min":0,"max":270000,"rate":0}, ...]. "max":
  -- null means "and above". Rates are per-band marginal rates (like income
  -- tax brackets), not flat/cumulative — see calculatePAYE in
  -- src/lib/payrollEngine.ts for how these are applied.
  paye_bands JSONB NOT NULL,
  nssf_employee_rate NUMERIC NOT NULL DEFAULT 0.10 CHECK (nssf_employee_rate >= 0 AND nssf_employee_rate <= 1),
  nssf_employer_rate NUMERIC NOT NULL DEFAULT 0.10 CHECK (nssf_employer_rate >= 0 AND nssf_employer_rate <= 1),
  sdl_rate NUMERIC NOT NULL DEFAULT 0.035 CHECK (sdl_rate >= 0 AND sdl_rate <= 1),
  wcf_rate NUMERIC NOT NULL DEFAULT 0.005 CHECK (wcf_rate >= 0 AND wcf_rate <= 1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_effective_from ON public.tax_rates (effective_from DESC);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

-- All active staff need read access (the payslip live-preview calc runs for
-- any staff generating a payslip, not just admins) — only admins can edit.
DROP POLICY IF EXISTS "tax_rates_staff_select" ON public.tax_rates;
CREATE POLICY "tax_rates_staff_select" ON public.tax_rates
  FOR SELECT TO authenticated USING (public.is_active_staff());

DROP POLICY IF EXISTS "tax_rates_admin_write" ON public.tax_rates;
CREATE POLICY "tax_rates_admin_write" ON public.tax_rates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed one active row with approximate current TZS resident-individual PAYE
-- bands (TRA-style monthly brackets) and standard NSSF/SDL/WCF rates. An
-- admin should verify/correct the exact thresholds via the tax-rates admin
-- page before relying on this for real payroll — these are a reasonable
-- starting point, not guaranteed to be the exact current gazetted figures.
INSERT INTO public.tax_rates (effective_from, effective_to, paye_bands, nssf_employee_rate, nssf_employer_rate, sdl_rate, wcf_rate, notes)
SELECT
  '2026-01-01', NULL,
  '[
    {"min": 0, "max": 270000, "rate": 0},
    {"min": 270000, "max": 520000, "rate": 0.08},
    {"min": 520000, "max": 760000, "rate": 0.20},
    {"min": 760000, "max": 1000000, "rate": 0.25},
    {"min": 1000000, "max": null, "rate": 0.30}
  ]'::jsonb,
  0.10, 0.10, 0.035, 0.005,
  'Seeded default — verify against current TRA/NSSF gazetted rates before relying on this for real payroll.'
WHERE NOT EXISTS (SELECT 1 FROM public.tax_rates);
