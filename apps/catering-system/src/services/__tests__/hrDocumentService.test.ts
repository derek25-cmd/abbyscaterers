import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// The lifecycle rules live in the database (supabase/tests/hr_documents_rls.sql
// checks them end to end). These tests pin what the SERVICE must do: call the
// database functions in the right order, never issue without a stored file,
// refuse letters with blanks, and turn refusals into readable messages.

const calls: string[] = [];
let rpcResults: Record<string, { data?: unknown; error?: unknown }> = {};
const fromMock = vi.fn();
const downloadMock = vi.fn();
const uploadMock = vi.fn();
const signedUrlMock = vi.fn();
const auditMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (...a: unknown[]) => fromMock(...a),
    rpc: async (name: string, args: unknown) => { calls.push(`rpc:${name}`); rpcCalls.push({ name, args }); return rpcResults[name] ?? { data: null, error: null }; },
    storage: {
      from: () => ({
        download: (...a: unknown[]) => { calls.push('download'); return downloadMock(...a); },
        upload: (...a: unknown[]) => { calls.push('upload'); return uploadMock(...a); },
        createSignedUrl: (...a: unknown[]) => { calls.push('sign'); return signedUrlMock(...a); },
      }),
    },
  },
}));
const rpcCalls: { name: string; args: any }[] = [];

vi.mock('@/lib/audit-log', () => ({ logAuditEvent: (...a: unknown[]) => { calls.push('audit'); return auditMock(...a); } }));
vi.mock('@/services/employeeService', () => ({ getEmployeeDirectory: async () => [{ id: 'EMP-1', firstName: 'Amina', lastName: 'Juma' }] }));
vi.mock('@/lib/hr-docs/letterPdf', async (orig) => ({
  ...(await orig<typeof import('@/lib/hr-docs/letterPdf')>()),
  buildLetterPdf: vi.fn(async () => new Blob(['%PDF-1.4 fake letter'], { type: 'application/pdf' })),
}));

const REF = 'ALC/HR/GEN/2026/0001';
const PATH = 'EMP-1/ALC_HR_GEN_2026_0001.pdf';

const DOC = {
  id: 'doc-1', ref_no: null, doc_type: 'general_letter', employee_id: 'EMP-1', candidate_id: null, template_id: 'tpl-1', template_version: 1,
  subject: 'Confirmation of employment', data: { body: 'Hello there.' }, status: 'approved', return_note: null, void_reason: null,
  voided_by: null, voided_at: null, signatory_name: 'Neema Mushi', signatory_title: 'HR Manager', pdf_path: null, pdf_sha256: null,
  confidential: false, issued_at: null, created_at: '2026-10-14T08:00:00Z', created_by: 'u-1', approved_by: 'u-2', approved_at: '2026-10-14T09:00:00Z',
};
const TEMPLATE = { id: 'tpl-1', doc_type: 'general_letter', version: 1, title: 'General letter', body: 'Dear {{employee.fullName}},\n\n{{{body}}}', use_stored_signature: false, is_active: true, created_at: '2026-10-01T00:00:00Z' };
const EMPLOYEE = { id: 'EMP-1', firstName: 'Amina', lastName: 'Juma', role: 'Head Chef', department: 'Kitchen', address: 'Mikocheni' };
const SETTINGS = { company_name: "Abby's", company_address: 'Plot 362', company_phone: null, company_email: null, company_tin: '151-209-696', company_vrn: null, header_url: '', footer_url: '', signature_url: '' };
const TYPE = { doc_type: 'general_letter', code: 'GEN', label: 'General letter', requires_different_approver: false, confidential_default: false };

function world(over: { doc?: object; template?: object } = {}) {
  const tables: Record<string, unknown> = {
    hr_documents: { ...DOC, ...over.doc },
    hr_document_templates: { ...TEMPLATE, ...over.template },
    hr_document_types: [TYPE],
    app_settings: SETTINGS,
    employees: EMPLOYEE,
    staff_users: [],
  };
  fromMock.mockImplementation((table: string) => mockQueryResult({ data: tables[table] ?? null, error: null }));
}

