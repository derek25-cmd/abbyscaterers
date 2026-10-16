'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { RequirePermission } from '@/components/auth/require-permission';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LetterPreview } from '@/components/hr/letter-preview';
import { useToast } from '@/hooks/use-toast';
import { DOC_TYPE_LABELS, DOC_TYPE_ORDER, REGISTRY, type LetterRelated } from '@/lib/hr-docs/registry';
import { PLACEHOLDER_REFERENCE, buildRenderContext, formatLongDate, listPlaceholders, renderTemplate } from '@/lib/hr-docs/render';
import {
  DRAFT_TEMPLATE_MARKER, getLetterSettings, isDraftTemplate, listDocumentTypes, listTemplates, saveTemplateVersion, todayInDar,
  updateDocumentType, type LetterSettings,
} from '@/services/hrDocumentService';
import type { Candidate, Employee, HrDocTypeCode, HrDocumentTemplate, HrDocumentType } from '@/types';

/** The wording without the starter DRAFT line (and the blank line after it). */
const withoutDraftLine = (body: string) =>
  body.split(/\r?\n/).filter((line) => !line.includes(DRAFT_TEMPLATE_MARKER)).join('\n').replace(/^\s*\n/, '');

const SAMPLE_EMPLOYEE: Partial<Employee> = {
  id: 'EMP-000', firstName: 'Amina', lastName: 'Juma', role: 'Head Chef', department: 'Kitchen' as Employee['department'],
  employmentStartDate: '2024-03-03', employmentEndDate: '2026-12-31', address: 'Mikocheni, Dar es Salaam', monthlySalary: 1200000,
  employmentEndReason: 'End of contract: the fixed-term contract was not renewed.',
};

// Sample records so every letter type previews with realistic values.
const SAMPLE_CANDIDATE: Partial<Candidate> = { full_name: 'Baraka Mwakyusa', address: 'Sinza, Dar es Salaam', position: 'Cook', department: 'Kitchen' };
const SAMPLE_RELATED: LetterRelated = {
  candidate: SAMPLE_CANDIDATE as Candidate,
  contract: {
    id: 'sample', employee_id: 'EMP-000', contract_type: 'fixed_term', start_date: '2025-11-01', end_date: '2026-10-31', position: 'Head Chef',
    salary: 1200000, probation_months: 0, notice_days: 30, status: 'active', parent_contract_id: null, document_id: null, source: 'letter', created_at: '',
  },
  warnings: [{ id: 'w', employee_id: 'EMP-000', level: 'final_written', offence_category: 'Lateness', incident_date: '2026-02-03', expires_on: '2027-02-03', status: 'active', document_id: 'd', created_at: '' }],
  contracts: [
    { id: 'a', employee_id: 'EMP-000', contract_type: 'fixed_term', start_date: '2023-03-01', end_date: '2024-06-30', position: 'Cook', salary: null, probation_months: null, notice_days: null, status: 'extended', parent_contract_id: null, document_id: null, source: 'legacy', created_at: '' },
    { id: 'b', employee_id: 'EMP-000', contract_type: 'fixed_term', start_date: '2024-07-01', end_date: '2026-10-31', position: 'Head Chef', salary: null, probation_months: null, notice_days: null, status: 'terminated', parent_contract_id: 'a', document_id: null, source: 'letter', created_at: '' },
  ],
};

export default function TemplatesPage() {
  return (
    <RequirePermission
      permission="hr.manage"
      fallback={<p className="p-6 text-muted-foreground">Letter templates are only available to the HR Manager, General Manager and Admin.</p>}
    >
      <Editor />
    </RequirePermission>
  );
}

