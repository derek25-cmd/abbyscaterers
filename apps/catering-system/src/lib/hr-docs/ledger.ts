import type { HrDocTypeCode, HrDocument } from '@/types';

/**
 * Accounting for every reference number in a series (one document type, one
 * year). Numbers are never reused and a void keeps its number, so a series has
 * no unexplained holes: each number is an issued letter, a voided one (with the
 * reason), or one reserved for an approved letter whose issue did not finish.
 * A number that is none of these shows as "unaccounted" so someone looks into it.
 */

export type LedgerState = 'issued' | 'void' | 'reserved' | 'unaccounted';

export interface LedgerRow {
  seq: number;
  refNo: string;
  state: LedgerState;
  documentId?: string;
  subject?: string;
  /** Void reason, or why a number is still only reserved. */
  note?: string;
}

const REF = /^ALC\/HR\/([A-Z]{3})\/(\d{4})\/(\d+)$/;

export function parseRefNo(ref: string): { code: string; year: number; seq: number } | null {
  const m = REF.exec(ref);
  return m ? { code: m[1], year: Number(m[2]), seq: Number(m[3]) } : null;
}

export const formatRefNo = (code: string, year: number, seq: number) =>
  `ALC/HR/${code}/${year}/${String(seq).padStart(4, '0')}`;

type LedgerDoc = Pick<HrDocument, 'id' | 'ref_no' | 'status' | 'subject' | 'void_reason'>;

export function buildNumberLedger(docs: LedgerDoc[], code: string, year: number): LedgerRow[] {
  const bySeq = new Map<number, LedgerDoc>();
  let max = 0;
  for (const d of docs) {
    const p = d.ref_no ? parseRefNo(d.ref_no) : null;
    if (!p || p.code !== code || p.year !== year) continue;
    bySeq.set(p.seq, d);
    max = Math.max(max, p.seq);
  }

  const rows: LedgerRow[] = [];
  for (let seq = 1; seq <= max; seq++) {
    const refNo = formatRefNo(code, year, seq);
    const d = bySeq.get(seq);
    if (!d) { rows.push({ seq, refNo, state: 'unaccounted', note: 'No document holds this number.' }); continue; }
    if (d.status === 'issued') rows.push({ seq, refNo, state: 'issued', documentId: d.id, subject: d.subject });
    else if (d.status === 'void') rows.push({ seq, refNo, state: 'void', documentId: d.id, subject: d.subject, note: d.void_reason ?? undefined });
    else rows.push({ seq, refNo, state: 'reserved', documentId: d.id, subject: d.subject, note: 'Reserved for an approved letter that has not been issued yet.' });
  }
  return rows;
}

export const LEDGER_STATE_LABEL: Record<LedgerState, string> = {
  issued: 'Issued',
  void: 'Voided',
  reserved: 'Reserved, not issued',
  unaccounted: 'Unaccounted',
};

export type { HrDocTypeCode };
