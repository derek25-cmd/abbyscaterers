'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, CheckCircle2, Download, Loader2, ShieldCheck } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DocStatusBadge } from '@/components/hr/doc-status-badge';
import { LetterPreview } from '@/components/hr/letter-preview';
import { NewDocumentWizard } from '@/components/hr/new-document-wizard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PENDING_REF, PLACEHOLDER_REFERENCE, formatLongDate } from '@/lib/hr-docs/render';
import { REGISTRY } from '@/lib/hr-docs/registry';
import {
  MissingFieldsError, approve, deleteDraft, getDocument, getDocumentHistory, getDownloadUrl, getNewerTemplate, issue,
  listDocumentTypes, loadRenderInputs, renderDocument, returnToDraft, submit, todayInDar, updateToLatestTemplate,
  verifyDocumentIntegrity, voidDocument, type HistoryEntry, type IntegrityResult, type RenderInputs,
} from '@/services/hrDocumentService';
import type { HrDocTypeCode, HrDocumentTemplate, HrDocumentType, HrDocumentView } from '@/types';

export type DocIntent = 'approve' | 'issue' | 'void' | 'return' | null;
type Confirm = 'approve' | 'issue' | 'void' | 'return' | 'delete' | null;

interface Props {
  documentId: string | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Open straight on the confirmation for this action (from a register row's menu). */
  intent?: DocIntent;
  onChanged?: () => void;
}

const describeField = (path: string, docType?: HrDocTypeCode) => {
  const known = PLACEHOLDER_REFERENCE.find((p) => p.path === path)
    ?? (docType ? REGISTRY[docType]?.placeholders?.find((p) => p.path === path) : undefined);
  return known ? `${known.description} (${path})` : path;
};

/** What voiding an ISSUED letter of this type undoes, in plain words. */
function voidConsequence(docType: HrDocTypeCode): string | null {
  switch (docType) {
    case 'offer': return 'The candidate goes back to "no offer".';
    case 'contract': return 'The contract it created is marked void.';
    case 'extension': return 'The extension contract is marked void, and the contract it extended becomes active again.';
    case 'termination': return 'The employee is NOT reactivated. If they should be employed again, reactivate them by hand afterwards.';
    case 'warning': return 'The warning is marked void and no longer counts.';
    case 'recognition': return 'The recognition record is marked void; a cash reward not yet paid is removed from the pending list.';
    default: return null;
  }
}

const when = (iso: string) => format(parseISO(iso), 'd MMM yyyy, HH:mm');

export function HrDocumentDialog({ documentId, isOpen, setIsOpen, intent = null, onChanged }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [doc, setDoc] = useState<HrDocumentView | null>(null);
  const [inputs, setInputs] = useState<RenderInputs | null>(null);
  const [type, setType] = useState<HrDocumentType | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState('');
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [newer, setNewer] = useState<HrDocumentTemplate | null>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    try {
      const d = await getDocument(documentId);
      const [i, types, h] = await Promise.all([loadRenderInputs(d), listDocumentTypes(), getDocumentHistory(documentId)]);
      setDoc(d); setInputs(i); setHistory(h);
      setType(types.find((t) => t.doc_type === d.doc_type) ?? null);
      // A draft still on an older template can move to the newest one.
      setNewer(d.status === 'draft' ? await getNewerTemplate(d).catch(() => null) : null);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the document.');
    }
  }, [documentId]);

  useEffect(() => {
    setDoc(null); setInputs(null); setHistory([]); setError(null); setNote(''); setIntegrity(null); setConfirm(null); setLoadError(null);
    if (isOpen && documentId) void load();
  }, [isOpen, documentId, load]);

  // Arrive on the confirmation the register menu asked for, once the document is loaded.
  useEffect(() => { if (doc && intent) setConfirm(intent); }, [doc?.id, intent]); // eslint-disable-line react-hooks/exhaustive-deps

  const rendered = useMemo(() => {
    if (!doc || !inputs) return null;
    const final = doc.status === 'approved' || doc.status === 'issued';
    const date = doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Dar_es_Salaam' }) : todayInDar();
    return { r: renderDocument(inputs, { refNo: doc.ref_no, date, final }), date };
  }, [doc, inputs]);

  if (!isOpen) return null;

  const isAuthor = !!doc && doc.created_by === user?.id;
  const blockedSelfApproval = !!type?.requires_different_approver && isAuthor;

  const run = async (name: string, action: () => Promise<string | void>) => {
    setBusy(name); setError(null);
    try {
      const message = await action();
      if (message) toast({ title: message });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof MissingFieldsError
        ? `${err.message.split(':')[0]}: ${err.missing.map((m) => describeField(m, doc?.doc_type)).join('; ')}.`
        : err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null); setConfirm(null);
    }
  };

  const openPdf = async () => {
    if (!doc) return;
    setBusy('download'); setError(null);
    try { window.open(await getDownloadUrl(doc.id), '_blank', 'noopener'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not open the PDF.'); }
    finally { setBusy(null); }
  };

  const check = async () => {
    if (!doc) return;
    setBusy('verify'); setError(null);
    try { setIntegrity(await verifyDocumentIntegrity(doc.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not check the file.'); }
    finally { setBusy(null); }
  };

  const retrying = doc?.status === 'approved' && !!doc.ref_no;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !busy && setIsOpen(o)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {doc ? doc.subject : 'HR document'} {doc && <DocStatusBadge doc={doc} />}
            </DialogTitle>
            <DialogDescription>
              {doc ? `${doc.type_label} · ${doc.person_name}${doc.ref_no ? ` · ${doc.ref_no}` : ''}` : 'Loading…'}
            </DialogDescription>
          </DialogHeader>

          {loadError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{loadError}</p>}
          {!doc && !loadError && <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}

          {doc && rendered && inputs && (
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="min-w-0">
                <LetterPreview
                  rendered={rendered.r}
                  refNo={doc.ref_no ?? PENDING_REF}
                  date={formatLongDate(rendered.date)}
                  settings={inputs.settings}
                  confidential={doc.confidential}
                  signatory={{ name: doc.signatory_name ?? '[name of approver]', title: doc.signatory_title ?? '[title of approver]' }}
                />
              </div>

              <aside className="space-y-4 text-sm">
                {rendered.r.missing.length > 0 && doc.status !== 'issued' && doc.status !== 'void' && (
                  <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                    <p className="font-medium">Details still missing</p>
                    <ul className="mt-1 list-disc pl-5">{rendered.r.missing.map((m) => <li key={m}>{describeField(m, doc.doc_type)}</li>)}</ul>
                  </div>
                )}

                {newer && doc.status === 'draft' && (
                  <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-blue-900">
                    <p className="font-medium">A newer template exists</p>
                    <p>This letter uses version {doc.template_version}; version {newer.version} is now the standard wording.</p>
                    <Button size="sm" variant="outline" className="mt-2" disabled={!!busy}
                      onClick={() => run('latest', async () => { await updateToLatestTemplate(doc.id); return `Now using template version ${newer.version}.`; })}>
                      {busy === 'latest' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update to latest
                    </Button>
                  </div>
                )}
                {doc.return_note && doc.status === 'draft' && (
                  <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-orange-900">
                    <p className="font-medium">Returned for changes</p><p>“{doc.return_note}”</p>
                  </div>
                )}
                {doc.status === 'void' && (
                  <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
                    <p className="font-medium">Voided{doc.voided_at ? ` on ${format(parseISO(doc.voided_at), 'd MMM yyyy')}` : ''}</p>
                    <p>“{doc.void_reason}”</p>
                    {doc.ref_no && <p className="mt-1 text-xs">The number {doc.ref_no} stays on record and is never reused.</p>}
                  </div>
                )}
                {retrying && (
                  <div className="rounded-md border border-orange-400 bg-orange-50 p-3 text-orange-900">
                    <p className="font-medium">Issue incomplete</p>
                    <p>{doc.ref_no} is reserved for this letter, but the PDF was not finished. Press Issue to finish it; the number stays the same.</p>
                  </div>
                )}
                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {doc.status === 'draft' && (
                    <>
                      <Button className="w-full" disabled={!!busy || rendered.r.missing.length > 0}
                        onClick={() => run('submit', async () => { await submit(doc.id); return 'Sent for approval. The other approvers have been notified.'; })}>
                        {busy === 'submit' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send for approval
                      </Button>
                      <Button variant="outline" className="w-full" disabled={!!busy} onClick={() => setEditing(true)}>Edit</Button>
                      <Button variant="ghost" className="w-full text-red-700" disabled={!!busy} onClick={() => setConfirm('delete')}>Delete draft</Button>
                    </>
                  )}
                  {doc.status === 'pending_approval' && (
                    <>
                      <Button className="w-full" disabled={!!busy || blockedSelfApproval || rendered.r.missing.length > 0} onClick={() => setConfirm('approve')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />Approve
                      </Button>
                      {blockedSelfApproval && (
                        <p className="text-xs text-muted-foreground">This type of document must be approved by someone other than its author.</p>
                      )}
                      <Button variant="outline" className="w-full" disabled={!!busy} onClick={() => setConfirm('return')}>Return for changes</Button>
                    </>
                  )}
                  {doc.status === 'approved' && (
                    <Button className="w-full" disabled={!!busy} onClick={() => setConfirm('issue')}>
                      {busy === 'issue' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{retrying ? 'Issue (finish)' : 'Issue the letter'}
                    </Button>
                  )}
                  {doc.status === 'issued' && (
                    <>
                      <Button className="w-full" disabled={!!busy} onClick={openPdf}>
                        {busy === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download PDF
                      </Button>
                      <Button variant="outline" className="w-full" disabled={!!busy} onClick={check}>
                        {busy === 'verify' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Check the file is unchanged
                      </Button>
                      {integrity && (
                        <p className={`rounded-md border p-2 text-xs ${integrity.ok ? 'border-green-300 bg-green-50 text-green-900' : 'border-red-300 bg-red-50 text-red-900'}`}>
                          {integrity.ok
                            ? 'The stored PDF matches the fingerprint recorded when it was issued.'
                            : 'WARNING: the stored PDF does NOT match the fingerprint recorded when it was issued.'}
                        </p>
                      )}
                    </>
                  )}
                  {doc.status !== 'void' && (
                    <Button variant="ghost" className="w-full text-red-700" disabled={!!busy} onClick={() => setConfirm('void')}>Void this document</Button>
                  )}
                </div>

                <dl className="space-y-1 border-t pt-3 text-xs">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Written by</dt><dd>{doc.author_email ?? '—'}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Approved by</dt><dd>{doc.approver_email ?? '—'}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Template</dt><dd>Version {doc.template_version}</dd></div>
                  {doc.issued_at && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Issued</dt><dd>{when(doc.issued_at)}</dd></div>}
                  {doc.pdf_sha256 && <div><dt className="text-muted-foreground">File fingerprint (SHA-256)</dt><dd className="break-all font-mono">{doc.pdf_sha256}</dd></div>}
                </dl>

                <div className="border-t pt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
                  <ul className="space-y-1.5 text-xs">
                    {history.map((h, i) => (
                      <li key={i}><span className="font-medium">{h.text}</span><br /><span className="text-muted-foreground">{h.actor} · {when(h.at)}</span></li>
                    ))}
                    {history.length === 0 && <li className="text-muted-foreground">No history to show.</li>}
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm === 'approve'} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this document?</AlertDialogTitle>
            <AlertDialogDescription>
              Once approved the wording is frozen and cannot be edited. You will be shown as the person who approved it, and
              the letter will be signed with your name and job title unless the author chose someone else. It still has to be issued.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void run('approve', async () => { await approve(doc!.id); return 'Approved. It is ready to issue.'; }); }} disabled={!!busy}>
              {busy === 'approve' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'issue'} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{retrying ? 'Finish issuing this letter?' : 'Issue this letter?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {retrying
                ? `It keeps its reserved number ${doc?.ref_no}. The PDF will be completed and stored.`
                : 'It gets its permanent reference number and the PDF is stored. After this the letter cannot be edited; it can only be voided and, if needed, replaced by a new letter.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void run('issue', async () => { const r = await issue(doc!.id); return `Issued as ${r.refNo}.`; }); }}
              disabled={!!busy}
            >
              {busy === 'issue' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Issue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'delete'} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>A draft has no reference number yet, so nothing is lost from the numbering. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void run('delete', async () => { await deleteDraft(doc!.id); setIsOpen(false); return 'Draft deleted.'; }); }} disabled={!!busy}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={confirm === 'return' || confirm === 'void'} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === 'return' ? 'Return for changes' : 'Void this document'}</DialogTitle>
            <DialogDescription>
              {confirm === 'return'
                ? 'It goes back to the author as a draft, with your note.'
                : <>
                    {doc?.ref_no
                      ? `${doc.ref_no} stays on record and is never reused. Voiding cannot be undone; if the letter is still needed, write a new one.`
                      : 'Voiding cannot be undone; if the letter is still needed, write a new one.'}
                    {doc?.status === 'issued' && voidConsequence(doc.doc_type) && <strong className="mt-2 block">{voidConsequence(doc.doc_type)}</strong>}
                  </>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="doc-note">{confirm === 'return' ? 'What needs to change?' : 'Reason'}</Label>
            <Textarea id="doc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={!!busy}>Cancel</Button>
            <Button
              variant={confirm === 'void' ? 'destructive' : 'default'}
              disabled={note.trim().length < 3 || !!busy}
              onClick={() => run(confirm as string, async () => {
                if (confirm === 'return') { await returnToDraft(doc!.id, note); setNote(''); return 'Returned to the author.'; }
                const wasIssuedTermination = doc!.status === 'issued' && doc!.doc_type === 'termination';
                await voidDocument(doc!.id, note); setNote('');
                return wasIssuedTermination
                  ? 'Document voided. The employee was NOT reactivated; if that is intended, reactivate them on the Employees page.'
                  : 'Document voided.';
              })}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirm === 'return' ? 'Return' : 'Void'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <NewDocumentWizard isOpen={editing} setIsOpen={setEditing} editing={doc} onSaved={() => { void load(); onChanged?.(); }} />
    </>
  );
}
