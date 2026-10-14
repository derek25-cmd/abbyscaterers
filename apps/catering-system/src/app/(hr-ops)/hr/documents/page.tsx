'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { FilePlus2, Loader2, MoreHorizontal, Settings2 } from 'lucide-react';
import { RequirePermission } from '@/components/auth/require-permission';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocStatusBadge, docStatusLook } from '@/components/hr/doc-status-badge';
import { HrDocumentDialog, type DocIntent } from '@/components/hr/hr-document-dialog';
import { NewDocumentWizard } from '@/components/hr/new-document-wizard';
import { NumberRegister } from '@/components/hr/number-register';
import { useToast } from '@/hooks/use-toast';
import { DOC_TYPE_LABELS, DOC_TYPE_ORDER } from '@/lib/hr-docs/registry';
import { getDownloadUrl, listDocuments } from '@/services/hrDocumentService';
import type { HrDocTypeCode, HrDocumentStatus, HrDocumentView } from '@/types';

const ANY = '__any__';
const STATUS_OPTIONS: { value: HrDocumentStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' }, { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'approved', label: 'Approved (not issued)' }, { value: 'issued', label: 'Issued' }, { value: 'void', label: 'Void' },
];

export default function HrDocumentsPage() {
  return (
    <RequirePermission
      permission="hr.manage"
      fallback={<p className="p-6 text-muted-foreground">HR documents are only available to the HR Manager, General Manager and Admin.</p>}
    >
      <Register />
    </RequirePermission>
  );
}

function Register() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<HrDocumentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [person, setPerson] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [intent, setIntent] = useState<DocIntent>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    listDocuments()
      .then((d) => { setDocs(d); setError(null); })
      .catch((err) => { setDocs([]); setError(err instanceof Error ? err.message : 'Could not load the documents.'); });
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  const refresh = () => setRefreshKey((k) => k + 1);

  const filtered = useMemo(() => {
    const q = person.trim().toLowerCase();
    return (docs ?? []).filter((d) =>
      (!type || d.doc_type === type) && (!status || d.status === status)
      && (!q || d.person_name.toLowerCase().includes(q) || d.subject.toLowerCase().includes(q) || (d.ref_no ?? '').toLowerCase().includes(q))
      && (!from || d.created_at.slice(0, 10) >= from) && (!to || d.created_at.slice(0, 10) <= to));
  }, [docs, type, status, person, from, to]);

  const counts = useMemo(() => ({
    waiting: (docs ?? []).filter((d) => d.status === 'pending_approval').length,
    toIssue: (docs ?? []).filter((d) => d.status === 'approved' && !d.ref_no).length,
    incomplete: (docs ?? []).filter((d) => d.status === 'approved' && !!d.ref_no).length,
  }), [docs]);

  const openDoc = (id: string, why: DocIntent = null) => { setIntent(why); setOpenId(id); };

  const download = async (id: string) => {
    try { window.open(await getDownloadUrl(id), '_blank', 'noopener'); }
    catch (err) { toast({ variant: 'destructive', title: 'Could not open the PDF', description: err instanceof Error ? err.message : undefined }); }
  };

  const anyFilter = !!(type || status || person || from || to);
  const clear = () => { setType(''); setStatus(''); setPerson(''); setFrom(''); setTo(''); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">HR Documents</h1>
          <p className="text-sm text-muted-foreground">Write letters, get them approved, issue them with a reference number, and find them again.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/hr/documents/templates"><Settings2 className="mr-2 h-4 w-4" />Templates</Link></Button>
          <Button onClick={() => setWizardOpen(true)}><FilePlus2 className="mr-2 h-4 w-4" />New document</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Waiting for approval" value={counts.waiting} tone="amber" onClick={() => setStatus('pending_approval')} />
        <Summary label="Approved, ready to issue" value={counts.toIssue} tone="blue" onClick={() => setStatus('approved')} />
        <Summary label="Issue incomplete (retry)" value={counts.incomplete} tone="orange" onClick={() => setStatus('approved')} />
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="numbers">Reference numbers</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type || ANY} onValueChange={(v) => setType(v === ANY ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any type</SelectItem>
                  {DOC_TYPE_ORDER.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Stage</Label>
              <Select value={status || ANY} onValueChange={(v) => setStatus(v === ANY ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any stage</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-person">Person, subject or number</Label>
              <Input id="doc-person" placeholder="Search" value={person} onChange={(e) => setPerson(e.target.value)} />
            </div>
            <div className="space-y-1"><Label htmlFor="doc-from">Created from</Label><Input id="doc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="doc-to">Created until</Label><Input id="doc-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          {anyFilter && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}

          {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead><TableHead>Type</TableHead><TableHead>Person</TableHead><TableHead>Subject</TableHead>
                  <TableHead>Stage</TableHead><TableHead>Written by</TableHead><TableHead>Approved by</TableHead><TableHead>Issued</TableHead>
                  <TableHead className="w-[1%]"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs === null && <TableRow><TableCell colSpan={9} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
                {filtered.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => openDoc(d.id)}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {d.ref_no ?? <span className="text-muted-foreground">Not yet given</span>}
                      {d.ref_no && d.status === 'approved' && <span className="block font-sans text-[10px] text-orange-700">reserved</span>}
                    </TableCell>
                    <TableCell>{d.type_label}</TableCell>
                    <TableCell className="font-medium">{d.person_name}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={d.subject}>{d.subject}</TableCell>
                    <TableCell><DocStatusBadge doc={d} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.author_email ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.approver_email ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{d.issued_at ? format(parseISO(d.issued_at), 'd MMM yyyy') : '—'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${d.subject}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{docStatusLook(d).label}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openDoc(d.id)}>Open</DropdownMenuItem>
                          {d.status === 'pending_approval' && (
                            <DropdownMenuItem onClick={() => openDoc(d.id, 'approve')}>Review and approve</DropdownMenuItem>
                          )}
                          {d.status === 'approved' && <DropdownMenuItem onClick={() => openDoc(d.id, 'issue')}>{d.ref_no ? 'Finish issuing' : 'Issue'}</DropdownMenuItem>}
                          {d.status === 'issued' && <DropdownMenuItem onClick={() => download(d.id)}>Download PDF</DropdownMenuItem>}
                          {d.status !== 'void' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-700 focus:text-red-700" onClick={() => openDoc(d.id, 'void')}>Void…</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {docs && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      {anyFilter ? 'No documents match these filters.' : 'No documents yet. Press “New document” to write the first one.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="numbers"><NumberRegister refreshKey={refreshKey} onOpen={(id) => openDoc(id)} /></TabsContent>
      </Tabs>

      <NewDocumentWizard isOpen={wizardOpen} setIsOpen={setWizardOpen} onSaved={(doc) => { refresh(); openDoc(doc.id); }} />
      <HrDocumentDialog documentId={openId} isOpen={!!openId} setIsOpen={(o) => { if (!o) { setOpenId(null); setIntent(null); } }} intent={intent} onChanged={refresh} />
    </div>
  );
}

const TONES = { amber: 'text-amber-700 bg-amber-50', blue: 'text-blue-700 bg-blue-50', orange: 'text-orange-700 bg-orange-50' } as const;

function Summary({ label, value, tone, onClick }: { label: string; value: number; tone: keyof typeof TONES; onClick: () => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-lg p-4 text-left transition-colors hover:bg-muted/50">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${TONES[tone]}`}>{value}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </button>
      </CardContent>
    </Card>
  );
}
