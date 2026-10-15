import { supabase } from '@/lib/supabase-client';
import { validate } from '@/lib/service-validation';
import { logAuditEvent } from '@/lib/audit-log';
import { getEmployeeDirectory } from '@/services/employeeService';
import { DraftBaseSchema } from '@/lib/hr-docs/schema';
import { getDocTypeDefinition, personKindOf, type LetterRelated } from '@/lib/hr-docs/registry';
import { buildNumberLedger, type LedgerRow } from '@/lib/hr-docs/ledger';
import {
  buildRenderContext, formatLongDate, renderTemplate, type CompanyDetails, type Paragraph,
} from '@/lib/hr-docs/render';
import { buildLetterPdf, loadImageAsDataUrl, sha256, type Letterhead } from '@/lib/hr-docs/letterPdf';
import type {
  Candidate, DisciplinaryRecord, Employee, EmploymentContract, HrDocTypeCode, HrDocument, HrDocumentStatus,
  HrDocumentTemplate, HrDocumentType, HrDocumentView,
} from '@/types';

// The lifecycle rules (who may approve, what freezes, how numbers are given out)
// live in the database: supabase/migrations/20261101000*. This file calls them,
// builds the PDF in the browser, and turns refusals into messages a person can
// act on. HR documents are private: files are only ever opened through a
// short-lived signed URL (never getPublicUrl).

export const HR_DOCUMENTS_BUCKET = 'hr-documents';
const SIGNED_URL_SECONDS = 300;

// ── Errors ─────────────────────────────────────────────────────────────────

interface DbError { message: string; code?: string }

function toError(error: DbError, fallback: string): Error {
  // 42501 = refused by row-level security or the role check.
  if (error.code === '42501' && !/^(Only|You )/.test(error.message)) {
    return new Error('You do not have permission to do that.');
  }
  return new Error(error.message || fallback);
}

/** The letter still has blanks; it must not be sent for approval or issued like that. */
export class MissingFieldsError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`These details are still missing from the letter: ${missing.join(', ')}.`);
    this.name = 'MissingFieldsError';
    this.missing = missing;
  }
}

// ── Company settings and letterhead ────────────────────────────────────────

export interface LetterSettings {
  company: CompanyDetails;
  headerUrl: string;
  footerUrl: string;
  signatureUrl: string;
  /** The stamp invoices print (invoice_stamp_url). */
  stampUrl: string;
}

export const getLetterSettings = async (): Promise<LetterSettings> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('company_name, company_address, company_phone, company_email, company_tin, company_vrn, header_url, footer_url, signature_url, invoice_stamp_url')
    .eq('id', true)
    .maybeSingle();
  if (error) throw toError(error, 'Could not load the company settings.');
  return {
    company: {
      name: data?.company_name, address: data?.company_address, phone: data?.company_phone,
      email: data?.company_email, tin: data?.company_tin, vrn: data?.company_vrn,
    },
    headerUrl: data?.header_url ?? '',
    footerUrl: data?.footer_url ?? '',
    signatureUrl: data?.signature_url ?? '',
    stampUrl: data?.invoice_stamp_url ?? '',
  };
};

/**
 * Loads the images the letter needs. Fails loudly: no silent letterhead-less letters.
 * Every letter prints the same signature and stamp as the invoices (Settings →
 * signature and invoice stamp), whatever the template says.
 */
export async function buildLetterhead(settings: LetterSettings): Promise<Letterhead> {
  const [header, footer, signature, stamp] = await Promise.all([
    settings.headerUrl ? loadImageAsDataUrl(settings.headerUrl, 'letterhead header image') : null,
    settings.footerUrl ? loadImageAsDataUrl(settings.footerUrl, 'letterhead footer image') : null,
    settings.signatureUrl ? loadImageAsDataUrl(settings.signatureUrl, 'signature image') : null,
    settings.stampUrl ? loadImageAsDataUrl(settings.stampUrl, 'invoice stamp image') : null,
  ]);
  return { company: settings.company, header, footer, signature, stamp };
}

// ── Types and templates ────────────────────────────────────────────────────

