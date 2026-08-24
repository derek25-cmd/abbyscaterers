import { z } from 'zod';
import { ORGANIZATION_TYPES, PORTAL_ROLES, RFQ_STATUSES, BRANCHES, REGIONS } from '@abbyscaterers/types';

// Source of truth for ContactSchema/ClientSchema is
// apps/catering-system/src/lib/schemas.ts. Duplicated here, not imported —
// see the note in @abbyscaterers/types for why.

export const ContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Contact phone is required"),
});

export const ClientSchema = z.object({
  id: z.string().min(1, "Customer Registration Number is required"),
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email("Invalid email address").optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  address1: z.string().min(1, "Address 1 is required"),
  address2: z.string().optional().refine(
    (val) => !val || val.toUpperCase().startsWith("P.O.BOX"),
    { message: "Address 2 must start with 'P.O.BOX'" }
  ),
  primaryLocation: z.string().min(1, "Primary location is required"),
  typeOfOrganization: z.enum(ORGANIZATION_TYPES),
  postalCode: z.string().optional(),
  lastContacted: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  contacts: z.array(ContactSchema).optional(),
});
export type ClientFormData = z.infer<typeof ClientSchema>;

// ─── New: Admin Portal schemas ─────────────────────────────────────────────

export const RfqSchema = z.object({
  clientId: z.string().optional().nullable(),
  clientNameFreetext: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(RFQ_STATUSES).default('draft'),
  targetEventDate: z.string().optional().refine((d) => !d || !isNaN(Date.parse(d)), {
    message: "Invalid ISO date string",
  }),
  region: z.enum(REGIONS).optional(),
  branch: z.enum(BRANCHES).optional(),
  notes: z.string().optional(),
}).refine((data) => data.clientId || data.clientNameFreetext, {
  message: "Either an existing client or a free-text client name is required",
  path: ['clientNameFreetext'],
});
export type RfqFormData = z.infer<typeof RfqSchema>;

export const PortalUserRoleSchema = z.enum(PORTAL_ROLES);