function Editor() {
  const { toast } = useToast();
  const [types, setTypes] = useState<HrDocumentType[]>([]);
  const [templates, setTemplates] = useState<HrDocumentTemplate[]>([]);
  const [settings, setSettings] = useState<LetterSettings | null>(null);
  const [selected, setSelected] = useState<HrDocTypeCode>('general_letter');
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [useSig, setUseSig] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const [t, tpl, s] = await Promise.all([listDocumentTypes(), listTemplates(), getLetterSettings()]);
      setTypes(t); setTemplates(tpl); setSettings(s); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load the templates.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const versions = useMemo(() => templates.filter((t) => t.doc_type === selected).sort((a, b) => b.version - a.version), [templates, selected]);
  const active = versions.find((v) => v.is_active) ?? null;
  const type = types.find((t) => t.doc_type === selected) ?? null;
  const def = REGISTRY[selected];

  // Start the editor from the active version whenever the type (or the saved version) changes.
  useEffect(() => {
    setTitle(active?.title ?? `${DOC_TYPE_LABELS[selected]}`);
    setBody(active?.body ?? '');
    setUseSig(active?.use_stored_signature ?? false);
  }, [selected, active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !active || title !== active.title || body !== active.body || useSig !== active.use_stored_signature;
  const canSave = dirty && title.trim().length > 0 && body.trim().length > 0;
  // Starter wording: letters of this type cannot be sent until it is replaced.
  const activeIsDraft = isDraftTemplate(active);
  const editorIsDraft = body.includes(DRAFT_TEMPLATE_MARKER);

  const insert = (text: string) => {
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + text); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length); });
  };

  const preview = useMemo(() => {
    if (!settings) return null;
    const sample = def?.sampleData ?? {};
    const forCandidate = def?.person === 'candidate';
    const context = buildRenderContext({
      company: settings.company, employee: forCandidate ? null : SAMPLE_EMPLOYEE, candidate: forCandidate ? SAMPLE_CANDIDATE : null,
      date: todayInDar(), subject: 'Sample subject',
      signatory: { name: 'Neema Mushi', title: 'HR Manager' }, data: sample,
      extra: def?.buildContext ? def.buildContext(sample, SAMPLE_RELATED, SAMPLE_EMPLOYEE) : {},
    });
    const r = renderTemplate(body, context);
    return {
      rendered: {
        subject: def?.defaultSubject || 'Sample subject',
        addressee: forCandidate ? ['Baraka Mwakyusa', 'Sinza, Dar es Salaam'] : ['Amina Juma', 'Head Chef, Kitchen', 'Mikocheni, Dar es Salaam'],
        paragraphs: r.paragraphs,
      },
      missing: r.missing,
    };
  }, [body, settings, def]);

  const doSave = async () => {
    setSaving(true);
    try {
      const saved = await saveTemplateVersion(selected, { title, body, useStoredSignature: useSig });
      toast({ title: `Saved as version ${saved.version}`, description: 'New letters use it now. Letters already written keep the version they used.' });
      setConfirmSave(false);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save the template', description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  const setting = async (patch: { requires_different_approver?: boolean; confidential_default?: boolean }) => {
    try { await updateDocumentType(selected, patch); await load(); toast({ title: 'Saved' }); }
    catch (err) { toast({ variant: 'destructive', title: 'Could not save', description: err instanceof Error ? err.message : undefined }); }
  };

  const fieldsFilledLater = (preview?.missing ?? []).filter((m) => !PLACEHOLDER_REFERENCE.some((p) => p.path === m));

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1"><Link href="/hr/documents"><ArrowLeft className="mr-1 h-4 w-4" />HR Documents</Link></Button>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Letter templates</h1>
        <p className="text-sm text-muted-foreground">The standard wording for each kind of letter. Every save creates a new version; letters already written keep the wording they were made with.</p>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Document types" className="space-y-1">
          {DOC_TYPE_ORDER.map((t) => {
            const a = templates.find((x) => x.doc_type === t && x.is_active);
            return (
              <button key={t} type="button" onClick={() => setSelected(t)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${selected === t ? 'bg-primary/10 font-medium' : 'hover:bg-muted'}`}>
                {DOC_TYPE_LABELS[t]}
                {isDraftTemplate(a)
                  ? <Badge variant="outline" className="border-amber-400 bg-amber-50 text-[10px] text-amber-900">Draft wording</Badge>
                  : <span className="text-xs text-muted-foreground">{a ? `v${a.version}` : 'none'}</span>}
              </button>
            );
          })}
        </nav>

        {!settings ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {DOC_TYPE_LABELS[selected]}
                  {active ? <Badge variant="secondary">Version {active.version} in use</Badge> : <Badge variant="outline">No template yet</Badge>}
                </CardTitle>
                <CardDescription>
                  {active ? `Last saved ${format(parseISO(active.created_at), 'd MMM yyyy')}.` : 'Write the wording below and save it to start using this type.'}
                  {!def && ' Letters of this type can be written from Phase 4; you can prepare the wording now.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeIsDraft && (
                  <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-2">
                      <p className="font-medium">This is the starter wording. Letters of this type cannot be sent for approval until it is replaced.</p>
                      <ol className="list-decimal space-y-0.5 pl-5">
                        <li>Remove the first line (&ldquo;DRAFT TEMPLATE — &hellip;&rdquo;).</li>
                        <li>Change the text to the company&apos;s own wording. Keep the details in double braces; they are filled in for each letter.</li>
                        <li>Press <span className="font-medium">Save as new version</span>. Drafts written earlier: open them and use &ldquo;Update to latest&rdquo;.</li>
                      </ol>
                      {editorIsDraft && (
                        <Button size="sm" variant="outline" onClick={() => setBody(withoutDraftLine(body))}>Remove the DRAFT line</Button>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-title">Template name</Label>
                  <Input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-body">Wording</Label>
                  <Textarea id="tpl-body" ref={bodyRef} rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">
                    Leave a blank line between paragraphs. **Two stars** make words bold. A name in double braces, such as {'{{employee.fullName}}'}, is filled in for each letter.
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-sm font-medium">Click to add a detail to the wording</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected === 'general_letter' && <PlaceholderChip label="Text written for each letter" text="{{{body}}}" onInsert={insert} />}
                    {(def?.placeholders ?? []).map((p) => (
                      <PlaceholderChip key={p.path} label={p.description} text={p.description.includes('{{{') ? `{{{${p.path}}}}` : `{{${p.path}}}`} onInsert={insert} highlight />
                    ))}
                    {PLACEHOLDER_REFERENCE
                      .filter((p) => p.path !== 'doc.subject')
                      .filter((p) => def?.person !== 'candidate' || !p.path.startsWith('employee.'))
                      .map((p) => (
                        <PlaceholderChip key={p.path} label={p.description} text={`{{${p.path}}}`} onInsert={insert} />
                      ))}
                  </div>
                </div>

                <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Every letter prints the same signature and stamp as the invoices, beside the approver&apos;s name and title.
                  Change them in Settings (Signature image and Invoice stamp).
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => setConfirmSave(true)} disabled={!canSave || saving}>Save as new version</Button>
                  {!dirty && <span className="text-sm text-muted-foreground">No changes to save.</span>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Rules for this type</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="rule-approver">The author cannot approve their own letter</Label>
                    <p className="text-xs text-muted-foreground">Another approver must approve it. Recommended for warnings and terminations.</p>
                  </div>
                  <Switch id="rule-approver" checked={!!type?.requires_different_approver} disabled={!type}
                    onCheckedChange={(c) => setting({ requires_different_approver: c })} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="rule-conf">New letters are marked CONFIDENTIAL</Label>
                    <p className="text-xs text-muted-foreground">The author can still change it on each letter.</p>
                  </div>
                  <Switch id="rule-conf" checked={!!type?.confidential_default} disabled={!type}
                    onCheckedChange={(c) => setting({ confidential_default: c })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
                <CardDescription>With a sample employee. Real letters use the real employee&apos;s details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview && preview.missing.filter((m) => PLACEHOLDER_REFERENCE.some((p) => p.path === m)).length > 0 && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    Some company details are empty, so letters using them cannot be sent:{' '}
                    {preview.missing.filter((m) => PLACEHOLDER_REFERENCE.some((p) => p.path === m)).join(', ')}.
                    An Admin can fill them in under Settings → Company details.
                  </p>
                )}
                {fieldsFilledLater.length > 0 && (
                  <p className="text-sm text-muted-foreground">Filled in when each letter is written: {fieldsFilledLater.join(', ')}.</p>
                )}
                {preview && (
                  <LetterPreview
                    rendered={preview.rendered} refNo="ALC/HR/XXX/2026/0001" date={formatLongDate(todayInDar())}
                    settings={settings} confidential={!!type?.confidential_default} signatory={{ name: 'Neema Mushi', title: 'HR Manager' }}
                  />
                )}
                {listPlaceholders(body).length === 0 && body.trim() && <p className="text-xs text-muted-foreground">This wording uses no details from the employee&apos;s record.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Earlier versions</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                      <span>Version {v.version} · {format(parseISO(v.created_at), 'd MMM yyyy')} {v.is_active && <Badge className="ml-1">In use</Badge>}</span>
                      {!v.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => { setTitle(v.title); setBody(v.body); setUseSig(v.use_stored_signature); toast({ title: `Version ${v.version} loaded into the editor`, description: 'Edit it if you like, then save as a new version.' }); }}>
                          Use as starting point
                        </Button>
                      )}
                    </li>
                  ))}
                  {versions.length === 0 && <li className="py-2 text-muted-foreground">No versions yet.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={confirmSave} onOpenChange={(o) => !saving && setConfirmSave(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save as version {(versions[0]?.version ?? 0) + 1}?</AlertDialogTitle>
            <AlertDialogDescription>
              New letters will use this wording from now on. Letters already written, approved or issued keep the version they were made with, and the old version stays in the list.
              {editorIsDraft && (
                <span className="mt-2 block font-medium text-amber-800">
                  The wording still has the DRAFT line, so letters of this type still cannot be sent. Remove it before saving.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doSave(); }} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlaceholderChip({ label, text, onInsert, highlight }: { label: string; text: string; onInsert: (t: string) => void; highlight?: boolean }) {
  return (
    <button type="button" title={text} onClick={() => onInsert(text)}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-primary/10 ${highlight ? 'border-primary/40 bg-primary/5' : 'bg-muted/40'}`}>
      {label.replace(/\s*\(.*\)\s*$/, '')}
    </button>
  );
}
