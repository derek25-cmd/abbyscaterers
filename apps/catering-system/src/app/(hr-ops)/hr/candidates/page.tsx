'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, MoreHorizontal, UserPlus } from 'lucide-react';
import { RequirePermission } from '@/components/auth/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEmployeeDialog } from '@/components/hr/add-employee-dialog';
import { CandidateDialog } from '@/components/hr/candidate-dialog';
import { HrDocumentDialog } from '@/components/hr/hr-document-dialog';
import { NewDocumentWizard } from '@/components/hr/new-document-wizard';
import { useToast } from '@/hooks/use-toast';
import { DEPARTMENTS } from '@/lib/schemas';
import { formatMoney } from '@/lib/hr-docs/render';
import { OFFER_STATUS_LABEL } from '@/lib/hr-docs/types/shared';
import { addEmployee } from '@/services/employeeService';
import {
  deleteCandidate, getAcceptedOfferTerms, linkCandidateToEmployee, listCandidates, respondToOffer,
} from '@/services/candidateService';
import { todayInDar } from '@/services/hrDocumentService';
import type { Candidate, OfferStatus } from '@/types';

const ANY = '__any__';
const STATUS_TONE: Record<OfferStatus, string> = {
  none: 'border-slate-300 bg-slate-50 text-slate-700', offered: 'border-amber-300 bg-amber-50 text-amber-800',
  accepted: 'border-green-300 bg-green-50 text-green-800', declined: 'border-red-300 bg-red-50 text-red-800',
  expired: 'border-slate-300 bg-slate-100 text-slate-600', withdrawn: 'border-slate-300 bg-slate-100 text-slate-600',
};

export default function CandidatesPage() {
  return (
    <RequirePermission permission="hr.manage" fallback={<p className="p-6 text-muted-foreground">Candidates are only available to the HR Manager, General Manager and Admin.</p>}>
      <Candidates />
    </RequirePermission>
  );
}

