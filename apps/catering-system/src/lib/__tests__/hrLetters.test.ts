import { describe, it, expect } from 'vitest';
import type { DisciplinaryRecord, Employee, EmploymentContract } from '@/types';
import {
  DOC_TYPE_ORDER, REGISTRY, docTypeAppliesTo, getDocTypeDefinition, isDocTypeEnabled, personKindOf, type LetterRelated,
} from '../hr-docs/registry';
import { OMIT, buildRenderContext, optionalText, paragraphText, renderTemplate } from '../hr-docs/render';
import { formatTZS } from '../formatCurrency';
import { OfferSchema } from '../hr-docs/types/offer';
import { ContractSchema } from '../hr-docs/types/contract';
import { ExtensionSchema } from '../hr-docs/types/extension';
import { TerminationSchema, describeWarnings } from '../hr-docs/types/termination';
import { WarningSchema, defaultWarningExpiry } from '../hr-docs/types/warning';
import { RecognitionSchema } from '../hr-docs/types/recognition';
import { CertificateSchema, deriveService } from '../hr-docs/types/certificate_of_service';
import { addMonths, candidateAddresseeLines, describeProbation } from '../hr-docs/types/shared';

const active: Partial<Employee> = {
  id: 'EMP-1', firstName: 'Amina', lastName: 'Juma', role: 'Head Chef', department: 'Kitchen',
  address: 'Sinza\nDar es Salaam', status: 'Active', employmentStartDate: '2023-03-01', monthlySalary: 1200000,
};
const left: Partial<Employee> = { ...active, status: 'Inactive', employmentEndDate: '2026-10-31', employmentEndReason: 'End of contract' };
const candidate = { id: 'c1', full_name: 'Baraka Mushi', address: 'Mbezi\nDar es Salaam', phone: '0712 000 000', email: 'b@example.com', position: 'Cook', department: 'Kitchen' };

const contract = (o: Partial<EmploymentContract>): EmploymentContract => ({
  id: '11111111-1111-1111-1111-111111111111', employee_id: 'EMP-1', contract_type: 'fixed_term', start_date: '2025-11-01',
  end_date: '2026-10-31', position: 'Head Chef', salary: 1200000, status: 'active', parent_contract_id: null,
  document_id: null, source: 'letter', ...o,
} as EmploymentContract);

const warning = (o: Partial<DisciplinaryRecord>) =>
  ({ level: 'first_written', incident_date: '2026-02-03', offence_category: 'Lateness', ...o }) as DisciplinaryRecord;

/** Render a type's sample letter body with the type's own context. */
function render(docType: Parameters<typeof getDocTypeDefinition>[0], body: string, data: Record<string, unknown>, related: LetterRelated = {}, employee: Partial<Employee> | null = active) {
  const def = getDocTypeDefinition(docType);
  const extra = def.buildContext?.(data, related, employee) ?? {};
  const ctx = buildRenderContext({ date: '2026-10-14', employee, candidate: related.candidate, data, extra });
  const r = renderTemplate(body, ctx);
  return { missing: r.missing, text: r.paragraphs.map(paragraphText) };
}

// ── Registry ────────────────────────────────────────────────────────────────

describe('registry', () => {
  it('has all eight types, in display order', () => {
    expect(DOC_TYPE_ORDER.every(isDocTypeEnabled)).toBe(true);
    expect(Object.keys(REGISTRY).sort()).toEqual([...DOC_TYPE_ORDER].sort());
  });

  it('every letter type has a valid sample and a subject (the general letter has no preset subject)', () => {
    for (const t of DOC_TYPE_ORDER) {
      const def = getDocTypeDefinition(t);
      if (t !== 'general_letter') expect(def.defaultSubject, t).toBeTruthy();
      if (t === 'extension') continue; // its sample points at a contract that is loaded, not typed
      expect(def.schema.safeParse(def.sampleData).success, t).toBe(true);
    }
  });

  it('only the offer is written to a candidate', () => {
    expect(DOC_TYPE_ORDER.filter((t) => personKindOf(t) === 'candidate')).toEqual(['offer']);
  });

  it('offers letters that make sense for the person', () => {
    expect(docTypeAppliesTo('offer', active)).toBe(false);
    for (const t of ['contract', 'extension', 'termination', 'warning', 'recognition'] as const) {
      expect(docTypeAppliesTo(t, active), t).toBe(true);
      expect(docTypeAppliesTo(t, left), t).toBe(false);
    }
    expect(docTypeAppliesTo('certificate_of_service', active)).toBe(false);
    expect(docTypeAppliesTo('certificate_of_service', left)).toBe(true);
    // Inactive but no end date recorded: no certificate yet.
    expect(docTypeAppliesTo('certificate_of_service', { ...left, employmentEndDate: undefined })).toBe(false);
    expect(docTypeAppliesTo('general_letter', active)).toBe(true);
  });
});