beforeEach(() => {
  calls.length = 0; rpcCalls.length = 0; rpcResults = {};
  fromMock.mockReset(); downloadMock.mockReset(); uploadMock.mockReset(); signedUrlMock.mockReset(); auditMock.mockReset();
  downloadMock.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
  uploadMock.mockResolvedValue({ error: null });
  rpcResults.reserve_hr_document_ref = { data: REF, error: null };
  rpcResults.issue_hr_document = { data: REF, error: null };
});

describe('issue', () => {
  it('reserves the number, then issues with the final text; nothing is uploaded', async () => {
    world();
    const { issue } = await import('../hrDocumentService');

    const result = await issue('doc-1');

    expect(calls.filter((c) => ['rpc:validate_hr_document', 'rpc:reserve_hr_document_ref', 'rpc:issue_hr_document'].includes(c)))
      .toEqual(['rpc:validate_hr_document', 'rpc:reserve_hr_document_ref', 'rpc:issue_hr_document']);
    expect(calls).not.toContain('upload');
    expect(result).toEqual({ refNo: REF });
  });

  it('sends the letter exactly as it will print, carrying its reference number and signatory', async () => {
    world();
    const { issue } = await import('../hrDocumentService');
    await issue('doc-1');

    const args = rpcCalls.find((c) => c.name === 'issue_hr_document')!.args;
    expect(Object.keys(args)).toEqual(['p_id', 'p_content']);
    expect(args.p_content).toMatchObject({
      v: 1, ref_no: REF, subject: 'Confirmation of employment', confidential: false,
      signatory: { name: 'Neema Mushi', title: 'HR Manager' },
    });
    expect(args.p_content.addressee[0]).toBe('Amina Juma');
    expect(args.p_content.paragraphs.map((p: { text: string }[]) => p.map((x) => x.text).join(''))).toEqual(['Dear Amina Juma,', 'Hello there.']);
    expect(args.p_content.date).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  });

  it('treats a letter already issued (an earlier attempt that finished) as done', async () => {
    world({ doc: { status: 'issued', ref_no: REF, issued_at: '2026-10-16T08:00:00Z' } });
    const { issue } = await import('../hrDocumentService');
    expect(await issue('doc-1')).toEqual({ refNo: REF });
    expect(calls).not.toContain('rpc:reserve_hr_document_ref');
    expect(calls).not.toContain('rpc:issue_hr_document');
  });

  it('refuses a document that is not approved, before touching the number counter', async () => {
    world({ doc: { status: 'draft' } });
    const { issue } = await import('../hrDocumentService');
    await expect(issue('doc-1')).rejects.toThrow(/Only an approved document can be issued/);
    expect(calls).not.toContain('rpc:reserve_hr_document_ref');
  });

  it('refuses a letter with blanks, before reserving a number', async () => {
    world({ template: { body: 'Dear {{employee.fullName}}, your contract ended on {{employee.endDate}}.' } });
    const { issue, MissingFieldsError } = await import('../hrDocumentService');
    const err = await issue('doc-1').catch((e) => e);
    expect(err).toBeInstanceOf(MissingFieldsError);
    expect(err.missing).toEqual(['employee.endDate']);
    expect(calls).not.toContain('rpc:reserve_hr_document_ref');
  });

  it('tells the user to press Issue again when marking it issued fails', async () => {
    world();
    rpcResults.issue_hr_document = { data: null, error: { message: 'connection reset' } };
    const { issue } = await import('../hrDocumentService');
    const err = await issue('doc-1').catch((e) => e);
    expect(err.message).toContain('connection reset');
    expect(err.message).toMatch(/press Issue again/i);
  });
});

