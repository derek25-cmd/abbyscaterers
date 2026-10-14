import { describe, it, expect } from 'vitest';
import { buildNumberLedger, formatRefNo, parseRefNo } from '../hr-docs/ledger';

const doc = (ref: string | null, status: string, extra: object = {}) =>
  ({ id: `id-${ref}`, ref_no: ref, status, subject: `Subject ${ref}`, void_reason: null, ...extra }) as never;

describe('reference numbers', () => {
  it('formats and parses', () => {
    expect(formatRefNo('GEN', 2026, 7)).toBe('ALC/HR/GEN/2026/0007');
    expect(parseRefNo('ALC/HR/GEN/2026/0007')).toEqual({ code: 'GEN', year: 2026, seq: 7 });
    expect(parseRefNo('ALC/HR/GEN/2026/12345')).toEqual({ code: 'GEN', year: 2026, seq: 12345 });
    expect(parseRefNo('nonsense')).toBeNull();
  });
});

describe('buildNumberLedger', () => {
  it('accounts for issued, voided (with the reason) and reserved numbers', () => {
    const rows = buildNumberLedger([
      doc('ALC/HR/GEN/2026/0001', 'issued'),
      doc('ALC/HR/GEN/2026/0002', 'void', { void_reason: 'wrong employee' }),
      doc('ALC/HR/GEN/2026/0003', 'approved'),
    ], 'GEN', 2026);
    expect(rows.map((r) => r.state)).toEqual(['issued', 'void', 'reserved']);
    expect(rows[1].note).toBe('wrong employee');
    expect(rows[2].note).toMatch(/not been issued/);
  });

  it('flags a number nothing holds, so someone looks into it', () => {
    const rows = buildNumberLedger([doc('ALC/HR/GEN/2026/0001', 'issued'), doc('ALC/HR/GEN/2026/0004', 'issued')], 'GEN', 2026);
    expect(rows.map((r) => `${r.seq}:${r.state}`)).toEqual(['1:issued', '2:unaccounted', '3:unaccounted', '4:issued']);
  });

  it('keeps each type and year separate', () => {
    const rows = buildNumberLedger([
      doc('ALC/HR/GEN/2026/0001', 'issued'), doc('ALC/HR/OFF/2026/0001', 'issued'), doc('ALC/HR/GEN/2025/0009', 'issued'),
    ], 'GEN', 2026);
    expect(rows).toHaveLength(1);
  });

  it('is empty when nothing was issued', () => {
    expect(buildNumberLedger([doc(null, 'draft')], 'GEN', 2026)).toEqual([]);
  });
});
