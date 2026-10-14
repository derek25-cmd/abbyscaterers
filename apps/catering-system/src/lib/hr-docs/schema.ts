import { z } from 'zod';

/** Checks common to every new document, whatever its type. */
export const DraftBaseSchema = z
  .object({
    docType: z.enum([
      'general_letter', 'offer', 'contract', 'extension', 'termination', 'warning', 'recognition', 'certificate_of_service',
    ]),
    employeeId: z.string().min(1).optional(),
    candidateId: z.string().uuid().optional(),
    subject: z.string().trim().min(3, 'Give the letter a subject').max(200, 'Keep the subject under 200 characters'),
    data: z.record(z.unknown()).default({}),
  })
  .refine((v) => !!v.employeeId || !!v.candidateId, { message: 'Choose who the document is for', path: ['employeeId'] });

export type DraftBase = z.infer<typeof DraftBaseSchema>;
