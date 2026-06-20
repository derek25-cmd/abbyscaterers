export type PipelineStage =
  | 'IDENTIFIED'
  | 'VISITED'
  | 'INTERESTED'
  | 'QUOTATION_REQUESTED'
  | 'NEGOTIATING'
  | 'WON'
  | 'LOST';

export type VisitPurpose =
  | 'INTRODUCTION'
  | 'FOLLOW_UP'
  | 'PROPOSAL_DELIVERY'
  | 'QUOTATION_FOLLOW_UP'
  | 'CONTRACT_RENEWAL'
  | 'COMPLAINT_RESOLUTION'
  | 'EVENT_INVITATION'
  | 'TASTING_SESSION';

export type VisitOutcome =
  | 'VISITED'
  | 'NO_ONE_AVAILABLE'
  | 'MEETING_POSTPONED'
  | 'PROPOSAL_REQUESTED'
  | 'QUOTATION_SENT'
  | 'CONTRACT_NEGOTIATION'
  | 'CUSTOMER_ACQUIRED';

export type InterestLevel = 'NOT_INTERESTED' | 'MAYBE' | 'INTERESTED' | 'VERY_INTERESTED';

export type FollowUpType =
  | 'CALL'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'IN_PERSON_VISIT'
  | 'SEND_QUOTATION'
  | 'SEND_COMPANY_PROFILE'
  | 'ARRANGE_TASTING'
  | 'MEET_CEO'
  | 'MEET_PROCUREMENT'
  | 'CONTRACT_SIGNING';

export type FollowUpStatus = 'PENDING' | 'DONE' | 'OVERDUE' | 'CANCELLED' | 'RESCHEDULED';

export type MarketingUserRole = 'MARKETER' | 'MARKETING_MANAGER' | 'ADMIN';

export type BusinessSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';

export interface Region {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: MarketingUserRole;
  is_active: boolean;
  region_id: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  business_size: BusinessSize | null;
  employee_count: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  region_id: string | null;
  contact_name: string | null;
  contact_position: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  current_caterer: string | null;
  current_caterer_notes: string | null;
  pipeline_stage: PipelineStage;
  lead_score: number;
  estimated_value: number | null;
  assigned_marketer_id: string | null;
  qr_code: string | null;
  last_visited_at: string | null;
  client_since: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  company_id: string;
  marketer_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  gps_verified: boolean;
  gps_accuracy_tag: 'VERIFIED' | 'APPROXIMATE' | 'UNVERIFIED' | null;
  purpose: VisitPurpose | null;
  outcome: VisitOutcome | null;
  interest_level: InterestLevel | null;
  decision_maker_met: boolean;
  budget_confirmed: boolean;
  follow_up_requested: boolean;
  services_presented: string[];
  notes: string | null;
  lead_score: number | null;
  selfie_url: string | null;
  gate_photo_url: string | null;
  voice_note_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  company_id: string;
  visit_id: string | null;
  assigned_to: string;
  type: FollowUpType;
  due_date: string;
  status: FollowUpStatus;
  notes: string | null;
  completed_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
  company?: Pick<Company, 'id' | 'name'>;
  marketer?: Pick<MarketingUser, 'id' | 'full_name'>;
}

export interface MarketingPerformance {
  id: string;
  marketer_id: string;
  month: number;
  year: number;
  total_visits: number;
  verified_visits: number;
  new_leads: number;
  hot_leads: number;
  quotations_requested: number;
  deals_won: number;
  follow_ups_completed: number;
  follow_ups_missed: number;
  revenue_generated: number;
  avg_lead_score: number;
  avg_interest_level: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingKpis {
  totalCompanies: number;
  activeLeads: number;
  hotLeads: number;
  dealsWonThisMonth: number;
  pendingFollowUps: number;
}

export interface PipelineFunnelStage {
  stage: PipelineStage;
  count: number;
}

export interface MarketerLeaderboardRow {
  marketerId: string;
  marketerName: string;
  totalVisits: number;
  verifiedVisits: number;
  newLeads: number;
  dealsWon: number;
  avgLeadScore: number;
}

export interface CompanyNote {
  id: string;
  company_id: string;
  author_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyDocument {
  id: string;
  company_id: string;
  name: string;
  type: string;
  url: string;
  uploaded_by: string;
  created_at: string;
}

export interface VisitDocument {
  id: string;
  visit_id: string;
  name: string;
  type: string;
  url: string;
  uploaded_by: string;
  created_at: string;
}

export interface CompanyDetail extends Company {
  region?: Pick<Region, 'id' | 'name'> | null;
  marketer?: Pick<MarketingUser, 'id' | 'full_name'> | null;
  visits: Visit[];
  followUps: FollowUp[];
  notes: CompanyNote[];
  documents: CompanyDocument[];
  visitDocuments: VisitDocument[];
}

export interface CompanyFilters {
  search?: string;
  stage?: PipelineStage[];
  regionId?: string;
  assignedMarketerId?: string;
  minLeadScore?: number;
  maxLeadScore?: number;
  industry?: string;
  visitedFrom?: string;
  visitedTo?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MarketerPerformanceRow extends MarketerLeaderboardRow {
  region: string | null;
  quotationsRequested: number;
  revenueGenerated: number;
  followUpsCompleted: number;
  followUpsMissed: number;
  followUpRate: number;
}

export interface MonthlyReportSummary {
  totalVisits: number;
  verifiedVisits: number;
  newLeads: number;
  hotLeads: number;
  quotationsRequested: number;
  dealsWon: number;
  revenueGenerated: number;
  conversionRate: number;
  previous: {
    totalVisits: number;
    verifiedVisits: number;
    newLeads: number;
    quotationsRequested: number;
    dealsWon: number;
    revenueGenerated: number;
  };
}

export interface PipelineMovementRow {
  stage: PipelineStage;
  movedIn: number;
}

export interface MonthlyReportData {
  month: number;
  year: number;
  summary: MonthlyReportSummary;
  pipelineMovement: PipelineMovementRow[];
  lostThisMonth: number;
  teamPerformance: MarketerPerformanceRow[];
  topCompanies: Company[];
}

export const SERVICE_OPTIONS = [
  'Corporate Catering',
  'Wedding Catering',
  'Outdoor Events',
  'Conferences',
  'Staff Meals',
  'VIP Catering',
  'Equipment Hire',
  'Event Decoration',
  'Tent Services',
  'Photography',
  'Event Planning',
] as const;
