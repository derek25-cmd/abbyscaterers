import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// updatePayroll used to log an audit_log 'payroll.update' event even when
// the database write failed (it only warns and falls through rather than
// throwing) — the audit trail could claim an update happened when only
// localStorage changed. This test pins the fix: no audit event on failure.
// It also used to always `return true` regardless of outcome — now returns
// the real success/failure so callers (e.g. "Mark as Paid") aren't misled.

const fromMock = vi.fn();
const logAuditEventMock = vi.fn();
const getActiveTaxRatesMock = vi.fn();
const getEmployeesMock = vi.fn();

const TEST_RATES = {
  id: 'rate-1',
  payeBands: [{ min: 0, max: null, rate: 0.1 }],
  nssfEmployeeRate: 0.1,
  nssfEmployerRate: 0.1,
  sdlRate: 0.035,
  wcfRate: 0.005,
};

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) },
}));
vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));
vi.mock('@/services/taxRatesService', () => ({
  getActiveTaxRates: () => getActiveTaxRatesMock(),
}));
vi.mock('@/services/employeeService', () => ({
  getEmployees: () => getEmployeesMock(),
}));

describe('payrollService.updatePayroll', () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAuditEventMock.mockReset();
  });

  it('does NOT log an audit event when the database update fails, and returns false', async () => {
    const { updatePayroll } = await import('../payrollService');

    fromMock.mockImplementation(() =>
      mockQueryResult({ data: null, error: { message: 'network error, no such column' } })
    );

    const result = await updatePayroll('payroll-1', { status: 'Paid' });

    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('logs an audit event and returns true when the database update succeeds', async () => {
    const { updatePayroll } = await import('../payrollService');

    fromMock.mockImplementation(() => mockQueryResult({ data: null, error: null }));

    const result = await updatePayroll('payroll-1', { status: 'Paid' });

    expect(logAuditEventMock).toHaveBeenCalledWith(
      'payroll.update',
      'payroll',
      'payroll-1',
      expect.objectContaining({ fields: expect.any(Array) })
    );
    expect(result).toBe(true);
  });
});

describe('payrollService.addPayroll', () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAuditEventMock.mockReset();
    getActiveTaxRatesMock.mockReset();
  });

  it('throws if no active tax rates are configured, without writing anything', async () => {
    const { addPayroll } = await import('../payrollService');
    getActiveTaxRatesMock.mockResolvedValue(null);

    await expect(addPayroll({
      employeeId: 'emp-1', employeeName: 'Test Employee', staffType: 'permanent',
      monthlySalary: 500000, allowances: 0, otherDeductions: 0,
      payPeriodStart: '2026-01-01', payPeriodEnd: '2026-01-31', status: 'Pending',
    })).rejects.toThrow(/tax rates/i);

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('writes itemized statutory columns computed by the engine, not a raw lump deduction', async () => {
    const { addPayroll } = await import('../payrollService');
    getActiveTaxRatesMock.mockResolvedValue(TEST_RATES);

    let insertedPayload: any = null;
    fromMock.mockImplementation((table: string) => {
      const builder = mockQueryResult({ data: { id: 'PAY-1' }, error: null });
      builder.insert = vi.fn((rows: any[]) => { insertedPayload = rows[0]; return builder; });
      return builder;
    });

    await addPayroll({
      employeeId: 'emp-1', employeeName: 'Test Employee', staffType: 'permanent',
      monthlySalary: 500000, allowances: 0, otherDeductions: 0,
      payPeriodStart: '2026-01-01', payPeriodEnd: '2026-01-31', status: 'Pending',
    });

    expect(insertedPayload.paye_amount).toBe(50000); // 500000 * 0.10 (flat test band)
    expect(insertedPayload.nssf_employee).toBe(50000);
    expect(insertedPayload.tax_rate_version_id).toBe('rate-1');
    expect(insertedPayload.deductions).toBe(insertedPayload.paye_amount + insertedPayload.nssf_employee);
  });
});

describe('payrollService.runMonthlyPayroll', () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAuditEventMock.mockReset();
    getActiveTaxRatesMock.mockReset();
    getEmployeesMock.mockReset();
  });

  it('skips active employees with no monthly salary instead of zero-filling them', async () => {
    const { runMonthlyPayroll } = await import('../payrollService');
    getActiveTaxRatesMock.mockResolvedValue(TEST_RATES);
    getEmployeesMock.mockResolvedValue([
      { id: 'emp-1', firstName: 'Has', lastName: 'Salary', status: 'Active', monthlySalary: 400000 },
      { id: 'emp-2', firstName: 'No', lastName: 'Salary', status: 'Active', monthlySalary: 0 },
      { id: 'emp-3', firstName: 'Inactive', lastName: 'Person', status: 'Inactive', monthlySalary: 300000 },
    ]);
    fromMock.mockImplementation(() => mockQueryResult({ data: { id: 'PAY-x' }, error: null }));

    const result = await runMonthlyPayroll('2026-01-01', '2026-01-31');

    expect(result.created).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].employeeId).toBe('emp-2');
  });
});
