import { z } from 'zod';
import {
  ATTENDANCE_EVENT_KINDS, ATTENDANCE_EVENT_METHODS, FACE_IDENTITIES, FACE_STATUSES,
  ORGANIZATION_TYPES, PORTAL_ROLES, REGIONS,
} from '@abbyscaterers/types';

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

const isValidDateStr = (d?: string) => !!d && !isNaN(Date.parse(d));

export const PaxPerDayEntrySchema = z.object({
  date: z.string().refine(isValidDateStr, "Invalid date"),
  pax: z.number().min(1, "Pax must be at least 1"),
});

export const MealTypePerDayEntrySchema = z.object({
  date: z.string().refine(isValidDateStr, "Invalid date"),
  mealType: z.string().min(1, "Meal type is required"),
});

// Mirrors the fields on the proforma wizard's "Recipient" + "Service
// Period" sections (clientId via a real client picker, a date range) plus
// the RFQ-specific additions: a proforma-required-by deadline, per-day pax
// with a same-for-all-dates shortcut, rate per plate, VAT mode, location,
// and region. title/status/branch/notes are still real rfqs columns but
// aren't user-facing form fields — title is derived, status defaults to
// 'draft', branch/notes are left unset by this form.
export const RfqSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  serviceStartDate: z.string().refine(isValidDateStr, "A valid start date is required"),
  serviceEndDate: z.string().refine(isValidDateStr, "A valid end date is required"),
  proformaRequiredBy: z.string().optional().refine((d) => !d || isValidDateStr(d), {
    message: "Invalid date",
  }),
  samePaxAllDates: z.boolean(),
  paxPerDay: z.array(PaxPerDayEntrySchema).min(1, "Pax for at least one day is required"),
  sameMealTypeAllDates: z.boolean(),
  mealTypePerDay: z.array(MealTypePerDayEntrySchema).min(1, "Meal type for at least one day is required"),
  ratePerPlate: z.number().min(0, "Rate per plate cannot be negative"),
  vatType: z.enum(['inclusive', 'exclusive']),
  location: z.string().min(1, "Location is required"),
  region: z.enum(REGIONS),
}).refine((data) => data.serviceEndDate >= data.serviceStartDate, {
  message: "End date must be on or after start date",
  path: ['serviceEndDate'],
});
export type RfqFormData = z.infer<typeof RfqSchema>;

export const PortalUserRoleSchema = z.enum(PORTAL_ROLES);

// ─── New: Face attendance schemas ──────────────────────────────────────────
// Mirror the CHECK constraints in
// supabase/migrations/20261016000300_face_attendance_tables.sql.

export const AttendanceEventKindSchema = z.enum(ATTENDANCE_EVENT_KINDS);
export const AttendanceEventMethodSchema = z.enum(ATTENDANCE_EVENT_METHODS);
export const FaceStatusSchema = z.enum(FACE_STATUSES);
export const FaceIdentitySchema = z.enum(FACE_IDENTITIES);

export const AttendanceEventSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().min(1),
  device_id: z.string().uuid().nullable(),
  kind: AttendanceEventKindSchema,
  occurred_at: z.string().refine(isValidDateStr, "Invalid timestamp"),
  method: AttendanceEventMethodSchema,
  match_score: z.number().nullable(),
  liveness_score: z.number().nullable(),
  booking_id: z.string().nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  needs_review: z.boolean(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  review_note: z.string().nullable(),
  applied_at: z.string().nullable(),
  created_at: z.string(),
});

export const AttendanceDeviceSchema = z.object({
  name: z.string().trim().min(1, "Device name is required"),
  site: z.string().trim().optional(),
  assigned_booking_id: z.string().optional(),
  active: z.boolean().default(true),
});
export type AttendanceDeviceFormData = z.infer<typeof AttendanceDeviceSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM");

export const FaceAttendanceSettingsSchema = z.object({
  match_threshold: z.number().gt(0).max(1),
  shift_start: timeOfDay,
  late_grace_minutes: z.number().int().min(0).max(240),
  max_pin_attempts: z.number().int().min(1).max(20),
  pin_lock_minutes: z.number().int().min(1).max(1440),
  setup_code_ttl_days: z.number().int().min(1).max(90),
  double_tap_seconds: z.number().int().min(0).max(3600),
});
export type FaceAttendanceSettingsFormData = z.infer<typeof FaceAttendanceSettingsSchema>;
