import { z } from 'zod';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';
import { formatLongDate, optionalText } from '@/lib/hr-docs/render';
import { defaultAddresseeLines } from './general_letter';
import { WARNING_LEVEL_LABEL, addMonths, addresseeOverride, dateField, isActiveEmployee, optionalDateField, warningLevels } from './shared';

/** Warning (report 2.5). Issuing it creates a confidential disciplinary record. Needs a different approver. */
export const WarningSchema = z
  .object({
    level: z.enum(warningLevels, { required_error: 'Choose the warning level' }),
    offenceCategory: z.string().trim().min(1, 'Enter the offence category, e.g. Lateness'),
    incidentDate: dateField('incident date'),
    description: z.string().trim().min(1, 'Describe what happened'),
    actionRequired: z.string().optional(),
    expiresOn: optionalDateField(),
    addressee: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.expiresOn && v.expiresOn < v.incidentDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresOn'], message: 'The warning cannot expire before the incident' });
    }
  });

/** The default expiry: 12 months after the incident. */
export const defaultWarningExpiry = (incidentDate: string) => (incidentDate ? addMonths(incidentDate, 12) : '');

export const warningLetter: DocTypeDefinition = {
  docType: 'warning',
  schema: WarningSchema,
  appliesTo: isActiveEmployee,
  defaults: () => ({ level: 'first_written', offenceCategory: '', incidentDate: '', description: '', actionRequired: '', expiresOn: '' }),
  defaultSubject: 'Warning letter',
  sampleData: {
    level: 'first_written', offenceCategory: 'Lateness', incidentDate: '2026-10-06',
    description: 'You arrived more than an hour late for the morning shift on three days this month.',
    actionRequired: 'Arrive on time for every shift.', expiresOn: '2027-10-06',
  },
  addressee: (employee, data) => addresseeOverride(data) ?? defaultAddresseeLines(employee),
  buildContext: (data) => {
    const level = data.level as keyof typeof WARNING_LEVEL_LABEL;
    const incident = data.incidentDate as string;
    const expires = (data.expiresOn as string) || defaultWarningExpiry(incident);
    return {
      warning: {
        level: WARNING_LEVEL_LABEL[level] ?? data.level,
        offence: data.offenceCategory,
        incidentDate: formatLongDate(incident),
        expiresOn: formatLongDate(expires),
        description: data.description,
        actionRequired: optionalText(data.actionRequired),
      },
    };
  },
  placeholders: [
    { path: 'warning.level', description: 'Warning level', example: 'First written warning' },
    { path: 'warning.offence', description: 'Offence category', example: 'Lateness' },
    { path: 'warning.incidentDate', description: 'Incident date', example: '6 October 2026' },
    { path: 'warning.expiresOn', description: 'Stays on file until', example: '6 October 2027' },
    { path: 'warning.description', description: 'What happened (use {{{warning.description}}} on its own line)', example: 'You arrived late on three days.' },
    { path: 'warning.actionRequired', description: 'Action required (optional; use {{{warning.actionRequired}}})', example: 'Arrive on time for every shift.' },
  ],
};
