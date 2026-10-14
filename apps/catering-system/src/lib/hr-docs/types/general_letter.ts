import { z } from 'zod';
import type { Employee } from '@/types';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';

/**
 * General HR letter: any letter that does not need its own template. The author
 * writes the body; the template adds the salutation. In the template, the body
 * is the block placeholder {{{body}}}.
 */
export const GeneralLetterSchema = z.object({
  // Paragraphs separated by a blank line; **bold** and {{fields}} are allowed.
  body: z.string().trim().min(1, 'Write the body of the letter'),
  // Optional: replaces the default addressee block (one line per line).
  addressee: z.string().optional(),
});
export type GeneralLetterData = z.infer<typeof GeneralLetterSchema>;

/** Name, job title and department, then the home address when there is one. */
export function defaultAddresseeLines(employee: Partial<Employee> | null): string[] {
  if (!employee) return [];
  const name = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
  const job = [employee.role, employee.department].filter(Boolean).join(', ');
  return [name, job, employee.address ?? ''].map((l) => l.trim()).filter(Boolean);
}

export const generalLetter: DocTypeDefinition = {
  docType: 'general_letter',
  schema: GeneralLetterSchema,
  defaults: () => ({ body: '', addressee: '' }),
  defaultSubject: '',
  sampleData: {
    body:
      'This is where the text written for each letter appears.\n\n'
      + 'A second paragraph looks like this, and **bold words** are shown in bold.',
    addressee: '',
  },
  addressee: (employee, data) => {
    const override = typeof data.addressee === 'string' ? data.addressee.trim() : '';
    return override ? override.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : defaultAddresseeLines(employee);
  },
};
