/**
 * Pure payroll calculation engine — no React/Supabase imports, so it's
 * trivially unit-testable and safe to call for live UI previews without a
 * network round-trip. Tax rates are always passed in (from tax_rates),
 * never hardcoded here, so a rate change never requires a code deploy.
 *
 * Simplifications (documented, not hidden bugs):
 * - NSSF is computed on basicSalary (pensionable emoluments), not gross
 *   (which includes allowances).
 * - SDL and the employer share of NSSF/WCF are employer-only costs — never
 *   subtracted from the employee's netSalary.
 * - PAYE/NSSF are applied uniformly regardless of staffType. Real-world
 *   treatment of casual/daily-rate staff can differ (e.g. exemption below a
 *   threshold); since rates are admin-configurable, an admin can zero out a
 *   rate for casual runs if their actual policy differs. This is a known
 *   simplification, not an attempt to be definitively correct for every
 *   statutory edge case.
 */

export interface PayeBand {
  min: number;
  max: number | null; // null = "and above"
  rate: number; // 0-1, marginal rate applied only within this band
}

export interface TaxRates {
  id: string;
  payeBands: PayeBand[];
  nssfEmployeeRate: number;
  nssfEmployerRate: number;
  sdlRate: number;
  wcfRate: number;
}

export interface PayrollInput {
  staffType: 'permanent' | 'casual';
  monthlySalary?: number; // permanent
  daysWorked?: number; // casual
  dailyRate?: number; // casual
  allowances: number;
  otherDeductions: number;
}

export interface PayrollBreakdown {
  basicSalary: number;
  grossSalary: number;
  payeAmount: number;
  nssfEmployee: number;
  nssfEmployer: number;
  sdlAmount: number;
  wcfContrib: number;
  otherDeductions: number;
  deductions: number; // paye + nssfEmployee + otherDeductions (employee-side only)
  netSalary: number;
  employerCost: number; // grossSalary + nssfEmployer + sdlAmount + wcfContrib
}

/** Progressive/marginal PAYE — like income tax brackets, not a single flat rate. */
export function calculatePAYE(grossSalary: number, bands: PayeBand[]): number {
  if (grossSalary <= 0 || bands.length === 0) return 0;

  const sorted = [...bands].sort((a, b) => a.min - b.min);
  let tax = 0;

  for (const band of sorted) {
    if (grossSalary <= band.min) break;
    const bandTop = band.max ?? Infinity;
    const taxableInBand = Math.min(grossSalary, bandTop) - band.min;
    if (taxableInBand > 0) {
      tax += taxableInBand * band.rate;
    }
  }

  return Math.round(tax);
}

export function calculatePayroll(input: PayrollInput, rates: TaxRates): PayrollBreakdown {
  const basicSalary = input.staffType === 'permanent'
    ? (input.monthlySalary ?? 0)
    : (input.daysWorked ?? 0) * (input.dailyRate ?? 0);

  const allowances = input.allowances ?? 0;
  const grossSalary = basicSalary + allowances;

  const payeAmount = calculatePAYE(grossSalary, rates.payeBands);
  const nssfEmployee = Math.round(basicSalary * rates.nssfEmployeeRate);
  const nssfEmployer = Math.round(basicSalary * rates.nssfEmployerRate);
  const sdlAmount = Math.round(grossSalary * rates.sdlRate);
  const wcfContrib = Math.round(grossSalary * rates.wcfRate);
  const otherDeductions = input.otherDeductions ?? 0;

  const deductions = payeAmount + nssfEmployee + otherDeductions;
  const netSalary = grossSalary - deductions;
  const employerCost = grossSalary + nssfEmployer + sdlAmount + wcfContrib;

  return {
    basicSalary,
    grossSalary,
    payeAmount,
    nssfEmployee,
    nssfEmployer,
    sdlAmount,
    wcfContrib,
    otherDeductions,
    deductions,
    netSalary,
    employerCost,
  };
}
