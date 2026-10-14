import { z } from 'zod';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';
import { OMIT, formatLongDate, optionalText } from '@/lib/hr-docs/render';
import type { DisciplinaryRecord } from '@/types';
import { defaultAddresseeLines } from './general_letter';
import {
  TERMINATION_TYPE_LABEL, WARNING_LEVEL_LABEL, addresseeOverride, dateField, formatShortDate, isActiveEmployee,
  optionalNumber, terminationTypes,
} from './shared';

/**
 * Termination (report 2.4). Issuing it ends the employment: the employee becomes
 * Inactive, the active contract is terminated, and later leave is cancelled.
 * It needs an approver other than its author.
 */
export const TerminationSchema = z
  .object({
    terminationType: z.enum(terminationTypes, { required_error: 'Choose the type of termination' }),
    noticeDate: dateField('notice date'),
    lastWorkingDay: dateField('last working day'),
    noticePeriodDays: optionalNumber('The notice period'),
    reason: z.string().trim().min(1, 'Give the reason'),
    warningIds: z.array(z.string().uuid()).default([]),
    finalDuesNote: z.string().optional(),
    addressee: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.lastWorkingDay < v.noticeDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastWorkingDay'], message: 'The last working day cannot be before the notice date' });
    }
  });

/** "Final written warning, 3 Feb 2026 (Lateness)", one per line, oldest first. */
export function describeWarnings(warnings: Pick<DisciplinaryRecord, 'level' | 'incident_date' | 'offence_category'>[]): string {
  return [...warnings]
    .sort((a, b) => a.incident_date.localeCompare(b.incident_date))
    .map((w) => `${WARNING_LEVEL_LABEL[w.level] ?? w.level}, ${formatShortDate(w.incident_date)} (${w.offence_category})`)
    .join('\n');
}

export const terminationLetter: DocTypeDefinition = {
  docType: 'termination',
  schema: TerminationSchema,
  appliesTo: isActiveEmployee,
  needs: ['linkedWarnings'],
  defaults: () => ({ terminationType: 'resignation', noticeDate: '', lastWorkingDay: '', noticePeriodDays: 30, reason: '', warningIds: [], finalDuesNote: '' }),
  defaultSubject: 'Termination of employment',
  sampleData: {
    terminationType: 'end_of_contract', noticeDate: '2026-10-01', lastWorkingDay: '2026-10-31', noticePeriodDays: 30,
    reason: 'Your fixed-term contract comes to an end and will not be renewed.', warningIds: [],
    finalDuesNote: 'Your final salary and leave pay will be paid with the October payroll.',
  },
  addressee: (employee, data) => addresseeOverride(data) ?? defaultAddresseeLines(employee),
  buildContext: (data, related) => {
    const type = data.terminationType as keyof typeof TERMINATION_TYPE_LABEL;
    const warnings = related.warnings ?? [];
    return {
      termination: {
        type: TERMINATION_TYPE_LABEL[type] ?? data.terminationType,
        noticeDate: formatLongDate(data.noticeDate as string),
        lastWorkingDay: formatLongDate(data.lastWorkingDay as string),
        noticePeriod: Number(data.noticePeriodDays) > 0 ? `${Number(data.noticePeriodDays)} days` : OMIT,
        reason: data.reason,
        warnings: warnings.length ? describeWarnings(warnings) : OMIT,
        finalDues: optionalText(data.finalDuesNote),
      },
    };
  },
  placeholders: [
    { path: 'termination.type', description: 'Type of termination', example: 'End of contract' },
    { path: 'termination.noticeDate', description: 'Notice date', example: '1 October 2026' },
    { path: 'termination.lastWorkingDay', description: 'Last working day', example: '31 October 2026' },
    { path: 'termination.noticePeriod', description: 'Notice period (optional)', example: '30 days' },
    { path: 'termination.reason', description: 'Reason (use {{{termination.reason}}} on its own line)', example: 'Your fixed-term contract comes to an end.' },
    { path: 'termination.warnings', description: 'Linked warnings, one per line (use {{{termination.warnings}}} on its own line; empty when none)', example: 'Final written warning, 3 Feb 2026 (Lateness)' },
    { path: 'termination.finalDues', description: 'Final dues note (optional; use {{{termination.finalDues}}})', example: 'Final salary paid with the October payroll.' },
  ],
};