// ── Schemas ─────────────────────────────────────────────────────────────────

describe('offer', () => {
  const ok = { position: 'Cook', salary: '800000', startDate: '2026-11-02', acceptanceDeadline: '2026-10-24' };
  it('needs position, salary above 0, start date and deadline', () => {
    expect(OfferSchema.safeParse(ok).success).toBe(true);
    expect(OfferSchema.safeParse({ ...ok, position: ' ' }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...ok, salary: '0' }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...ok, salary: '' }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...ok, acceptanceDeadline: '' }).success).toBe(false);
  });
  it('is addressed to the candidate, or the typed override', () => {
    const def = getDocTypeDefinition('offer');
    expect(def.addressee(null, {}, { candidate: candidate as never })).toEqual(['Baraka Mushi', 'Mbezi', 'Dar es Salaam']);
    expect(def.addressee(null, { addressee: 'Mr B. Mushi\nP.O. Box 1' }, { candidate: candidate as never })).toEqual(['Mr B. Mushi', 'P.O. Box 1']);
    expect(candidateAddresseeLines(null)).toEqual([]);
  });
  it('fills candidate.* and offer.*; optional terms disappear', () => {
    const r = render('offer', 'Dear {{candidate.firstName}},\n\nWe offer you {{offer.position}} at {{offer.salary}} from {{offer.startDate}}. Probation: {{offer.probation}}.\n\n{{{offer.otherTerms}}}\n\nReply by {{offer.acceptanceDeadline}}.',
      { ...ok, salary: 800000, probationMonths: 1, otherTerms: '' }, { candidate: candidate as never }, null);
    expect(r.missing).toEqual([]);
    expect(r.text).toEqual([
      'Dear Baraka,',
      `We offer you Cook at ${formatTZS(800000)} from 2 November 2026. Probation: 1 month.`,
      'Reply by 24 October 2026.',
    ]);
  });
});

describe('contract', () => {
  const ok = { contractType: 'fixed_term', startDate: '2026-11-01', endDate: '2027-10-31', position: 'Cook', salary: '800000' };
  it('needs an end date unless permanent, not before the start', () => {
    expect(ContractSchema.safeParse(ok).success).toBe(true);
    expect(ContractSchema.safeParse({ ...ok, endDate: '' }).success).toBe(false);
    expect(ContractSchema.safeParse({ ...ok, contractType: 'permanent', endDate: '' }).success).toBe(true);
    expect(ContractSchema.safeParse({ ...ok, endDate: '2026-10-01' }).success).toBe(false);
    expect(ContractSchema.safeParse({ ...ok, contractType: 'weekly' }).success).toBe(false);
  });
  it('a permanent contract has no end date, without reporting it missing', () => {
    const r = render('contract', 'Term: {{contract.term}}.\n\n{{contract.endDate}}', { ...ok, contractType: 'permanent', endDate: '', salary: 800000 });
    expect(r.missing).toEqual([]);
    expect(r.text).toEqual(['Term: permanent, starting 1 November 2026.']);
  });
  it('a fixed-term contract prints its term; notice and hours are optional', () => {
    const r = render('contract', '{{contract.type}}: {{contract.term}}.\n\nNotice: {{contract.noticeDays}}\n\n{{{contract.workingHours}}}', { ...ok, noticeDays: '' });
    expect(r.missing).toEqual([]);
    expect(r.text).toEqual(['Fixed-term: from 1 November 2026 to 31 October 2027.', 'Notice: ']);
  });
  it('is addressed to the employee', () => {
    expect(getDocTypeDefinition('contract').addressee(active, {})).toEqual(['Amina Juma', 'Head Chef, Kitchen', 'Sinza\nDar es Salaam']);
  });
});

describe('extension', () => {
  const ok = { contractId: '11111111-1111-1111-1111-111111111111', newEndDate: '2027-10-31', reason: 'Busy season' };
  it('needs the contract, a new end date and a reason', () => {
    expect(ExtensionSchema.safeParse(ok).success).toBe(true);
    expect(ExtensionSchema.safeParse({ ...ok, contractId: '' }).success).toBe(false);
    expect(ExtensionSchema.safeParse({ ...ok, reason: '' }).success).toBe(false);
  });
  it('prints the contract being extended; unchanged salary prints the current one', () => {
    const body = 'Your {{contract.type}} contract ending {{contract.endDate}} is extended to {{extension.newEndDate}} at {{extension.newSalary}}.';
    const r = render('extension', body, { ...ok, newSalary: '' }, { contract: contract({}) });
    expect(r.missing).toEqual([]);
    expect(r.text).toEqual([`Your Fixed-term contract ending 31 October 2026 is extended to 31 October 2027 at ${formatTZS(1200000)}.`]);
    expect(render('extension', body, { ...ok, newSalary: 1300000 }, { contract: contract({}) }).text[0]).toContain(formatTZS(1300000));
  });
  it('without the contract, its details are reported missing', () => {
    expect(render('extension', 'Ends {{contract.endDate}}', ok, {}).missing).toEqual(['contract.endDate']);
  });
});

