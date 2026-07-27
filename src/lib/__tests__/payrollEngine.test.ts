import { describe, it, expect } from 'vitest';
import { calculatePAYE, calculatePayroll, type PayeBand, type TaxRates } from '../payrollEngine';

// Seeded bands from supabase/migrations/20260727000000_tax_rates.sql
const BANDS: PayeBand[] = [
  { min: 0, max: 270000, rate: 0 },
  { min: 270000, max: 520000, rate: 0.08 },
  { min: 520000, max: 760000, rate: 0.20 },
  { min: 760000, max: 1000000, rate: 0.25 },
  { min: 1000000, max: null, rate: 0.30 },
];

const RATES: TaxRates = {
  id: 'test-rate',
  payeBands: BANDS,
  nssfEmployeeRate: 0.10,
  nssfEmployerRate: 0.10,
  sdlRate: 0.035,
  wcfRate: 0.005,
};

describe('calculatePAYE', () => {
  it('is zero within the exempt band', () => {
    expect(calculatePAYE(200000, BANDS)).toBe(0);
  });

  it('is zero exactly at a band boundary (boundary belongs to the lower band)', () => {
    expect(calculatePAYE(270000, BANDS)).toBe(0);
  });

  it('taxes only the portion within the second band', () => {
    // (400000 - 270000) * 0.08 = 10400
    expect(calculatePAYE(400000, BANDS)).toBe(10400);
  });

  it('sums marginal tax across three bands', () => {
    // band2: (520000-270000)*0.08=20000; band3: (600000-520000)*0.20=16000
    expect(calculatePAYE(600000, BANDS)).toBe(36000);
  });

  it('sums marginal tax across four bands', () => {
    // 20000 + (760000-520000)*0.20=48000 + (900000-760000)*0.25=35000 = 103000
    expect(calculatePAYE(900000, BANDS)).toBe(103000);
  });

  it('applies the open-ended top band correctly', () => {
    // 20000 + 48000 + (1000000-760000)*0.25=60000 + (1200000-1000000)*0.30=60000 = 188000
    expect(calculatePAYE(1200000, BANDS)).toBe(188000);
  });

  it('returns zero for zero or negative gross', () => {
    expect(calculatePAYE(0, BANDS)).toBe(0);
    expect(calculatePAYE(-500, BANDS)).toBe(0);
  });

  it('returns zero when no bands are configured', () => {
    expect(calculatePAYE(500000, [])).toBe(0);
  });
});

describe('calculatePayroll — permanent staff', () => {
  it('computes the full itemized breakdown for a mid-band salary', () => {
    const result = calculatePayroll(
      { staffType: 'permanent', monthlySalary: 600000, allowances: 0, otherDeductions: 0 },
      RATES
    );
    expect(result.basicSalary).toBe(600000);
    expect(result.grossSalary).toBe(600000);
    expect(result.payeAmount).toBe(36000);
    expect(result.nssfEmployee).toBe(60000); // 600000 * 0.10
    expect(result.nssfEmployer).toBe(60000);
    expect(result.sdlAmount).toBe(21000); // 600000 * 0.035
    expect(result.wcfContrib).toBe(3000); // 600000 * 0.005
    expect(result.deductions).toBe(96000); // paye + nssfEmployee + other
    expect(result.netSalary).toBe(504000); // gross - deductions
    expect(result.employerCost).toBe(684000); // gross + nssfEmployer + sdl + wcf
  });

  it('includes allowances in gross/PAYE but not in the NSSF base', () => {
    const result = calculatePayroll(
      { staffType: 'permanent', monthlySalary: 500000, allowances: 100000, otherDeductions: 0 },
      RATES
    );
    expect(result.grossSalary).toBe(600000); // gross includes allowances
    expect(result.nssfEmployee).toBe(50000); // NSSF still based on basicSalary (500000), not gross
  });

  it('subtracts otherDeductions (e.g. loan repayments) from net but not employer cost', () => {
    const result = calculatePayroll(
      { staffType: 'permanent', monthlySalary: 400000, allowances: 0, otherDeductions: 20000 },
      RATES
    );
    expect(result.otherDeductions).toBe(20000);
    expect(result.deductions).toBe(10400 + 40000 + 20000); // paye + nssfEmployee + other
    expect(result.netSalary).toBe(400000 - result.deductions);
  });
});

describe('calculatePayroll — casual staff', () => {
  it('derives basicSalary from daysWorked * dailyRate', () => {
    const result = calculatePayroll(
      { staffType: 'casual', daysWorked: 10, dailyRate: 15000, allowances: 0, otherDeductions: 0 },
      RATES
    );
    expect(result.basicSalary).toBe(150000);
    expect(result.grossSalary).toBe(150000);
  });

  it('handles zero days worked without error', () => {
    const result = calculatePayroll(
      { staffType: 'casual', daysWorked: 0, dailyRate: 15000, allowances: 0, otherDeductions: 0 },
      RATES
    );
    expect(result.basicSalary).toBe(0);
    expect(result.netSalary).toBe(0);
  });
});

describe('calculatePayroll — edge cases', () => {
  it('never produces a negative net salary from a zero-input payroll', () => {
    const result = calculatePayroll(
      { staffType: 'permanent', monthlySalary: 0, allowances: 0, otherDeductions: 0 },
      RATES
    );
    expect(result.netSalary).toBe(0);
    expect(result.payeAmount).toBe(0);
  });
});