export const listDocumentTypes = async (): Promise<HrDocumentType[]> => {
  const { data, error } = await supabase.from('hr_document_types').select('*').order('code');
  if (error) throw toError(error, 'Could not load the document types.');
  return (data ?? []) as HrDocumentType[];
};

export const updateDocumentType = async (
  docType: HrDocTypeCode,
  patch: { requires_different_approver?: boolean; confidential_default?: boolean },
): Promise<void> => {
  const { data, error } = await supabase.from('hr_document_types').update(patch).eq('doc_type', docType).select('doc_type');
  if (error) throw toError(error, 'Could not save the setting.');
  if (!data?.length) throw new Error('The setting was not saved. You may not have permission.');
};

export const listTemplates = async (docType?: HrDocTypeCode): Promise<HrDocumentTemplate[]> => {
  let query = supabase.from('hr_document_templates').select('*').order('doc_type').order('version', { ascending: false });
  if (docType) query = query.eq('doc_type', docType);
  const { data, error } = await query;
  if (error) throw toError(error, 'Could not load the templates.');
  return (data ?? []) as HrDocumentTemplate[];
};

export const getActiveTemplate = async (docType: HrDocTypeCode): Promise<HrDocumentTemplate | null> => {
  const { data, error } = await supabase.from('hr_document_templates').select('*').eq('doc_type', docType).eq('is_active', true).maybeSingle();
  if (error) throw toError(error, 'Could not load the template.');
  return (data as HrDocumentTemplate | null) ?? null;
};

/** Saves as a NEW version and makes it the active one. Letters already written keep their version. */
export const saveTemplateVersion = async (
  docType: HrDocTypeCode,
  input: { title: string; body: string; useStoredSignature: boolean },
): Promise<HrDocumentTemplate> => {
  const { data, error } = await supabase.rpc('save_hr_template_version', {
    p_doc_type: docType, p_title: input.title, p_body: input.body, p_use_stored_signature: input.useStoredSignature,
  });
  if (error) throw toError(error, 'Could not save the template.');
  return data as HrDocumentTemplate;
};

// ── Documents: reading ─────────────────────────────────────────────────────

export interface DocumentFilters {
  docType?: HrDocTypeCode;
  status?: HrDocumentStatus;
  employeeId?: string;
  /** Created on or after / on or before (yyyy-mm-dd). */
  from?: string;
  to?: string;
}

