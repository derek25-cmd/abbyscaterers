import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

const fromMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) },
}));

describe('taxRatesService.getActiveTaxRates', () => {
  beforeEach(() => fromMock.mockReset());

  it('maps the active row (effective_to IS NULL) to the engine TaxRates shape', async () => {
    const { getActiveTaxRates } = await import('../taxRatesService');

    fromMock.mockImplementation(() => mockQueryResult({
      data: {
        id: 'rate-1',
        paye_bands: [{ min: 0, max: null, rate: 0.1 }],
        nssf_employee_rate: '0.10',
        nssf_employer_rate: '0.10',
        sdl_rate: '0.035',
        wcf_rate: '0.005',
      },
      error: null,
    }));

    const rates = await getActiveTaxRates();
    expect(rates).toEqual({
      id: 'rate-1',
      payeBands: [{ min: 0, max: null, rate: 0.1 }],
      nssfEmployeeRate: 0.1,
      nssfEmployerRate: 0.1,
      sdlRate: 0.035,
      wcfRate: 0.005,
    });
  });

  it('returns null when no active rate set exists', async () => {
    const { getActiveTaxRates } = await import('../taxRatesService');
    fromMock.mockImplementation(() => mockQueryResult({ data: null, error: null }));

    expect(await getActiveTaxRates()).toBeNull();
  });

  it('returns null (not throw) on a query error', async () => {
    const { getActiveTaxRates } = await import('../taxRatesService');
    fromMock.mockImplementation(() => mockQueryResult({ data: null, error: { message: 'network error' } }));

    expect(await getActiveTaxRates()).toBeNull();
  });
});

describe('taxRatesService.addTaxRate', () => {
  beforeEach(() => fromMock.mockReset());

  it('closes out the currently-active version before inserting the new one', async () => {
    const { addTaxRate } = await import('../taxRatesService');

    const updateSpy = vi.fn();
    let insertedPayload: any = null;

    fromMock.mockImplementation((table: string) => {
      const builder = mockQueryResult({
        data: { id: 'current-rate', effective_from: '2025-01-01' },
        error: null,
      });
      builder.update = updateSpy.mockImplementation((payload: any) => {
        expect(payload.effective_to).toBe('2025-12-31'); // day before the new effectiveFrom
        return builder;
      });
      builder.insert = vi.fn((rows: any[]) => {
        insertedPayload = rows[0];
        return mockQueryResult({ data: { id: 'new-rate' }, error: null });
      });
      return builder;
    });

    const newId = await addTaxRate({
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      payeBands: [{ min: 0, max: null, rate: 0.08 }],
      nssfEmployeeRate: 0.1,
      nssfEmployerRate: 0.1,
      sdlRate: 0.035,
      wcfRate: 0.005,
    });

    expect(updateSpy).toHaveBeenCalled();
    expect(insertedPayload.effective_from).toBe('2026-01-01');
    expect(newId).toBe('new-rate');
  });

  it('rejects invalid PAYE bands (gap between bands) before touching the database', async () => {
    const { addTaxRate } = await import('../taxRatesService');

    await expect(addTaxRate({
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      payeBands: [
        { min: 0, max: 100000, rate: 0 },
        { min: 200000, max: null, rate: 0.1 }, // gap: previous band ended at 100000
      ],
      nssfEmployeeRate: 0.1,
      nssfEmployerRate: 0.1,
      sdlRate: 0.035,
      wcfRate: 0.005,
    })).rejects.toThrow();

    expect(fromMock).not.toHaveBeenCalled();
  });
});
