'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, FilePlus2, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HrDocumentDialog } from '@/components/hr/hr-document-dialog';
import { LegacyContractDialog } from '@/components/hr/legacy-contract-dialog';
import { NewDocumentWizard } from '@/components/hr/new-document-wizard';
import { cn } from '@/lib/utils';
import { formatLongDate, formatMoney } from '@/lib/hr-docs/render';
import {
  CONTRACT_TYPE_LABEL, RECOGNITION_CATEGORY_LABEL, REWARD_TYPE_LABEL, WARNING_LEVEL_LABEL,
} from '@/lib/hr-docs/types/shared';
import { isWarningInForce, listContracts, listRecognition, listWarnings } from '@/services/hrRecordsService';
import type { DisciplinaryRecord, Employee, EmploymentContract, HrDocTypeCode, RecognitionRecord } from '@/types';

// The three HR-only record tabs on the employee profile: Contracts,
// Disciplinary and Recognition. Each lists what is on file, links to the letter
// behind each record, and offers the next sensible letter.

const CONTRACT_TONE: Record<EmploymentContract['status'], string> = {
  active: 'border-green-300 bg-green-50 text-green-800', extended: 'border-blue-300 bg-blue-50 text-blue-800',
  terminated: 'border-red-300 bg-red-50 text-red-800', expired: 'border-slate-300 bg-slate-100 text-slate-700',
  void: 'border-slate-300 bg-slate-50 text-slate-500 line-through',
};
const CONTRACT_STATUS_LABEL: Record<EmploymentContract['status'], string> = {
  active: 'Active', extended: 'Extended', terminated: 'Terminated', expired: 'Expired', void: 'Void',
};

function useLetterLauncher(employeeId: string, onSaved: () => void) {
  const [type, setType] = useState<HrDocTypeCode | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const ui = (
    <>
      <NewDocumentWizard isOpen={!!type} setIsOpen={(o) => !o && setType(null)} defaultDocType={type ?? undefined} defaultEmployeeId={employeeId}
        onSaved={(d) => { onSaved(); setOpenId(d.id); }} />
      <HrDocumentDialog documentId={openId} isOpen={!!openId} setIsOpen={(o) => !o && setOpenId(null)} onChanged={onSaved} />
    </>
  );
  return { prepare: setType, openLetter: setOpenId, ui };
}

// ── Contracts ──────────────────────────────────────────────────────────────