function Candidates() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Candidate | null | 'new'>(null);
  const [offerFor, setOfferFor] = useState<Candidate | null>(null);
  const [respondTo, setRespondTo] = useState<Candidate | null>(null);
  const [convert, setConvert] = useState<{ candidate: Candidate; values: Record<string, unknown> } | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const load = useCallback(() => {
    listCandidates()
      .then(setRows)
      .catch((err) => { setRows([]); toast({ variant: 'destructive', title: 'Could not load candidates', description: err instanceof Error ? err.message : undefined }); });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((c) => (!status || c.offer_status === status)
      && (!q || `${c.full_name} ${c.position ?? ''} ${c.department ?? ''}`.toLowerCase().includes(q)));
  }, [rows, status, search]);

  const startConversion = async (c: Candidate) => {
    const terms = (await getAcceptedOfferTerms(c)) ?? {};
    const [firstName, ...rest] = c.full_name.trim().split(/\s+/);
    const department = String(terms.department ?? c.department ?? '');
    setConvert({
      candidate: c,
      values: {
        firstName, lastName: rest.join(' '), phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '',
        role: String(terms.position ?? c.position ?? ''),
        // Only a department the employee record knows can be pre-selected.
        department: (DEPARTMENTS as readonly string[]).includes(department) ? department : '',
        monthlySalary: Number(terms.salary ?? c.proposed_salary ?? 0),
        employmentStartDate: String(terms.startDate ?? c.proposed_start_date ?? ''),
      },
    });
  };

  const onEmployeeCreated = async (employee: Record<string, unknown>) => {
    if (!convert) return;
    const created = await addEmployee(employee as never);
    try {
      await linkCandidateToEmployee(convert.candidate.id, created.id);
      toast({ title: `${convert.candidate.full_name} is now an employee`, description: 'Next, prepare their employment contract from their profile.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Employee created, but not linked to the candidate', description: err instanceof Error ? err.message : undefined });
    }
    setConvert(null);
    load();
  };

  const remove = async (c: Candidate) => {
    try { await deleteCandidate(c.id); toast({ title: 'Candidate deleted' }); load(); }
    catch (err) { toast({ variant: 'destructive', title: 'Could not delete', description: err instanceof Error ? err.message : undefined }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Candidates</h1>
          <p className="text-sm text-muted-foreground">People you may hire: prepare their offer letter, record their answer, and turn them into an employee.</p>
        </div>
        <Button onClick={() => setEditing('new')}><UserPlus className="mr-2 h-4 w-4" />Add candidate</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Offer</Label>
          <Select value={status || ANY} onValueChange={(v) => setStatus(v === ANY ? '' : v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any</SelectItem>
              {(Object.keys(OFFER_STATUS_LABEL) as OfferStatus[]).map((s) => <SelectItem key={s} value={s}>{OFFER_STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cand-search">Find</Label>
          <Input id="cand-search" className="w-64" placeholder="Name or position" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Position</TableHead><TableHead>Proposed salary</TableHead>
              <TableHead>Offer</TableHead><TableHead>Answered</TableHead><TableHead className="w-[1%]"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && <TableRow><TableCell colSpan={6} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
            {filtered.map((c) => {
              const canOffer = !c.employee_id && c.offer_status !== 'offered' && c.offer_status !== 'accepted';
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}{c.employee_id && <Badge variant="secondary" className="ml-2">Employee</Badge>}</TableCell>
                  <TableCell>{c.position ?? '—'}{c.department && <span className="block text-xs text-muted-foreground">{c.department}</span>}</TableCell>
                  <TableCell>{c.proposed_salary ? formatMoney(c.proposed_salary) : '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_TONE[c.offer_status]}>{OFFER_STATUS_LABEL[c.offer_status]}</Badge></TableCell>
                  <TableCell className="text-xs">{c.responded_at ? format(parseISO(c.responded_at), 'd MMM yyyy') : '—'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${c.full_name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(c)}>Edit details</DropdownMenuItem>
                        {canOffer && <DropdownMenuItem onClick={() => setOfferFor(c)}>Prepare offer</DropdownMenuItem>}
                        {c.offer_document_id && <DropdownMenuItem onClick={() => setOpenDocId(c.offer_document_id)}>Open offer letter</DropdownMenuItem>}
                        {c.offer_status === 'offered' && <DropdownMenuItem onClick={() => setRespondTo(c)}>Record response…</DropdownMenuItem>}
                        {c.offer_status === 'accepted' && !c.employee_id && <DropdownMenuItem onClick={() => startConversion(c)}>Convert to employee</DropdownMenuItem>}
                        {c.offer_status === 'none' && !c.offer_document_id && !c.employee_id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-700 focus:text-red-700" onClick={() => remove(c)}>Delete</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                {rows.length === 0 ? 'No candidates yet. Press “Add candidate” to start.' : 'No candidates match.'}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CandidateDialog isOpen={!!editing} setIsOpen={(o) => !o && setEditing(null)} candidate={editing === 'new' ? null : editing} onSaved={load} />
      <NewDocumentWizard isOpen={!!offerFor} setIsOpen={(o) => !o && setOfferFor(null)} defaultDocType="offer" defaultCandidateId={offerFor?.id} onSaved={(d) => { load(); setOpenDocId(d.id); }} />
      <RespondDialog candidate={respondTo} onClose={() => setRespondTo(null)} onDone={load} />
      <AddEmployeeDialog
        isOpen={!!convert} setIsOpen={(o: boolean) => !o && setConvert(null)} onAddEmployee={onEmployeeCreated}
        initialValues={convert?.values ?? null}
        title={convert ? `Convert ${convert.candidate.full_name} to an employee` : null}
        description="Filled in from the candidate and the accepted offer. Check every field, add the rest, and save."
      />
      <HrDocumentDialog documentId={openDocId} isOpen={!!openDocId} setIsOpen={(o) => !o && setOpenDocId(null)} onChanged={load} />
    </div>
  );
}

/** Record what the candidate answered, and when. */
function RespondDialog({ candidate, onClose, onDone }: { candidate: Candidate | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [answer, setAnswer] = useState<'accepted' | 'declined' | 'withdrawn'>('accepted');
  const [date, setDate] = useState(todayInDar());
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (candidate) { setAnswer('accepted'); setDate(todayInDar()); } }, [candidate]);

  const save = async () => {
    if (!candidate) return;
    setSaving(true);
    try {
      await respondToOffer(candidate.id, answer, date);
      toast({
        title: `Offer ${answer}`,
        description: answer === 'accepted' ? 'You can now convert the candidate into an employee from the list.' : undefined,
      });
      onClose(); onDone();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not record the response', description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => !saving && !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Response from {candidate?.full_name}</DialogTitle>
          <DialogDescription>“Withdrawn” means the company withdrew the offer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {(['accepted', 'declined', 'withdrawn'] as const).map((a) => (
              <Button key={a} type="button" variant={answer === a ? 'default' : 'outline'} onClick={() => setAnswer(a)} role="radio" aria-checked={answer === a}>
                {a[0].toUpperCase() + a.slice(1)}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5"><Label htmlFor="resp-date">Date of the answer</Label><Input id="resp-date" type="date" value={date} max={todayInDar()} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !date}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
