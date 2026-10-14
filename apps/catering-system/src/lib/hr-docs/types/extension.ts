import { z } from 'zod';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';
import { formatLongDate, formatMoney } from '@/lib/hr-docs/render';
import { defaultAddresseeLines } from './general_letter';
import { CONTRACT_TYPE_LABEL, addresseeOverride, dateField, isActiveEmployee, optionalNumber } from './shared';

/** Contract extension (report 2.3). Issuing it creates the next contract in the chain. */
export const ExtensionSchema = z.object({
  contractId: z.string({ required_error: 'Choose the contract being extended' }).uuid('Choose the contract being extended'),
  newEndDate: dateField('new end date'),
  newSalary: optionalNumber('The new salary'),
  reason: z.string().trim().min(1, 'Say why the contract is being extended'),
  addressee: z.string().optional(),
});

export const extensionLetter: DocTypeDefinition = {
  docType: 'extension',
  schema: ExtensionSchema,
  appliesTo: isActiveEmployee,
  needs: ['contractToExtend'],
  defaults: () => ({ contractId: '', newEndDate: '', newSalary: '', reason: '' }),
  defaultSubject: 'Extension of contract of employment',
  sampleData: { contractId: '00000000-0000-0000-0000-000000000000', newEndDate: '2027-12-31', newSalary: '', reason: 'Continued need in the kitchen.' },
  addressee: (employee, data) => addresseeOverride(data) ?? defaultAddresseeLines(employee),
  buildContext: (data, related) => {
    const k = related.contract;
    const newSalary = data.newSalary === '' || data.newSalary === undefined || data.newSalary === null ? undefined : data.newSalary;
    return {
      contract: k ? {
        type: CONTRACT_TYPE_LABEL[k.contract_type] ?? k.contract_type,
        startDate: formatLongDate(k.start_date),
        endDate: formatLongDate(k.end_date),
        position: k.position ?? undefined,
        salary: formatMoney(k.salary),
      } : {},
      extension: {
        newEndDate: formatLongDate(data.newEndDate as string),
        // Unchanged salary prints the current one.
        newSalary: formatMoney(newSalary ?? k?.salary),
        reason: data.reason,
      },
    };
  },
  placeholders: [
    { path: 'contract.type', description: 'Current contract type', example: 'Fixed-term' },
    { path: 'contract.startDate', description: 'Current contract start', example: '1 November 2025' },
    { path: 'contract.endDate', description: 'Current contract end', example: '31 October 2026' },
    { path: 'contract.position', description: 'Position', example: 'Head Chef' },
    { path: 'contract.salary', description: 'Current monthly salary', example: 'TZS 1,200,000' },
    { path: 'extension.newEndDate', description: 'New end date', example: '31 December 2027' },
    { path: 'extension.newSalary', description: 'Salary from the extension (current one if unchanged)', example: 'TZS 1,300,000' },
    { path: 'extension.reason', description: 'Reason for the extension', example: 'Continued need in the kitchen.' },
  ],
};
