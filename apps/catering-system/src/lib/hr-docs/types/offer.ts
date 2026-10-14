import { z } from 'zod';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';
import { formatLongDate, formatMoney, optionalText } from '@/lib/hr-docs/render';
import { addresseeOverride, candidateAddresseeLines, dateField, describeProbation, optionalNumber, requiredNumber } from './shared';

/** Job offer (report 2.8): written to a CANDIDATE. Issuing it marks the candidate "offer sent". */
export const OfferSchema = z.object({
  position: z.string().trim().min(1, 'Enter the position'),
  department: z.string().optional(),
  salary: requiredNumber('salary', 1),
  startDate: dateField('start date'),
  probationMonths: optionalNumber('Probation'),
  reportingTo: z.string().optional(),
  acceptanceDeadline: dateField('acceptance deadline'),
  otherTerms: z.string().optional(),
  addressee: z.string().optional(),
});
export type OfferData = z.infer<typeof OfferSchema>;

export const offerLetter: DocTypeDefinition = {
  docType: 'offer',
  person: 'candidate',
  needs: ['candidate'],
  schema: OfferSchema,
  defaults: () => ({ position: '', department: '', salary: '', startDate: '', probationMonths: 3, reportingTo: '', acceptanceDeadline: '', otherTerms: '' }),
  defaultSubject: 'Offer of employment',
  sampleData: {
    position: 'Head Chef', department: 'Kitchen', salary: 1200000, startDate: '2026-11-02', probationMonths: 3,
    reportingTo: 'Executive Chef', acceptanceDeadline: '2026-10-24', otherTerms: '',
  },
  addressee: (_employee, data, related) => addresseeOverride(data) ?? candidateAddresseeLines(related?.candidate),
  buildContext: (data) => ({
    offer: {
      position: data.position,
      department: optionalText(data.department),
      salary: formatMoney(data.salary),
      startDate: formatLongDate(data.startDate as string),
      probation: describeProbation(data.probationMonths),
      reportingTo: optionalText(data.reportingTo),
      acceptanceDeadline: formatLongDate(data.acceptanceDeadline as string),
      otherTerms: optionalText(data.otherTerms),
    },
  }),
  placeholders: [
    { path: 'candidate.fullName', description: 'Candidate full name', example: 'Amina Juma' },
    { path: 'candidate.firstName', description: 'Candidate first name', example: 'Amina' },
    { path: 'candidate.address', description: 'Candidate address', example: 'Sinza, Dar es Salaam' },
    { path: 'offer.position', description: 'Position offered', example: 'Head Chef' },
    { path: 'offer.department', description: 'Department (optional)', example: 'Kitchen' },
    { path: 'offer.salary', description: 'Monthly salary', example: 'TZS 1,200,000' },
    { path: 'offer.startDate', description: 'Start date', example: '2 November 2026' },
    { path: 'offer.probation', description: 'Probation period', example: '3 months' },
    { path: 'offer.reportingTo', description: 'Reports to (optional)', example: 'Executive Chef' },
    { path: 'offer.acceptanceDeadline', description: 'Reply by', example: '24 October 2026' },
    { path: 'offer.otherTerms', description: 'Other terms (optional; use {{{offer.otherTerms}}} on its own line)', example: 'Uniform provided.' },
  ],
};
