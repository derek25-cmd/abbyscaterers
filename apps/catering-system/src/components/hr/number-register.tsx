'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LEDGER_STATE_LABEL, type LedgerRow, type LedgerState } from '@/lib/hr-docs/ledger';
import { DOC_TYPE_LABELS, DOC_TYPE_ORDER } from '@/lib/hr-docs/registry';
import { getNumberLedger } from '@/services/hrDocumentService';
import type { HrDocTypeCode } from '@/types';
import { cn } from '@/lib/utils';

const TONE: Record<LedgerState, string> = {
  issued: 'border-green-300 bg-green-50 text-green-800',
  void: 'border-red-300 bg-red-50 text-red-800',
  reserved: 'border-orange-300 bg-orange-50 text-orange-900',
  unaccounted: 'border-red-500 bg-red-100 text-red-900',
};

/**
 * Every reference number in a series, one line each, so the numbering can be
 * explained to an auditor: each is an issued letter, a voided one (with the
 * reason) or one reserved for a letter whose issue did not finish. Anything else
 * would show as unaccounted.
 */
export function NumberRegister({ refreshKey, onOpen }: { refreshKey: number; onOpen: (documentId: string) => void }) {
  const thisYear = new Date().getFullYear();
  const [docType, setDocType] = useState<HrDocTypeCode>('general_letter');
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRows(null); setError(null);
    getNumberLedger(docType, year)
      .then((r) => { if (active) setRows(r); })
      .catch((err) => { if (active) { setRows([]); setError(err instanceof Error ? err.message : 'Could not load the numbers.'); } });
    return () => { active = false; };
  }, [docType, year, refreshKey]);

  const tally = useMemo(() => {
    const t: Record<LedgerState, number> = { issued: 0, void: 0, reserved: 0, unaccounted: 0 };
    for (const r of rows ?? []) t[r.state]++;
    return t;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as HrDocTypeCode)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{DOC_TYPE_ORDER.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[thisYear - 2, thisYear - 1, thisYear, thisYear + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {rows && rows.length > 0 && (
          <p className="pb-2 text-sm text-muted-foreground">
            {rows.length} numbers used: {tally.issued} issued, {tally.void} voided, {tally.reserved} reserved
            {tally.unaccounted > 0 && <>, <strong className="text-red-700">{tally.unaccounted} unaccounted</strong></>}.
          </p>
        )}
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>State</TableHead><TableHead>Subject</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows === null && <TableRow><TableCell colSpan={4} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
            {rows?.map((r) => (
              <TableRow key={r.seq} className={r.documentId ? 'cursor-pointer' : ''} onClick={() => r.documentId && onOpen(r.documentId)}>
                <TableCell className="whitespace-nowrap font-mono text-xs">{r.refNo}</TableCell>
                <TableCell><Badge variant="outline" className={cn('whitespace-nowrap', TONE[r.state])}>{LEDGER_STATE_LABEL[r.state]}</Badge></TableCell>
                <TableCell className="max-w-[260px] truncate">{r.subject ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.note ?? ''}</TableCell>
              </TableRow>
            ))}
            {rows && rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No numbers have been used for {DOC_TYPE_LABELS[docType]} in {year}.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
