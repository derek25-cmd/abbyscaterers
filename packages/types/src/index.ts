// Source of truth for the catering-system-origin types below is
// apps/catering-system/src/types/index.ts. They are duplicated here, not
// imported, so admin-portal can consume them without apps/catering-system
// depending on this package (out of scope for the Phase 1 restructure —
// see the admin-portal build plan). Keep in sync manually until a future
// pass makes catering-system import from here too.

export const ORGANIZATION_TYPES = [
  "Industrial", "Commercial", "Financial", "Service", "Agricultural",
  "Educational", "Medical", "Technological", "Entertainment and Media",
  "Legal", "Military", "Governmental", "Religious", "NGO", "Public Health"
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const REGIONS = ["Dar es Salaam", "Arusha", "Dodoma", "Morogoro", "Mwanza", "Mbeya", "Pwani"] as const;
export type Region = (typeof REGIONS)[number];

export const BRANCHES = ["Dar es Salaam", "Dodoma", "Arusha"] as const;
export type Branch = (typeof BRANCHES)[number];

export interface Contact {
  name: string;
  email: string;
  phone: string;
}

export interface Client {
  id: string; // Customer Registration Number
  companyName: string;
  companyEmail?: string;
  phoneNumber?: string;
  address1: string;
  address2?: string;
  postalCode?: string;
  primaryLocation: string;
  typeOfOrganization: OrganizationType;
  contacts: Contact[];
  lastContacted: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export type MealType = string;

export interface ClientEvent {
  id: string; // Unique Event ID (EVT-XXXXX)
  clientId?: string;
  date: string; // ISO date string
  numberOfPeople: number;
  mealType: MealType;
  recipes: { recipeId: string }[];
  unitPrice: number;
  vatType: 'inclusive' | 'exclusive';
  region?: Region;
  particularType?: 'event' | 'meal' | 'custom';
  particularDescription?: string;
  eventType?: string;
  customEventType?: string;
}

export interface Order {
  id: string;
  name: string;
  clientId: string;
  startDate: string;
  endDate: string;
  description?: string;
  proformaId?: string;
  booking_id?: string | null;
  region?: Region | null;
  clientEvents: ClientEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string; // Event ID (EVT-XXXXX)
  orderId?: string;
  eventType: string;
  customEventType?: string;
  mealType: string;
  pax: number;
  unitPrice: number;
  total: number;
  date?: string;
  particularType: 'event' | 'meal' | 'custom';
  particularDescription?: string;
  vatType: 'inclusive' | 'exclusive';
  region?: Region;
}

export interface ProformaInvoice {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  receiverName: string;
  receiverPosition: string;
  lpoNumber: string;
  location: string;
  region?: Region;
  numberOfDays: number;
  multiplyByDays: boolean;
  serviceCharge: number;
  transportCosts: number;
  vatType: 'inclusive' | 'exclusive';
  selectedEventType: string;
  customEventType: string;
  startDate: string;
  endDate: string;
  serviceFields: Record<string, boolean>;
  serviceDesc: string;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
  isInvoiced?: boolean;
  booking_id?: string | null;
}

export interface Invoice {
  id: string;
  proformaId?: string;
  status: 'outstanding' | 'paid' | 'partially paid';
  invoiceDate: string;
  paymentDate?: string | null;
  clientId: string | null;
  receiverName: string;
  receiverPosition: string;
  lpoNumber: string;
  location: string;
  region?: Region;
  numberOfDays: number;
  multiplyByDays: boolean;
  serviceCharge: number;
  transportCosts: number;
  vatType: 'inclusive' | 'exclusive';
  selectedEventType: string;
  customEventType: string;
  startDate?: string;
  endDate?: string;
  serviceFields: Record<string, boolean>;
  serviceDesc: string;
  items: InvoiceItem[];
  signedAtDate?: string;
  signedAtLocation?: string;
  createdAt: string;
  updatedAt: string;
  appendProformaId?: boolean;
  amountPaid?: number;
}

// ─── New: Admin Portal types (no catering-system equivalent) ──────────────

export const PORTAL_ROLES = [
  'super_admin', 'management', 'finance', 'operations', 'hr', 'branch_manager', 'staff',
] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export interface PortalUser {
  id: string; // Clerk user id
  email: string;
  fullName?: string;
  role: PortalRole;
  branch?: Branch;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const RFQ_STATUSES = [
  'draft', 'submitted', 'in_review', 'proforma_created', 'approved', 'closed', 'cancelled',
] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export interface PaxPerDayEntry {
  date: string; // ISO date string
  pax: number;
}

export interface Rfq {
  id: string; // RFQ-NNNNNN
  clientId?: string | null;
  clientNameFreetext?: string; // legacy, unused by the current create form
  title: string;
  description?: string;
  requestedById?: string;
  status: RfqStatus;
  targetEventDate?: string; // legacy, unused by the current create form
  serviceStartDate?: string;
  serviceEndDate?: string;
  proformaRequiredBy?: string;
  samePaxAllDates?: boolean;
  paxPerDay?: PaxPerDayEntry[];
  ratePerPlate?: number;
  vatType?: 'inclusive' | 'exclusive';
  location?: string;
  region?: Region;
  branch?: Branch;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RfqStatusHistoryEntry {
  id: string;
  rfqId: string;
  fromStatus?: RfqStatus;
  toStatus: RfqStatus;
  changedById?: string;
  note?: string;
  createdAt: string;
}

export interface RfqProformaLink {
  id: string;
  rfqId: string;
  proformaId: string;
  linkedById?: string;
  linkedAt: string;
}