async function toViews(rows: HrDocument[]): Promise<HrDocumentView[]> {
  const candidateIds = [...new Set(rows.map((r) => r.candidate_id).filter(Boolean) as string[])];
  const [types, people, staff, candidates] = await Promise.all([
    listDocumentTypes(),
    getEmployeeDirectory(),
    supabase.from('staff_users').select('id, email'),
    candidateIds.length
      ? supabase.from('candidates').select('id, full_name').in('id', candidateIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const label = new Map(types.map((t) => [t.doc_type, t.label]));
  const person = new Map(people.map((e: Employee) => [e.id, `${e.firstName} ${e.lastName}`]));
  const email = new Map((staff.data ?? []).map((s: { id: string; email: string }) => [s.id, s.email]));
  const candidateName = new Map(((candidates.data ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name]));
  return rows.map((d) => ({
    ...d,
    type_label: label.get(d.doc_type) ?? d.doc_type,
    person_name: d.employee_id
      ? (person.get(d.employee_id) ?? 'Unknown employee')
      : `${candidateName.get(d.candidate_id ?? '') ?? 'Unknown'} (candidate)`,
    author_email: d.created_by ? (email.get(d.created_by) ?? null) : null,
    approver_email: d.approved_by ? (email.get(d.approved_by) ?? null) : null,
  }));
}

export const listDocuments = async (filters: DocumentFilters = {}): Promise<HrDocumentView[]> => {
  let query = supabase.from('hr_documents').select('*').order('created_at', { ascending: false });
  if (filters.docType) query = query.eq('doc_type', filters.docType);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00+03:00`);
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59.999+03:00`);
  const { data, error } = await query;
  if (error) throw toError(error, 'Could not load the documents.');
  return toViews((data ?? []) as HrDocument[]);
};

export const getDocument = async (id: string): Promise<HrDocumentView> => {
  const { data, error } = await supabase.from('hr_documents').select('*').eq('id', id).maybeSingle();
  if (error) throw toError(error, 'Could not load the document.');
  if (!data) throw new Error('Document not found.');
  return (await toViews([data as HrDocument]))[0];
};

/** Every reference number in one series, each accounted for (issued, voided, reserved or unaccounted). */
export const getNumberLedger = async (docType: HrDocTypeCode, year: number): Promise<LedgerRow[]> => {
  const types = await listDocumentTypes();
  const code = types.find((t) => t.doc_type === docType)?.code;
  if (!code) throw new Error('Unknown document type.');
  const { data, error } = await supabase
    .from('hr_documents').select('id, ref_no, status, subject, void_reason')
    .like('ref_no', `ALC/HR/${code}/${year}/%`);
  if (error) throw toError(error, 'Could not load the reference numbers.');
  return buildNumberLedger((data ?? []) as HrDocument[], code, year);
};

export interface HistoryEntry { at: string; actor: string; text: string }

/** What happened to a document and who did it, from the audit trail. */
export const getDocumentHistory = async (id: string): Promise<HistoryEntry[]> => {
  const [{ data, error }, staff] = await Promise.all([
    supabase.from('audit_log').select('actor_id, action, metadata, created_at')
      .eq('table_name', 'hr_documents').eq('record_id', id).order('created_at', { ascending: true }),
    supabase.from('staff_users').select('id, email'),
  ]);
  if (error) throw toError(error, 'Could not load the history.');
  const email = new Map((staff.data ?? []).map((s: { id: string; email: string }) => [s.id, s.email]));
  const out: HistoryEntry[] = [];
  for (const row of data ?? []) {
    const text = describeAuditEntry(row.action, row.metadata);
    if (text) out.push({ at: row.created_at, actor: (row.actor_id && email.get(row.actor_id)) || 'System', text });
  }
  return out;
};

const STATUS_TEXT: Record<string, string> = {
  pending_approval: 'Sent for approval', draft: 'Returned to draft', approved: 'Approved', issued: 'Issued', void: 'Voided',
};

export function describeAuditEntry(action: string, metadata: { old?: Record<string, unknown> | null; new?: Record<string, unknown> | null; changed_fields?: string[] } | null): string | null {
  const op = action.split('.')[1];
  if (op === 'insert') return 'Draft created';
  if (op === 'delete') return 'Draft deleted';
  const changed = metadata?.changed_fields ?? [];
  const next = metadata?.new ?? {};
  const prev = metadata?.old ?? {};
  if (changed.includes('status') && prev.status !== next.status) {
    const base = STATUS_TEXT[String(next.status)] ?? `Status: ${String(next.status)}`;
    if (next.status === 'void' && next.void_reason) return `${base}: ${String(next.void_reason)}`;
    if (next.status === 'draft' && next.return_note) return `${base}: ${String(next.return_note)}`;
    return base;
  }
  if (changed.includes('ref_no')) return `Reference number reserved (${String(next.ref_no)})`;
  if (changed.some((c) => ['subject', 'data', 'signatory_name', 'signatory_title', 'confidential'].includes(c))) return 'Edited';
  return null;
}

// ── Documents: writing ─────────────────────────────────────────────────────

export interface CreateDraftInput {
  docType: HrDocTypeCode;
  employeeId?: string;
  candidateId?: string;
  subject: string;
  data?: Record<string, unknown>;
  signatoryName?: string;
  signatoryTitle?: string;
}

export const createDraft = async (input: CreateDraftInput): Promise<HrDocument> => {
  const base = validate(DraftBaseSchema, input);
  const def = getDocTypeDefinition(base.docType);
  if (personKindOf(base.docType) === 'candidate' && (!base.candidateId || base.employeeId)) {
    throw new Error('This letter is written to a job candidate. Choose the candidate.');
  }
  if (personKindOf(base.docType) === 'employee' && (!base.employeeId || base.candidateId)) {
    throw new Error('This letter is written to an employee. Choose the employee.');
  }
  const data = validate(def.schema, base.data) as Record<string, unknown>;

  const [template, types] = await Promise.all([getActiveTemplate(base.docType), listDocumentTypes()]);
  if (!template) throw new Error('This type of letter has no template yet. Ask the HR Manager to add one under Templates.');

  const { data: row, error } = await supabase
    .from('hr_documents')
    .insert([{
      doc_type: base.docType,
      employee_id: base.employeeId ?? null,
      candidate_id: base.candidateId ?? null,
      template_id: template.id,
      subject: base.subject,
      data,
      confidential: types.find((t) => t.doc_type === base.docType)?.confidential_default ?? false,
      signatory_name: input.signatoryName?.trim() || null,
      signatory_title: input.signatoryTitle?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw toError(error, 'Could not save the draft.');
  return row as HrDocument;
};

export interface UpdateDraftInput {
  subject?: string;
  data?: Record<string, unknown>;
  confidential?: boolean;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
}

export const updateDraft = async (id: string, patch: UpdateDraftInput): Promise<HrDocument> => {
  const update: Record<string, unknown> = {};
  if (patch.subject !== undefined) {
    if (patch.subject.trim().length < 3) throw new Error('Give the letter a subject.');
    update.subject = patch.subject.trim();
  }
  if (patch.data !== undefined) {
    const { data: doc, error: e } = await supabase.from('hr_documents').select('doc_type').eq('id', id).maybeSingle();
    if (e || !doc) throw new Error('Document not found.');
    update.data = validate(getDocTypeDefinition(doc.doc_type as HrDocTypeCode).schema, patch.data);
  }
  if (patch.confidential !== undefined) update.confidential = patch.confidential;
  if (patch.signatoryName !== undefined) update.signatory_name = patch.signatoryName?.trim() || null;
  if (patch.signatoryTitle !== undefined) update.signatory_title = patch.signatoryTitle?.trim() || null;

  const { data, error } = await supabase.from('hr_documents').update(update).eq('id', id).select().single();
  if (error) throw toError(error, 'Could not save the draft.');
  return data as HrDocument;
};

/** The active template version for this document's type, when it is newer than the one the document uses. */
export const getNewerTemplate = async (doc: Pick<HrDocument, 'doc_type' | 'template_id' | 'template_version'>): Promise<HrDocumentTemplate | null> => {
  const active = await getActiveTemplate(doc.doc_type);
  return active && active.id !== doc.template_id && active.version > doc.template_version ? active : null;
};

/** Moves a DRAFT onto the newest template version (the database refuses this once it has left draft). */
export const updateToLatestTemplate = async (id: string): Promise<HrDocument> => {
  const { data: doc, error } = await supabase.from('hr_documents').select('id, doc_type, status, template_id, template_version').eq('id', id).maybeSingle();
  if (error || !doc) throw new Error('Document not found.');
  if (doc.status !== 'draft') throw new Error('Only a draft can move to a newer template. Return it to draft first.');
  const newer = await getNewerTemplate(doc as HrDocument);
  if (!newer) throw new Error('This letter already uses the newest template.');
  const { data, error: upError } = await supabase.from('hr_documents').update({ template_id: newer.id }).eq('id', id).select().single();
  if (upError) throw toError(upError, 'Could not update the template.');
  return data as HrDocument;
};

export const deleteDraft = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('hr_documents').delete().eq('id', id).select('id');
  if (error) throw toError(error, 'Could not delete the draft.');
  if (!data?.length) throw new Error('The draft was not deleted. Only drafts can be deleted; void anything else.');
};

// ── Rendering (shared by the preview, submit, approve and issue) ───────────

export interface RenderInputs {
  doc: HrDocument;
  template: HrDocumentTemplate;
  employee: Employee | null;
  settings: LetterSettings;
  /** Records the letter type needs (candidate, contract, warnings ...). Empty for the general letter. */
  related?: LetterRelated;
}

export interface RenderedLetter {
  subject: string;
  addressee: string[];
  paragraphs: Paragraph[];
  missing: string[];
}

/** Today in Dar es Salaam, as yyyy-mm-dd. */
export const todayInDar = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Dar_es_Salaam' });

/**
 * The records a letter type declares it needs (DocTypeDefinition.needs), read
 * now so the letter shows the current state: the candidate for an offer, the
 * contract being extended, the warnings a termination refers to, and every
 * contract for a certificate of service.
 */
export async function loadRelated(doc: Pick<HrDocument, 'doc_type' | 'employee_id' | 'candidate_id' | 'data'>): Promise<LetterRelated> {
  const needs = getDocTypeDefinition(doc.doc_type).needs ?? [];
  const related: LetterRelated = {};
  const data = doc.data ?? {};
  await Promise.all(needs.map(async (need) => {
    if (need === 'candidate' && doc.candidate_id) {
      const { data: c } = await supabase.from('candidates').select('*').eq('id', doc.candidate_id).maybeSingle();
      related.candidate = (c as Candidate | null) ?? null;
    }
    if (need === 'contractToExtend' && typeof data.contractId === 'string' && data.contractId) {
      const { data: k } = await supabase.from('employment_contracts').select('*').eq('id', data.contractId).maybeSingle();
      related.contract = (k as EmploymentContract | null) ?? null;
    }
    if (need === 'linkedWarnings') {
      const ids = Array.isArray(data.warningIds) ? (data.warningIds as string[]) : [];
      if (ids.length) {
        const { data: w } = await supabase.from('disciplinary_records').select('*').in('id', ids);
        related.warnings = (w ?? []) as DisciplinaryRecord[];
      } else {
        related.warnings = [];
      }
    }
    if (need === 'allContracts' && doc.employee_id) {
      const { data: all } = await supabase.from('employment_contracts').select('*').eq('employee_id', doc.employee_id).order('start_date');
      related.contracts = (all ?? []) as EmploymentContract[];
    }
  }));
  return related;
}

export async function loadRenderInputs(doc: HrDocument): Promise<RenderInputs> {
  const [{ data: template, error: tErr }, settings, employee, related] = await Promise.all([
    supabase.from('hr_document_templates').select('*').eq('id', doc.template_id).maybeSingle(),
    getLetterSettings(),
    doc.employee_id
      ? supabase.from('employees').select('*').eq('id', doc.employee_id).maybeSingle().then((r) => (r.data as Employee | null) ?? null)
      : Promise.resolve(null),
    loadRelated(doc),
  ]);
  if (tErr || !template) throw new Error('The template this document was written from could not be loaded.');
  return { doc, template: template as HrDocumentTemplate, employee, settings, related };
}

/** Bundles the pieces a render needs when the caller already has them (the wizard preview). */
export const loadRenderInputsFor = (
  doc: HrDocument, template: HrDocumentTemplate, employee: Employee | null, settings: LetterSettings,
  related: LetterRelated = {},
): RenderInputs => ({ doc, template, employee, settings, related });

/**
 * Fills the template for a document. `refNo` is the real number only at issue;
 * before that the letter shows a placeholder, and the approver's name shows as
 * a placeholder until approval fixes it, so neither blocks sending for approval.
 */
export function renderDocument(inputs: RenderInputs, opts: { refNo?: string | null; date?: string; final?: boolean } = {}): RenderedLetter {
  const { doc, template, employee, settings } = inputs;
  const related = inputs.related ?? {};
  const def = getDocTypeDefinition(doc.doc_type);
  const final = opts.final ?? false;

  const context = buildRenderContext({
    company: settings.company,
    employee,
    candidate: related.candidate ?? null,
    extra: def.buildContext ? def.buildContext(doc.data ?? {}, related, employee) : {},
    refNo: opts.refNo ?? doc.ref_no,
    date: opts.date ?? todayInDar(),
    subject: doc.subject,
    signatory: {
      name: doc.signatory_name || (final ? '' : '[name of approver]'),
      title: doc.signatory_title || (final ? '' : '[title of approver]'),
    },
    data: doc.data,
  });

  const body = renderTemplate(template.body, context);
  const subject = renderTemplate(doc.subject, context);
  const subjectText = subject.paragraphs.map((p) => p.map((s) => s.text).join('')).join(' ');
  const missing = [...new Set([...body.missing, ...subject.missing])];

  return {
    subject: subjectText || doc.subject,
    addressee: def.addressee(employee, doc.data, related),
    paragraphs: body.paragraphs,
    missing,
  };
}

// ── Workflow ───────────────────────────────────────────────────────────────

async function requireComplete(id: string): Promise<{ doc: HrDocumentView; inputs: RenderInputs }> {
  const doc = await getDocument(id);
  const inputs = await loadRenderInputs(doc);
  const { missing } = renderDocument(inputs);
  if (missing.length > 0) throw new MissingFieldsError(missing);
  return { doc, inputs };
}

/**
 * What an approver sees in the admin portal (hr_documents.preview): the letter
 * as it will print, minus the reference number (given at issue) and the
 * approver's name (taken at approval). Saved just before sending for approval,
 * while the letter is still a draft; the database freezes it with the rest.
 */
export interface LetterPreviewSnapshot {
  v: 1;
  date: string;
  subject: string;
  addressee: string[];
  paragraphs: { text: string; bold: boolean }[][];
  confidential: boolean;
}

export const submit = async (id: string): Promise<HrDocument> => {
  const { doc, inputs } = await requireComplete(id);
  const rendered = renderDocument(inputs);
  const preview: LetterPreviewSnapshot = {
    v: 1,
    date: formatLongDate(todayInDar()),
    subject: rendered.subject,
    addressee: rendered.addressee,
    paragraphs: rendered.paragraphs,
    confidential: doc.confidential,
  };
  const saved = await supabase.from('hr_documents').update({ preview }).eq('id', id).eq('status', 'draft');
  if (saved.error) throw toError(saved.error, 'Could not prepare the document for approval.');
  const { data, error } = await supabase.rpc('submit_hr_document', { p_id: id });
  if (error) throw toError(error, 'Could not send the document for approval.');
  return data as HrDocument;
};

export const returnToDraft = async (id: string, note: string): Promise<HrDocument> => {
  const { data, error } = await supabase.rpc('return_hr_document', { p_id: id, p_note: note });
  if (error) throw toError(error, 'Could not return the document.');
  return data as HrDocument;
};

export const approve = async (id: string): Promise<HrDocument> => {
  await requireComplete(id); // an approved letter is always a complete one
  const { data, error } = await supabase.rpc('approve_hr_document', { p_id: id });
  if (error) throw toError(error, 'Could not approve the document.');
  return data as HrDocument;
};

export const voidDocument = async (id: string, reason: string): Promise<HrDocument> => {
  const { data, error } = await supabase.rpc('void_hr_document', { p_id: id, p_reason: reason });
  if (error) throw toError(error, 'Could not void the document.');
  return data as HrDocument;
};

const isAlreadyThere = (err: { message?: string; statusCode?: string | number } | null) =>
  !!err && (String(err.statusCode) === '409' || /already exists|duplicate/i.test(err.message ?? ''));

export interface IssueResult { refNo: string; path: string; sha256: string }

/**
 * Issues an approved document:
 *   1. reserve its reference number (the same number every time it is asked)
 *   2. build the PDF with that number on it
 *   3. upload it to the private bucket at the one path the number dictates
 *   4. record it as issued, with the file's SHA-256
 * If step 3 or 4 fails the document stays approved with its number reserved, and
 * issuing again resumes: a file already stored at that path is read back and
 * hashed, and that exact file is what gets issued. Nothing is ever uploaded over
 * an existing file, and "issued" never exists without a file.
 */
const expectedPath = (doc: Pick<HrDocument, 'employee_id' | 'candidate_id'>, refNo: string) =>
  `${doc.employee_id ?? `candidate-${doc.candidate_id}`}/${refNo.replace(/\//g, '_')}.pdf`;

export const issue = async (id: string): Promise<IssueResult> => {
  // An earlier attempt may have finished on the server even though the answer
  // never reached the browser. If this very document is already issued with its
  // own number at its own path, that IS success; anything else is not.
  const current = await getDocument(id);
  if (current.status === 'issued' && current.ref_no && current.pdf_sha256
      && current.pdf_path === expectedPath(current, current.ref_no)) {
    return { refNo: current.ref_no, path: current.pdf_path, sha256: current.pdf_sha256 };
  }

  const { doc, inputs } = await requireComplete(id);
  if (doc.status !== 'approved') throw new Error(`Only an approved document can be issued. This one is ${doc.status.replace('_', ' ')}.`);

  // The type's checks (e.g. the contract being extended is still active) run
  // BEFORE a number is reserved, so a letter that cannot be issued costs nothing.
  const { error: checkError } = await supabase.rpc('validate_hr_document', { p_id: id });
  if (checkError) throw toError(checkError, 'This letter cannot be issued yet.');

  const { data: ref, error: refError } = await supabase.rpc('reserve_hr_document_ref', { p_id: id });
  if (refError) throw toError(refError, 'Could not reserve a reference number.');
  const refNo = String(ref);

  const path = expectedPath(doc, refNo);
  const storage = supabase.storage.from(HR_DOCUMENTS_BUCKET);

  // A retry finds the file already stored; reuse exactly that file.
  const existing = await storage.download(path);
  let digest: string;
  if (existing.data) {
    digest = await sha256(existing.data);
  } else {
    const rendered = renderDocument(inputs, { refNo, final: true });
    if (rendered.missing.length > 0) throw new MissingFieldsError(rendered.missing);
    if (!doc.signatory_name || !doc.signatory_title) throw new Error('This document has no signatory. Return it to draft and approve it again.');

    const letterhead = await buildLetterhead(inputs.settings);
    const blob = await buildLetterPdf({
      letterhead,
      refNo,
      date: renderedDate(),
      addressee: rendered.addressee,
      subject: rendered.subject,
      paragraphs: rendered.paragraphs,
      signatory: { name: doc.signatory_name, title: doc.signatory_title },
      confidential: doc.confidential,
    });
    digest = await sha256(blob);

    const { error: upError } = await storage.upload(path, blob, { contentType: 'application/pdf', upsert: false, cacheControl: '3600' });
    if (upError && !isAlreadyThere(upError)) throw new Error(`Could not store the PDF: ${upError.message}`);
    if (upError) {
      // Lost a race with another attempt: use the file that won.
      const won = await storage.download(path);
      if (!won.data) throw new Error('Could not store the PDF. Please try again.');
      digest = await sha256(won.data);
    }
  }

  const { error } = await supabase.rpc('issue_hr_document', { p_id: id, p_pdf_path: path, p_pdf_sha256: digest });
  if (error) {
    // The file is safely stored and the number reserved: issuing again resumes from here.
    throw new Error(`${toError(error, 'Could not record the document as issued.').message} The PDF is stored and the reference number is kept, so press Issue again to finish.`);
  }
  return { refNo, path, sha256: digest };
};

function renderedDate(): string {
  // Same long form the {{doc.date}} placeholder uses.
  const [y, m, d] = todayInDar().split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** A link that works for five minutes. The download is recorded in the audit trail first. */
export const getDownloadUrl = async (id: string): Promise<string> => {
  const { data: doc, error } = await supabase.from('hr_documents').select('id, ref_no, status, pdf_path').eq('id', id).maybeSingle();
  if (error || !doc) throw new Error('Document not found.');
  if (!doc.pdf_path) throw new Error('This document has not been issued, so there is no PDF yet.');

  await logAuditEvent('hr_document.download', 'hr_documents', id, { ref_no: doc.ref_no });
  const { data, error: urlError } = await supabase.storage.from(HR_DOCUMENTS_BUCKET).createSignedUrl(doc.pdf_path, SIGNED_URL_SECONDS);
  if (urlError || !data?.signedUrl) throw new Error('You do not have permission to open this document, or the file is missing.');
  return data.signedUrl;
};

export interface IntegrityResult { ok: boolean; expected: string; actual: string }

/**
 * Re-reads the stored PDF and compares its SHA-256 with the one recorded when it
 * was issued. A mismatch means the file in storage is not the file that was issued.
 */
export const verifyDocumentIntegrity = async (id: string): Promise<IntegrityResult> => {
  const { data: doc, error } = await supabase.from('hr_documents').select('pdf_path, pdf_sha256').eq('id', id).maybeSingle();
  if (error || !doc?.pdf_path || !doc.pdf_sha256) throw new Error('This document has no stored PDF to check.');
  const { data, error: dlError } = await supabase.storage.from(HR_DOCUMENTS_BUCKET).download(doc.pdf_path);
  if (dlError || !data) throw new Error('The stored PDF could not be read. It may be missing.');
  const actual = await sha256(data);
  return { ok: actual === doc.pdf_sha256, expected: doc.pdf_sha256, actual };
};