describe('termination', () => {
  const ok = { terminationType: 'misconduct', noticeDate: '2026-10-01', lastWorkingDay: '2026-10-31', reason: 'Repeated lateness' };
  it('needs a type, dates in order and a reason', () => {
    expect(TerminationSchema.safeParse(ok).success).toBe(true);
    expect(TerminationSchema.safeParse({ ...ok, lastWorkingDay: '2026-09-30' }).success).toBe(false);
    expect(TerminationSchema.safeParse({ ...ok, reason: ' ' }).success).toBe(false);
    expect(TerminationSchema.safeParse({ ...ok, warningIds: ['not-a-uuid'] }).success).toBe(false);
    expect(TerminationSchema.parse(ok).warningIds).toEqual([]);
  });
  it('lists linked warnings one per line, oldest first', () => {
    expect(describeWarnings([
      warning({ level: 'final_written', incident_date: '2026-06-10', offence_category: 'Lateness' }),
      warning({ level: 'first_written', incident_date: '2026-02-03', offence_category: 'Absence' }),
    ])).toBe('First written warning, 3 Feb 2026 (Absence)\nFinal written warning, 10 Jun 2026 (Lateness)');
    expect(describeWarnings([])).toBe('');
  });
  it('the warnings paragraph disappears when none are linked', () => {
    const body = 'Last day: {{termination.lastWorkingDay}}.\n\n{{{termination.warnings}}}\n\n{{{termination.finalDues}}}';
    expect(render('termination', body, ok, { warnings: [] })).toEqual({ missing: [], text: ['Last day: 31 October 2026.'] });
    const withW = render('termination', body, ok, { warnings: [warning({}), warning({ level: 'final_written', incident_date: '2026-05-04' })] });
    // One paragraph, one warning per line.
    expect(withW.text).toEqual(['Last day: 31 October 2026.', 'First written warning, 3 Feb 2026 (Lateness)\nFinal written warning, 4 May 2026 (Lateness)']);
  });
});

describe('warning', () => {
  const ok = { level: 'final_written', offenceCategory: 'Lateness', incidentDate: '2026-10-06', description: 'Late three times' };
  it('needs level, offence, date and description; expiry not before the incident', () => {
    expect(WarningSchema.safeParse(ok).success).toBe(true);
    expect(WarningSchema.safeParse({ ...ok, level: 'severe' }).success).toBe(false);
    expect(WarningSchema.safeParse({ ...ok, expiresOn: '2026-10-01' }).success).toBe(false);
    expect(WarningSchema.safeParse({ ...ok, expiresOn: '' }).success).toBe(true);
  });
  it('expires 12 months after the incident by default', () => {
    expect(defaultWarningExpiry('2026-10-06')).toBe('2027-10-06');
    expect(defaultWarningExpiry('2024-02-29')).toBe('2025-02-28');
    expect(defaultWarningExpiry('')).toBe('');
    expect(render('warning', '{{warning.level}} until {{warning.expiresOn}}', ok).text).toEqual(['Final written warning until 6 October 2027']);
  });
});

describe('recognition', () => {
  it('a cash reward needs an amount above 0; others do not', () => {
    expect(RecognitionSchema.safeParse({ category: 'performance', reason: 'Great work', rewardType: 'cash', amount: '' }).success).toBe(false);
    expect(RecognitionSchema.safeParse({ category: 'performance', reason: 'Great work', rewardType: 'cash', amount: '0' }).success).toBe(false);
    expect(RecognitionSchema.safeParse({ category: 'performance', reason: 'Great work', rewardType: 'cash', amount: '50000' }).success).toBe(true);
    expect(RecognitionSchema.safeParse({ category: 'performance', reason: 'Great work', rewardType: 'none', amount: '' }).success).toBe(true);
  });
  it('the amount prints for cash, disappears for a non-cash reward without one', () => {
    const body = '{{reward.category}}: {{reward.reason}}\n\nReward: {{reward.amount}}';
    expect(render('recognition', body, { category: 'conduct', reason: 'Helped a colleague', rewardType: 'cash', amount: 50000 }).text)
      .toEqual(['Exemplary conduct: Helped a colleague', `Reward: ${formatTZS(50000)}`]);
    const none = render('recognition', body, { category: 'conduct', reason: 'Helped a colleague', rewardType: 'none', amount: '' });
    expect(none).toEqual({ missing: [], text: ['Exemplary conduct: Helped a colleague', 'Reward: '] });
    // Cash with no amount is reported missing, so it cannot be issued.
    expect(render('recognition', body, { category: 'conduct', reason: 'x', rewardType: 'cash', amount: '' }).missing).toEqual(['reward.amount']);
  });
});

