'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DOC_FORMS } from '@/components/hr/doc-forms';
import { LetterPreview } from '@/components/hr/letter-preview';
import { useToast } from '@/hooks/use-toast';
import { DOC_TYPE_LABELS, DOC_TYPE_ORDER, REGISTRY, docTypeAppliesTo, getDocTypeDefinition, isDocTypeEnabled, personKindOf } from '@/lib/hr-docs/registry';
import { PENDING_REF, PLACEHOLDER_REFERENCE, formatLongDate } from '@/lib/hr-docs/render';
import { OFFER_STATUS_LABEL } from '@/lib/hr-docs/types/shared';
import { isHrModuleOn, moduleOfDocType, useHrModules } from '@/lib/hr-modules';
import { getEmployees } from '@/services/employeeService';
import { listCandidates } from '@/services/candidateService';
import {
  createDraft, getActiveTemplate, getLetterSettings, listDocumentTypes, loadRelated, loadRenderInputsFor, renderDocument,
  submit, todayInDar, updateDraft, type LetterSettings, type RenderedLetter,
} from '@/services/hrDocumentService';
import type { Candidate, Employee, HrDocTypeCode, HrDocument, HrDocumentTemplate, HrDocumentType } from '@/types';

const STEPS = ['Type', 'Person', 'Details', 'Preview'] as const;

interface WizardProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Called with the saved document (after it is sent for approval, if that was chosen). */
  onSaved?: (doc: HrDocument, sent: boolean) => void;
  /** Start with this employee chosen (from the employee's own page). */
  defaultEmployeeId?: string;
  /** Start with this candidate chosen (Candidates → Prepare offer). */
  defaultCandidateId?: string;
  /** Start on this type of letter (e.g. termination from End employment); the type step is skipped. */
  defaultDocType?: HrDocTypeCode;
  /** Edit an existing draft instead of creating a new document. */
  editing?: HrDocument | null;
}

const describeField = (path: string, docType?: HrDocTypeCode | null) => {
  const known = PLACEHOLDER_REFERENCE.find((p) => p.path === path)
    ?? (docType ? REGISTRY[docType]?.placeholders?.find((p) => p.path === path) : undefined);
  return known ? `${known.description} (${path})` : path;
};

/** Candidates who can receive an offer now: not yet an employee, and no open or accepted offer. */
const canReceiveOffer = (c: Candidate) => !c.employee_id && c.offer_status !== 'offered' && c.offer_status !== 'accepted';

/**
 * Four steps, one question each: what kind of document, for whom, what it says,
 * and how it will look. Nothing is saved until the last step, and the last step
 * shows exactly what is still missing before the letter can be sent on.
 */