describe('submit and approve', () => {
  it('will not send a letter with blanks for approval', async () => {
    world({ doc: { status: 'draft' }, template: { body: '{{employee.endDate}}' } });
    const { submit, MissingFieldsError } = await import('../hrDocumentService');
    await expect(submit('doc-1')).rejects.toBeInstanceOf(MissingFieldsError);
    expect(calls).not.toContain('rpc:submit_hr_document');
  });

  it('does not block submitting because the approver is not known yet', async () => {
    world({ doc: { status: 'draft', signatory_name: null, signatory_title: null }, template: { body: 'Signed {{signatory.name}}, {{signatory.title}}' } });
    const { submit } = await import('../hrDocumentService');
    await expect(submit('doc-1')).resolves.not.toThrow();
    expect(calls).toContain('rpc:submit_hr_document');
  });

  it('saves the letter as it will print (for the admin-portal approvers) before sending it', async () => {
    world({ doc: { status: 'draft' } });
    const builders: { table: string; q: ReturnType<typeof mockQueryResult> }[] = [];
    const base = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => {
      const q = base(table);
      builders.push({ table, q });
      q.update.mockImplementation(() => { calls.push(`update:${table}`); return q; });
      return q;
    });
    const { submit } = await import('../hrDocumentService');
    await submit('doc-1');
    const write = builders.find((b) => b.table === 'hr_documents' && b.q.update.mock.calls.length > 0)!;
    const preview = write.q.update.mock.calls[0][0].preview;
    expect(preview).toMatchObject({ v: 1, subject: 'Confirmation of employment', confidential: false });
    expect(preview.addressee[0]).toBe('Amina Juma');
    expect(preview.paragraphs.map((p: { text: string }[]) => p.map((s) => s.text).join(''))).toEqual(['Dear Amina Juma,', 'Hello there.']);
    // Only while still a draft, and before the letter is sent.
    expect(write.q.eq).toHaveBeenCalledWith('status', 'draft');
    expect(calls.indexOf('update:hr_documents')).toBeLessThan(calls.indexOf('rpc:submit_hr_document'));
  });

  it('checks the letter is complete before approving', async () => {
    world({ doc: { status: 'pending_approval' }, template: { body: '{{employee.endDate}}' } });
    const { approve } = await import('../hrDocumentService');
    await expect(approve('doc-1')).rejects.toThrow(/still missing/);
    expect(calls).not.toContain('rpc:approve_hr_document');
  });

  it('passes the database refusal to the user, e.g. self-approval', async () => {
    world({ doc: { status: 'pending_approval' } });
    rpcResults.approve_hr_document = { data: null, error: { message: 'This type of document must be approved by someone other than the person who wrote it.' } };
    const { approve } = await import('../hrDocumentService');
    await expect(approve('doc-1')).rejects.toThrow(/someone other than the person who wrote it/);
  });

  it('turns a bare permission refusal into a readable message', async () => {
    world({ doc: { status: 'pending_approval' } });
    rpcResults.approve_hr_document = { data: null, error: { code: '42501', message: 'permission denied for function' } };
    const { approve } = await import('../hrDocumentService');
    await expect(approve('doc-1')).rejects.toThrow('You do not have permission to do that.');
  });
});