describe('certificate of service', () => {
  it('takes dates and positions from the records', () => {
    const s = deriveService(left, [
      contract({ start_date: '2024-06-01', end_date: '2026-10-31', position: 'Head Chef', status: 'terminated' }),
      contract({ start_date: '2023-03-01', end_date: '2024-05-31', position: 'Cook', status: 'expired' }),
      contract({ start_date: '2022-01-01', end_date: '2022-12-31', position: 'Ignored', status: 'void' }),
    ]);
    expect(s).toEqual({ startDate: '2023-03-01', endDate: '2026-10-31', positions: 'Cook (Mar 2023 – May 2024), Head Chef (Jun 2024 – Oct 2026)' });
  });
  it('joins repeated contracts in the same position into one span', () => {
    const s = deriveService(left, [
      contract({ start_date: '2023-03-01', end_date: '2024-02-29', position: 'Cook', status: 'extended' }),
      contract({ start_date: '2024-03-01', end_date: '2025-02-28', position: 'Cook', status: 'expired' }),
    ]);
    expect(s.positions).toBe('Cook (Mar 2023 – Feb 2025)');
  });
  it('without contracts, uses the employee record', () => {
    expect(deriveService(left, [])).toEqual({ startDate: '2023-03-01', endDate: '2026-10-31', positions: 'Head Chef (Mar 2023 – Oct 2026)' });
  });
  it('prints the reason for leaving only when ticked', () => {
    const body = 'Served from {{service.startDate}} to {{service.endDate}} as {{service.positions}}.\n\n{{{service.reason}}}';
    expect(CertificateSchema.parse({}).includeReason).toBe(false);
    const without = render('certificate_of_service', body, { includeReason: false }, { contracts: [] }, left);
    expect(without).toEqual({ missing: [], text: ['Served from 1 March 2023 to 31 October 2026 as Head Chef (Mar 2023 – Oct 2026).'] });
    const withReason = render('certificate_of_service', body, { includeReason: true }, { contracts: [] }, left);
    expect(withReason.text[1]).toBe('End of contract');
    // Ticked but no reason on file: reported missing rather than printed blank.
    expect(render('certificate_of_service', body, { includeReason: true }, { contracts: [] }, { ...left, employmentEndReason: '' }).missing).toEqual(['service.reason']);
  });
});

// ── Engine extensions ───────────────────────────────────────────────────────

describe('OMIT and the candidate context', () => {
  it('OMIT prints nothing inline, drops a block, and is never missing', () => {
    const r = renderTemplate('A{{x}}B\n\n{{{y}}}\n\nEnd', { x: OMIT, y: OMIT });
    expect(r).toEqual({ missing: [], paragraphs: expect.any(Array) });
    expect(r.paragraphs.map(paragraphText)).toEqual(['AB', 'End']);
  });
  it('optionalText trims, and blanks become OMIT', () => {
    expect(optionalText('  hi ')).toBe('hi');
    expect(optionalText('   ')).toBe(OMIT);
    expect(optionalText(undefined)).toBe(OMIT);
  });
  it('builds the candidate namespace; type namespaces never override built-ins', () => {
    const ctx = buildRenderContext({ date: '2026-10-14', candidate: candidate as never, extra: { employee: 'spoof', offer: { position: 'Cook' } } });
    expect(ctx.candidate).toMatchObject({ fullName: 'Baraka Mushi', firstName: 'Baraka', position: 'Cook' });
    expect(ctx.employee).toEqual({});
    expect((ctx.offer as { position: string }).position).toBe('Cook');
  });
  it('the general letter is unchanged: no type context', () => {
    expect(getDocTypeDefinition('general_letter').buildContext).toBeUndefined();
    expect(getDocTypeDefinition('general_letter').person).toBeUndefined();
  });
  it('small helpers', () => {
    expect(describeProbation(3)).toBe('3 months');
    expect(describeProbation('1')).toBe('1 month');
    expect(describeProbation('')).toBe('no probation period');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});