export function NewDocumentWizard({ isOpen, setIsOpen, onSaved, defaultEmployeeId, defaultCandidateId, defaultDocType, editing }: WizardProps) {
  const { toast } = useToast();
  const hrModules = useHrModules();
  const [step, setStep] = useState(0);
  const [docType, setDocType] = useState<HrDocTypeCode | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [preview, setPreview] = useState<RenderedLetter | null>(null);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [confidential, setConfidential] = useState(false);
  const [sigName, setSigName] = useState('');
  const [sigTitle, setSigTitle] = useState('');
  const [saving, setSaving] = useState<'draft' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<HrDocumentType[]>([]);
  const [template, setTemplate] = useState<HrDocumentTemplate | null>(null);
  const [settings, setSettings] = useState<LetterSettings | null>(null);

  // Fresh start every time the wizard opens.
  useEffect(() => {
    if (!isOpen) return;
    setError(null); setSaving(null); setSearch('');
    if (editing) {
      setDocType(editing.doc_type); setEmployeeId(editing.employee_id ?? ''); setCandidateId(editing.candidate_id ?? '');
      setSubject(editing.subject); setData(editing.data ?? {}); setConfidential(editing.confidential);
      setSigName(editing.signatory_name ?? ''); setSigTitle(editing.signatory_title ?? '');
      setStep(2);
    } else {
      setEmployeeId(defaultEmployeeId ?? ''); setCandidateId(defaultCandidateId ?? '');
      setSigName(''); setSigTitle(''); setConfidential(false);
      if (defaultDocType && isDocTypeEnabled(defaultDocType)) {
        // Arrived with the type already chosen (e.g. from End employment): skip that step,
        // and the person step too when the person is already known.
        const d = getDocTypeDefinition(defaultDocType);
        setDocType(defaultDocType); setData(d.defaults()); setSubject(d.defaultSubject);
        const personKnown = personKindOf(defaultDocType) === 'candidate' ? !!defaultCandidateId : !!defaultEmployeeId;
        setStep(personKnown ? 2 : 1);
      } else {
        setDocType(null); setSubject(''); setData({});
        setStep(0);
      }
    }
    void Promise.all([getEmployees(), listDocumentTypes(), getLetterSettings(), listCandidates().catch(() => [] as Candidate[])])
      .then(([e, t, s, c]) => {
        setEmployees(e); setTypes(t); setSettings(s); setCandidates(c);
        if (!editing && defaultDocType) setConfidential(t.find((x) => x.doc_type === defaultDocType)?.confidential_default ?? false);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the form.'));
  }, [isOpen, editing, defaultEmployeeId, defaultCandidateId, defaultDocType]);

  useEffect(() => {
    if (!docType) { setTemplate(null); return; }
    void getActiveTemplate(docType).then(setTemplate).catch(() => setTemplate(null));
  }, [docType]);

  const chooseType = (t: HrDocTypeCode) => {
    setDocType(t);
    setData(getDocTypeDefinition(t).defaults());
    setSubject(getDocTypeDefinition(t).defaultSubject);
    setConfidential(types.find((x) => x.doc_type === t)?.confidential_default ?? false);
  };

  const kind = docType ? personKindOf(docType) : 'employee';
  const employee = kind === 'employee' ? (employees.find((e) => e.id === employeeId) ?? null) : null;
  const candidate = kind === 'candidate' ? (candidates.find((c) => c.id === candidateId) ?? null) : null;

  // Only the people this letter makes sense for: active staff for most letters,
  // people who have left for a certificate of service, everyone for a general letter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Includes the rule that someone who has left gets no letters until reactivated.
    const applies = (e: Employee) => !docType || docTypeAppliesTo(docType, e);
    return employees
      .filter((e) => applies(e) || e.id === employeeId)
      .filter((e) => !q || `${e.firstName} ${e.lastName} ${e.department} ${e.role}`.toLowerCase().includes(q))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [employees, search, docType, employeeId]);
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates
      .filter((c) => canReceiveOffer(c) || c.id === candidateId)
      .filter((c) => !q || `${c.full_name} ${c.position ?? ''} ${c.department ?? ''}`.toLowerCase().includes(q));
  }, [candidates, search, candidateId]);
  const personChosen = kind === 'candidate' ? !!candidate : !!employee;

  // The checks for the Details step.
  const def = docType && isDocTypeEnabled(docType) ? getDocTypeDefinition(docType) : null;
  const dataCheck = def ? def.schema.safeParse(data) : null;
  const fieldErrors: Record<string, string> = {};
  if (dataCheck && !dataCheck.success) for (const i of dataCheck.error.issues) fieldErrors[String(i.path[0] ?? '')] = i.message;
  const subjectOk = subject.trim().length >= 3;
  const detailsOk = !!def && subjectOk && !!dataCheck?.success;

  // The live preview, built the same way the real letter is, with the records the
  // letter type reads (the candidate, the contract being extended, warnings ...).
  useEffect(() => {
    setPreview(null);
    if (step < 3 || !docType || !template || !settings || !personChosen) return;
    let active = true;
    const fake = {
      id: 'preview', ref_no: null, doc_type: docType, employee_id: employee?.id ?? null, candidate_id: candidate?.id ?? null,
      template_id: template.id, template_version: template.version, subject, data, status: 'draft',
      signatory_name: sigName || null, signatory_title: sigTitle || null, confidential,
    } as unknown as HrDocument;
    loadRelated(fake)
      .then((related) => { if (active) setPreview(renderDocument(loadRenderInputsFor(fake, template, employee, settings, related))); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not build the preview.'); });
    return () => { active = false; };
  }, [step, docType, template, settings, employee, candidate, personChosen, subject, data, sigName, sigTitle, confidential]);

  const next = () => { setError(null); setStep((s) => Math.min(3, s + 1)); };
  const back = () => { setError(null); setStep((s) => Math.max(editing ? 2 : 0, s - 1)); };

  const canNext =
    step === 0 ? !!docType && isDocTypeEnabled(docType)
    : step === 1 ? personChosen
    : step === 2 ? detailsOk
    : false;

  const save = async (andSend: boolean) => {
    if (!docType || !personChosen) return;
    setSaving(andSend ? 'send' : 'draft');
    setError(null);
    try {
      let doc: HrDocument;
      if (editing) {
        doc = await updateDraft(editing.id, { subject, data, confidential, signatoryName: sigName || null, signatoryTitle: sigTitle || null });
      } else {
        doc = await createDraft({
          docType, employeeId: employee?.id, candidateId: candidate?.id, subject, data, signatoryName: sigName, signatoryTitle: sigTitle,
        });
        // The confidential flag is set from the type's default; apply a change made in the wizard.
        if (confidential !== doc.confidential) doc = await updateDraft(doc.id, { confidential });
      }
      let sent = false;
      if (andSend) {
        try {
          await submit(doc.id);
          sent = true;
        } catch (err) {
          // The draft is safe; say what stopped it going further.
          toast({ variant: 'destructive', title: 'Saved as a draft, but not sent', description: err instanceof Error ? err.message : undefined });
        }
      }
      if (!andSend || sent) {
        toast({
          title: sent ? 'Sent for approval' : 'Draft saved',
          description: sent ? 'The other approvers have been notified.' : 'You can finish it later from the register.',
        });
      }
      setIsOpen(false);
      onSaved?.(doc, sent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the document.');
    } finally {
      setSaving(null);
    }
  };

  const Form = docType ? DOC_FORMS[docType] : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !saving && setIsOpen(o)}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit draft' : 'New HR document'}</DialogTitle>
          <DialogDescription>
            {step === 0 && 'What kind of document is it?'}
            {step === 1 && 'Who is it for?'}
            {step === 2 && 'What does it say?'}
            {step === 3 && 'Check how it will look, then save it or send it for approval.'}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2 text-xs" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                i < step ? 'border-primary bg-primary text-primary-foreground' : i === step ? 'border-primary text-primary' : 'text-muted-foreground'}`}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={i === step ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
              {i < STEPS.length - 1 && <span className="h-px w-5 bg-border" />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {DOC_TYPE_ORDER.filter((t) => !!hrModules && isHrModuleOn(hrModules, moduleOfDocType(t))).map((t) => {
              const enabled = isDocTypeEnabled(t);
              return (
                <button
                  key={t} type="button" disabled={!enabled} onClick={() => chooseType(t)}
                  className={`rounded-md border p-3 text-left transition-colors ${docType === t ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex items-center justify-between gap-2 font-medium">
                    {DOC_TYPE_LABELS[t]}
                    {!enabled && <Badge variant="secondary">Coming in Phase 4</Badge>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && kind === 'candidate' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wz-search">Find the candidate</Label>
              <Input id="wz-search" placeholder="Type a name or position" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1" role="listbox" aria-label="Candidates">
              {filteredCandidates.map((c) => (
                <button
                  key={c.id} type="button" role="option" aria-selected={c.id === candidateId} onClick={() => setCandidateId(c.id)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${c.id === candidateId ? 'bg-primary/10 font-medium' : 'hover:bg-muted'}`}
                >
                  <span>{c.full_name} {c.position && <span className="text-muted-foreground">· {c.position}</span>}</span>
                  {c.offer_status !== 'none' && <Badge variant="outline">{OFFER_STATUS_LABEL[c.offer_status]}</Badge>}
                </button>
              ))}
              {filteredCandidates.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No candidate can receive an offer. Add the candidate on the Candidates page first.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 1 && kind === 'employee' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wz-search">Find the employee</Label>
              <Input id="wz-search" placeholder="Type a name, department or job title" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1" role="listbox" aria-label="Employees">
              {filtered.map((e) => (
                <button
                  key={e.id} type="button" role="option" aria-selected={e.id === employeeId} onClick={() => setEmployeeId(e.id)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${e.id === employeeId ? 'bg-primary/10 font-medium' : 'hover:bg-muted'}`}
                >
                  <span>{e.firstName} {e.lastName} <span className="text-muted-foreground">· {e.role}, {e.department}</span></span>
                  {e.status !== 'Active' && <Badge variant="outline">{e.status}</Badge>}
                </button>
              ))}
              {filtered.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No employee matches “{search}”.</p>}
            </div>
            {docType === 'certificate_of_service' && <p className="text-xs text-muted-foreground">Only people whose employment has ended are listed.</p>}
          </div>
        )}

        {step === 2 && docType && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wz-subject">Subject</Label>
              <Input id="wz-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Confirmation of employment" maxLength={200} />
              {!subjectOk && subject.length > 0 && <p className="text-sm text-red-700">Give the letter a subject.</p>}
            </div>
            {Form && <Form value={data} onChange={setData} errors={fieldErrors} person={{ employee, candidate }} />}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="wz-conf">Mark as confidential</Label>
                <p className="text-xs text-muted-foreground">Prints CONFIDENTIAL at the bottom of every page.</p>
              </div>
              <Switch id="wz-conf" checked={confidential} onCheckedChange={setConfidential} />
            </div>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Who signs? (optional)</summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Leave empty and the letter is signed by whoever approves it, using their name and job title.
                Fill these in only to name someone else.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="wz-sn">Name</Label><Input id="wz-sn" value={sigName} onChange={(e) => setSigName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="wz-st">Job title</Label><Input id="wz-st" value={sigTitle} onChange={(e) => setSigTitle(e.target.value)} /></div>
              </div>
            </details>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {!preview ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <>
                {preview.missing.length > 0 && (
                  <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">This letter cannot be sent yet. These details are empty:</p>
                      <ul className="mt-1 list-disc pl-5">{preview.missing.map((m) => <li key={m}>{describeField(m, docType)}</li>)}</ul>
                      <p className="mt-1">Fix them in the letter, on the person&apos;s record or in the company settings, or save the letter as a draft and come back.</p>
                    </div>
                  </div>
                )}
                <LetterPreview
                  rendered={preview} refNo={PENDING_REF} date={formatLongDate(todayInDar())}
                  settings={settings!} confidential={confidential}
                  signatory={{ name: sigName || '[name of approver]', title: sigTitle || '[title of approver]' }}
                />
              </>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={back} disabled={step === (editing ? 2 : 0) || !!saving}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={!!saving}>Cancel</Button>
            {step < 3 ? (
              <Button onClick={next} disabled={!canNext}>Next<ArrowRight className="ml-1 h-4 w-4" /></Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => save(false)} disabled={!!saving || !preview}>
                  {saving === 'draft' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save as draft
                </Button>
                <Button onClick={() => save(true)} disabled={!!saving || !preview || preview.missing.length > 0}>
                  {saving === 'send' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save and send for approval
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