export function EmployeeContractsTab({ employee }: { employee: Employee }) {
  const [rows, setRows] = useState<EmploymentContract[] | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const load = useCallback(() => { listContracts(employee.id).then(setRows).catch(() => setRows([])); }, [employee.id]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const { prepare, openLetter, ui } = useLetterLauncher(employee.id, load);

  const active = rows?.find((c) => c.status === 'active') ?? null;
  const isActive = employee.status === 'Active';
  // Newest first reads as "where things stand now"; arrows show the chain.
  const ordered = [...(rows ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium text-primary">Contracts</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setLegacyOpen(true)}>Record existing contract</Button>
          {isActive && active?.end_date && <Button size="sm" onClick={() => prepare('extension')}><FilePlus2 className="mr-2 h-4 w-4" />Prepare extension</Button>}
          {isActive && !active && <Button size="sm" onClick={() => prepare('contract')}><FilePlus2 className="mr-2 h-4 w-4" />Prepare contract</Button>}
        </div>
      </div>

      {rows === null ? <Loader2 className="h-5 w-5 animate-spin" /> : rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No contract on file. If {employee.firstName} has a contract on paper, use “Record existing contract” so expiry reminders cover it.
        </p>
      ) : (
        <ol className="space-y-1">
          {ordered.map((c, i) => (
            <li key={c.id}>
              <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm', c.status === 'active' && 'border-green-300')}>
                <div>
                  <p className="font-medium">
                    {CONTRACT_TYPE_LABEL[c.contract_type]} · {c.position ?? 'no position recorded'}
                    {c.source === 'legacy' && <Badge variant="outline" className="ml-2">Recorded, no letter</Badge>}
                  </p>
                  <p className="text-muted-foreground">
                    {formatLongDate(c.start_date)} → {c.end_date ? formatLongDate(c.end_date) : 'no end date'}
                    {c.salary ? ` · ${formatMoney(c.salary)} per month` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={CONTRACT_TONE[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
                  {c.document_id && <Button variant="ghost" size="sm" onClick={() => openLetter(c.document_id)}><FileText className="mr-1 h-3.5 w-3.5" />Letter</Button>}
                </div>
              </div>
              {c.parent_contract_id && i < ordered.length - 1 && (
                <p className="flex items-center gap-1 py-0.5 pl-4 text-xs text-muted-foreground"><ArrowDown className="h-3 w-3 rotate-180" />extends the contract below</p>
              )}
            </li>
          ))}
        </ol>
      )}
      <LegacyContractDialog isOpen={legacyOpen} setIsOpen={setLegacyOpen} employee={employee} hasActive={!!active} onSaved={load} />
      {ui}
    </div>
  );
}

// ── Disciplinary (confidential) ────────────────────────────────────────────

export function EmployeeDisciplinaryTab({ employee }: { employee: Employee }) {
  const [rows, setRows] = useState<DisciplinaryRecord[] | null>(null);
  const load = useCallback(() => { listWarnings(employee.id).then(setRows).catch(() => setRows([])); }, [employee.id]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const { prepare, openLetter, ui } = useLetterLauncher(employee.id, load);

  const stateOf = (w: DisciplinaryRecord) =>
    w.status === 'void' ? { label: 'Void', tone: CONTRACT_TONE.void }
    : isWarningInForce(w) ? { label: 'In force', tone: 'border-red-300 bg-red-50 text-red-800' }
    : { label: 'Expired', tone: CONTRACT_TONE.expired };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium text-primary">Disciplinary record</h3>
          <p className="text-xs text-muted-foreground">Confidential: visible only to the HR Manager, General Manager and Admin.</p>
        </div>
        {employee.status === 'Active' && <Button size="sm" onClick={() => prepare('warning')}><FilePlus2 className="mr-2 h-4 w-4" />Prepare warning</Button>}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Level</TableHead><TableHead>Offence</TableHead><TableHead>Incident</TableHead><TableHead>On file until</TableHead><TableHead>State</TableHead><TableHead className="w-[1%]" /></TableRow></TableHeader>
          <TableBody>
            {rows === null && <TableRow><TableCell colSpan={6} className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
            {rows?.map((w) => {
              const s = stateOf(w);
              return (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{WARNING_LEVEL_LABEL[w.level]}</TableCell>
                  <TableCell>{w.offence_category}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatLongDate(w.incident_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatLongDate(w.expires_on)}</TableCell>
                  <TableCell><Badge variant="outline" className={s.tone}>{s.label}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => openLetter(w.document_id)}><FileText className="mr-1 h-3.5 w-3.5" />Letter</Button></TableCell>
                </TableRow>
              );
            })}
            {rows && rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No warnings on file.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {ui}
    </div>
  );
}

// ── Recognition ────────────────────────────────────────────────────────────

const PAYROLL_LABEL: Record<RecognitionRecord['payroll_status'], string> = { not_applicable: '—', pending: 'Waiting for payroll', paid: 'Paid' };

export function EmployeeRecognitionTab({ employee }: { employee: Employee }) {
  const [rows, setRows] = useState<RecognitionRecord[] | null>(null);
  const load = useCallback(() => { listRecognition(employee.id).then(setRows).catch(() => setRows([])); }, [employee.id]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const { prepare, openLetter, ui } = useLetterLauncher(employee.id, load);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium text-primary">Recognition</h3>
        {employee.status === 'Active' && <Button size="sm" onClick={() => prepare('recognition')}><FilePlus2 className="mr-2 h-4 w-4" />Prepare recognition</Button>}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>For</TableHead><TableHead>Reward</TableHead><TableHead>Payroll</TableHead><TableHead>Date</TableHead><TableHead className="w-[1%]" /></TableRow></TableHeader>
          <TableBody>
            {rows === null && <TableRow><TableCell colSpan={5} className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
            {rows?.map((r) => (
              <TableRow key={r.id} className={r.status === 'void' ? 'opacity-60' : ''}>
                <TableCell className="font-medium">{RECOGNITION_CATEGORY_LABEL[r.category]}{r.status === 'void' && <Badge variant="outline" className="ml-2">Void</Badge>}</TableCell>
                <TableCell>{REWARD_TYPE_LABEL[r.reward_type]}{r.amount ? ` · ${formatMoney(r.amount)}` : ''}</TableCell>
                <TableCell>{PAYROLL_LABEL[r.payroll_status]}</TableCell>
                <TableCell className="whitespace-nowrap">{formatLongDate(r.created_at.slice(0, 10))}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => openLetter(r.document_id)}><FileText className="mr-1 h-3.5 w-3.5" />Letter</Button></TableCell>
              </TableRow>
            ))}
            {rows && rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No recognition on file yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {ui}
    </div>
  );
}

// ── Header badge ───────────────────────────────────────────────────────────

/** "2 active warnings", shown in the profile header for HR roles. Nothing when there are none. */
export function ActiveWarningsBadge({ employeeId }: { employeeId: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    listWarnings(employeeId).then((w) => { if (active) setCount(w.filter((x) => isWarningInForce(x)).length); }).catch(() => undefined);
    return () => { active = false; };
  }, [employeeId]);
  if (count === 0) return null;
  return <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">{count} active warning{count === 1 ? '' : 's'}</Badge>;
}