describe('createDraft', () => {
  it('creates the draft from the active template and validates the type-specific fields first', async () => {
    const tables: Record<string, unknown> = { hr_document_templates: TEMPLATE, hr_document_types: [TYPE], hr_documents: { ...DOC, status: 'draft' } };
    const builders: Record<string, any> = {};
    fromMock.mockImplementation((t: string) => (builders[t] = mockQueryResult({ data: tables[t], error: null })));
    const { createDraft } = await import('../hrDocumentService');

    await createDraft({ docType: 'general_letter', employeeId: 'EMP-1', subject: ' Confirmation ', data: { body: 'Hello' } });

    const sent = builders.hr_documents.insert.mock.calls[0][0][0];
    expect(sent).toMatchObject({ doc_type: 'general_letter', employee_id: 'EMP-1', template_id: 'tpl-1', subject: 'Confirmation', confidential: false });
    expect(sent).not.toHaveProperty('status');
    expect(sent).not.toHaveProperty('ref_no');
  });

  it('refuses an empty body without calling the database', async () => {
    const { createDraft } = await import('../hrDocumentService');
    await expect(createDraft({ docType: 'general_letter', employeeId: 'EMP-1', subject: 'Hello there', data: { body: '   ' } })).rejects.toThrow();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('refuses an offer written to an employee (offers go to candidates)', async () => {
    const { createDraft } = await import('../hrDocumentService');
    const offer = { position: 'Cook', salary: 500000, startDate: '2026-11-02', acceptanceDeadline: '2026-10-30' };
    await expect(createDraft({ docType: 'offer', employeeId: 'EMP-1', subject: 'Offer of employment', data: offer })).rejects.toThrow(/job candidate/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('refuses an employee letter written to a candidate', async () => {
    const { createDraft } = await import('../hrDocumentService');
    await expect(createDraft({
      docType: 'general_letter', candidateId: '11111111-1111-1111-1111-111111111111', subject: 'Hello there', data: { body: 'x' },
    })).rejects.toThrow(/written to an employee/);
  });

  it('needs a person', async () => {
    const { createDraft } = await import('../hrDocumentService');
    await expect(createDraft({ docType: 'general_letter', subject: 'Hello there', data: { body: 'x' } })).rejects.toThrow();
  });

  it('explains when a type has no template', async () => {
    fromMock.mockImplementation((t: string) => mockQueryResult({ data: t === 'hr_document_types' ? [TYPE] : null, error: null }));
    const { createDraft } = await import('../hrDocumentService');
    await expect(createDraft({ docType: 'general_letter', employeeId: 'EMP-1', subject: 'Hello there', data: { body: 'x' } })).rejects.toThrow(/no template yet/);
  });
});

describe('createAndSubmit (send straight for approval)', () => {
  function track(tables: Record<string, unknown>) {
    const ops: string[] = [];
    fromMock.mockImplementation((t: string) => {
      const q = mockQueryResult({ data: tables[t] ?? null, error: null });
      q.insert.mockImplementation(() => { ops.push(`insert:${t}`); return q; });
      q.delete.mockImplementation(() => { ops.push(`delete:${t}`); return q; });
      return q;
    });
    return ops;
  }
  const INPUT = { docType: 'general_letter' as const, employeeId: 'EMP-1', subject: 'Confirmation of employment', data: { body: 'Hello there.' } };
  const TABLES = {
    hr_document_templates: TEMPLATE, hr_document_types: [TYPE], hr_documents: { ...DOC, status: 'draft' },
    app_settings: SETTINGS, employees: EMPLOYEE, staff_users: [],
  };

  it('writes the letter and sends it, leaving nothing in Drafts', async () => {
    const ops = track(TABLES);
    rpcResults.submit_hr_document = { data: { ...DOC, status: 'pending_approval' }, error: null };
    const { createAndSubmit } = await import('../hrDocumentService');
    const doc = await createAndSubmit(INPUT);
    expect(doc.status).toBe('pending_approval');
    expect(ops).toEqual(['insert:hr_documents']);
    expect(calls).toContain('rpc:submit_hr_document');
  });

  it('removes the half-written draft when sending is refused, and passes the reason on', async () => {
    const ops = track(TABLES);
    rpcResults.submit_hr_document = { data: null, error: { message: 'P4W Tester has left and their record is closed.' } };
    const { createAndSubmit } = await import('../hrDocumentService');
    await expect(createAndSubmit(INPUT)).rejects.toThrow(/has left/);
    expect(ops).toEqual(['insert:hr_documents', 'delete:hr_documents']);
  });

  it('writes nothing when the template still has the DRAFT wording', async () => {
    const ops = track({ ...TABLES, hr_document_templates: { ...TEMPLATE, body: '**DRAFT TEMPLATE — HR Manager to replace this wording before use.** Dear x' } });
    const { createAndSubmit } = await import('../hrDocumentService');
    await expect(createAndSubmit(INPUT)).rejects.toThrow(/DRAFT template/);
    expect(ops).toEqual([]);
    expect(calls).not.toContain('rpc:submit_hr_document');
  });
});

describe('export (built from the record, never stored)', () => {
  const CONTENT = {
    v: 1, ref_no: REF, date: '16 October 2026', addressee: ['Amina Juma', 'Head Chef, Kitchen'], subject: 'Confirmation of employment',
    paragraphs: [[{ text: 'As issued.', bold: false }]], signatory: { name: 'Neema Mushi', title: 'HR Manager' }, confidential: true,
  };

  it('builds the PDF from the text saved when it was issued, names it after the reference, and records the export', async () => {
    world({ doc: { status: 'issued', ref_no: REF, issued_at: '2026-10-16T08:00:00Z', issued_content: CONTENT } });
    const { buildIssuedLetterPdf } = await import('../hrDocumentService');
    const { buildLetterPdf } = await import('@/lib/hr-docs/letterPdf');

    const { blob, fileName } = await buildIssuedLetterPdf('doc-1');

    expect(blob).toBeInstanceOf(Blob);
    expect(fileName).toBe('ALC_HR_GEN_2026_0001.pdf');
    expect(vi.mocked(buildLetterPdf).mock.calls.at(-1)![0]).toMatchObject({
      refNo: REF, date: '16 October 2026', subject: 'Confirmation of employment', paragraphs: CONTENT.paragraphs,
      signatory: CONTENT.signatory, confidential: true,
    });
    expect(auditMock).toHaveBeenCalledWith('hr_document.export', 'hr_documents', 'doc-1', { ref_no: REF });
    expect(calls).not.toContain('download');
    expect(calls).not.toContain('sign');
  });

  it('rebuilds a letter issued before exports existed from its template version', async () => {
    world({ doc: { status: 'issued', ref_no: REF, issued_at: '2026-10-14T08:00:00Z', issued_content: null, pdf_path: PATH } });
    const { buildIssuedLetterPdf } = await import('../hrDocumentService');
    const { buildLetterPdf } = await import('@/lib/hr-docs/letterPdf');

    await buildIssuedLetterPdf('doc-1');

    const sent = vi.mocked(buildLetterPdf).mock.calls.at(-1)![0];
    expect(sent).toMatchObject({ refNo: REF, date: '14 October 2026', signatory: { name: 'Neema Mushi', title: 'HR Manager' } });
    expect(sent.paragraphs.map((p) => p.map((x) => x.text).join(''))).toEqual(['Dear Amina Juma,', 'Hello there.']);
  });

  it('has nothing to export before the letter is issued', async () => {
    world({ doc: { status: 'approved' } });
    const { buildIssuedLetterPdf } = await import('../hrDocumentService');
    await expect(buildIssuedLetterPdf('doc-1')).rejects.toThrow(/Only an issued letter can be exported/);
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe('templates and history', () => {
  it('saves a template through the versioning function', async () => {
    rpcResults.save_hr_template_version = { data: { ...TEMPLATE, version: 2 }, error: null };
    const { saveTemplateVersion } = await import('../hrDocumentService');
    const saved = await saveTemplateVersion('general_letter', { title: 'T', body: 'B', useStoredSignature: true });
    expect(saved.version).toBe(2);
    expect(rpcCalls[0]).toEqual({ name: 'save_hr_template_version', args: { p_doc_type: 'general_letter', p_title: 'T', p_body: 'B', p_use_stored_signature: true } });
  });

  it('describes audit entries in plain words', async () => {
    const { describeAuditEntry } = await import('../hrDocumentService');
    expect(describeAuditEntry('hr_documents.insert', null)).toBe('Draft created');
    expect(describeAuditEntry('hr_documents.update', { changed_fields: ['status'], old: { status: 'draft' }, new: { status: 'pending_approval' } })).toBe('Sent for approval');
    expect(describeAuditEntry('hr_documents.approve', { changed_fields: ['approved_at', 'status'], old: { status: 'pending_approval' }, new: { status: 'approved' } })).toBe('Approved');
    expect(describeAuditEntry('hr_documents.update', { changed_fields: ['ref_no'], old: {}, new: { ref_no: REF } })).toBe(`Reference number reserved (${REF})`);
    expect(describeAuditEntry('hr_documents.update', { changed_fields: ['status', 'void_reason'], old: { status: 'issued' }, new: { status: 'void', void_reason: 'wrong date' } })).toBe('Voided: wrong date');
    expect(describeAuditEntry('hr_documents.update', { changed_fields: ['data'], old: {}, new: {} })).toBe('Edited');
  });
});
