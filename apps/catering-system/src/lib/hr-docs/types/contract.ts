import { z } from 'zod';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';
import { OMIT, formatLongDate, formatMoney, optionalText } from '@/lib/hr-docs/render';
import { defaultAddresseeLines } from './general_letter';
import {
  CONTRACT_TYPE_LABEL, addresseeOverride, contractTypes, dateField, describeProbation, isActiveEmployee,
  optionalDateField, optionalNumber, requiredNumber,
} from './shared';

/** Employment contract (report 2.2). Issuing it creates the employee's active contract. */
export const ContractSchema = z
  .object({
    contractType: z.enum(contractTypes, { required_error: 'Choose the contract type' }),
    startDate: dateField('start date'),
    endDate: optionalDateField(),
    position: z.string().trim().min(1, 'Enter the position'),
    salary: requiredNumber('salary'),
    probationMonths: optionalNumber('Probation'),
    noticeDays: optionalNumber('Notice'),
    workingHours: z.string().optional(),
    otherTerms: z.string().optional(),
    addressee: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.contractType !== 'permanent' && !v.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Choose the end date (only a permanent contract has none)' });
    }
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'The end date cannot be before the start date' });
    }
  });

export const contractLetter: DocTypeDefinition = {
  docType: 'contract',
  schema: ContractSchema,
  appliesTo: isActiveEmployee,
  defaults: () => ({ contractType: 'fixed_term', startDate: '', endDate: '', position: '', salary: '', probationMonths: '', noticeDays: 30, workingHours: '', otherTerms: '' }),
  defaultSubject: 'Contract of employment',
  sampleData: {
    contractType: 'fixed_term', startDate: '2026-11-01', endDate: '2027-10-31', position: 'Head Chef', salary: 1200000,
    probationMonths: 3, noticeDays: 30, workingHours: 'Monday to Saturday, 8:00 to 17:00', otherTerms: '',
  },
  addressee: (employee, data) => addresseeOverride(data) ?? defaultAddresseeLines(employee),
  buildContext: (data) => {
    const type = data.contractType as keyof typeof CONTRACT_TYPE_LABEL;
    const end = typeof data.endDate === 'string' && data.endDate ? formatLongDate(data.endDate) : undefined;
    return {
      contract: {
        type: CONTRACT_TYPE_LABEL[type] ?? data.contractType,
        startDate: formatLongDate(data.startDate as string),
        // A permanent contract has no end date: printing nothing is right, not "missing".
        endDate: type === 'permanent' ? OMIT : end,
        term: type === 'permanent'
          ? `permanent, starting ${formatLongDate(data.startDate as string)}`
          : `from ${formatLongDate(data.startDate as string)} to ${end ?? ''}`,
        position: data.position,
        salary: formatMoney(data.salary),
        probation: describeProbation(data.probationMonths),
        noticeDays: Number(data.noticeDays) > 0 ? `${Number(data.noticeDays)} days` : OMIT,
        workingHours: optionalText(data.workingHours),
        otherTerms: optionalText(data.otherTerms),
      },
    };
  },
  placeholders: [
    { path: 'contract.type', description: 'Contract type', example: 'Fixed-term' },
    { path: 'contract.term', description: 'Term in words', example: 'from 1 November 2026 to 31 October 2027' },
    { path: 'contract.startDate', description: 'Start date', example: '1 November 2026' },
    { path: 'contract.endDate', description: 'End date (blank for permanent)', example: '31 October 2027' },
    { path: 'contract.position', description: 'Position', example: 'Head Chef' },
    { path: 'contract.salary', description: 'Monthly salary', example: 'TZS 1,200,000' },
    { path: 'contract.probation', description: 'Probation period', example: '3 months' },
    { path: 'contract.noticeDays', description: 'Notice period (optional)', example: '30 days' },
    { path: 'contract.workingHours', description: 'Working hours (optional)', example: 'Monday to Saturday, 8:00 to 17:00' },
    { path: 'contract.otherTerms', description: 'Other terms (optional; use {{{contract.otherTerms}}} on its own line)', example: 'Uniform provided.' },
  ],
};
