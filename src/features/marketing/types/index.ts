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
  marketer_code: string | null;
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
  client_id: string | null;
  landed_at: string | null;
  onboarding_requested: boolean;
  onboarding_requested_at: string | null;
  onboarding_requested_by: string | null;
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

export interface CompanyCollaborator {
  id: string;
  company_id: string;
  marketer_id: string;
  added_by: string;
  created_at: string;
  marketer?: Pick<MarketingUser, 'id' | 'full_name' | 'marketer_code'> | null;
}

export interface CompanyDetail extends Company {
  region?: Pick<Region, 'id' | 'name'> | null;
  marketer?: Pick<MarketingUser, 'id' | 'full_name' | 'marketer_code'> | null;
  visits: Visit[];
  followUps: FollowUp[];
  notes: CompanyNote[];
  documents: CompanyDocument[];
  visitDocuments: VisitDocument[];
  collaborators: CompanyCollaborator[];
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
  isClient?: boolean;
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
  revenueByIndustry: RevenueByIndustryRow[];
}

export interface AIFollowUpDraft {
  draft: string;
  type: string;
  language: "english" | "swahili";
}

export interface AILeadAnalysis {
  recommendation: "PURSUE" | "PAUSE" | "ABANDON";
  reasoning: string;
  nextAction: string;
}

/** Unified shape for the company Documents tab grid — merges company_documents and visit_documents rows. */
export interface DocumentRow {
  id: string;
  name: string;
  type: string;
  path: string;
  bucket: "visit-photos" | "voice-notes" | "company-documents";
  uploadedBy: string;
  createdAt: string;
}

export interface CompanyImportRowError {
  row: number;
  companyName: string;
  reason: string;
}

export interface CompanyImportRowWarning {
  row: number;
  companyName: string;
  field: string;
  message: string;
}

export interface CompanyImportResult {
  totalRows: number;
  imported: number;
  duplicates: number;
  skipped: number;
  warnings: number;
  errors: CompanyImportRowError[];
  warningDetails: CompanyImportRowWarning[];
}

export type NotificationType =
  | 'HOT_LEAD'
  | 'DEAL_WON'
  | 'FOLLOWUP_OVERDUE'
  | 'FOLLOWUP_DUE_TODAY'
  | 'QUOTATION_REQUESTED'
  | 'STAGE_CHANGE'
  | 'MARKETER_INACTIVE'
  | 'TARGET_SET'
  | 'TARGET_DUE'
  | 'FOLLOW_UP_DUE'
  | 'APPROVAL'
  | 'MESSAGE';

export interface MarketingNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  companyId?: string;
  companyName?: string;
  marketerId?: string;
  marketerName?: string;
  isRead: boolean;
  createdAt: string;
}

export interface MarketerLiveLocation {
  id: string;
  full_name: string;
  email: string;
  last_latitude: number | null;
  last_longitude: number | null;
  last_seen_at: string | null;
  region_id: string | null;
  region_name: string | null;
  visits_today: number;
  last_check_in: string | null;
}

export interface CompanyMapPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  pipeline_stage: PipelineStage;
  lead_score: number;
  last_visited_at: string | null;
  assigned_marketer_id: string | null;
  marketer_name: string | null;
  visit_recency: 'visited_today' | 'visited_week' | 'never_visited' | 'not_recent';
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface TerritoryCoverage {
  regionId: string;
  regionName: string;
  assigned: number;
  visitedToday: number;
  coveragePercent: number;
}

export interface LiveActivityItem {
  id: string;
  marketerName: string;
  companyName: string;
  checkInTime: string;
  gpsVerified: boolean;
}

export interface MarketingLiveData {
  marketers: MarketerLiveLocation[];
  todaysActivity: LiveActivityItem[];
  territoryCoverage: TerritoryCoverage[];
}

export interface QuotationPrompt {
  companyId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  estimatedValue: number | null;
  services: string[];
  createQuotationUrl: string;
}

export interface WonAlert {
  companyName: string;
  estimatedMonthlyValue: number | null;
  viewBookingsUrl: string;
}

export interface CacResult {
  newClients: number;
  totalExpenses: number | null;
  cac: number | null;
  previousMonthCAC: number | null;
}

export interface RevenueByMarketerRow {
  marketerName: string;
  revenue: number;
}

export interface RevenueByRegionRow {
  regionName: string;
  revenue: number;
}

export interface RevenueByIndustryRow {
  industry: string;
  companyCount: number;
  totalValue: number;
  avgDealSize: number;
}

export interface CompetitorRow {
  name: string;
  companyCount: number;
  totalEstimatedValue: number;
  avgLeadScore: number;
  industries: string[];
  recentlyMentioned: number;
}

export interface MarketingPerformanceSnapshot {
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
}

export interface RoiResult {
  revenueGenerated: number;
  marketingExpenses: number | null;
  roiPercent: number | null;
  paybackMonths: number | null;
}

export type ApprovalStatus =
  | 'INCOMPLETE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  | 'CAUTIONED' | 'RESTRICTED' | 'DISABLED' | 'SUSPENDED' | 'DELETED';

export type DocumentType =
  | 'NIDA_FRONT'
  | 'NIDA_BACK'
  | 'TIN_CERTIFICATE'
  | 'PROFILE_PHOTO'
  | 'SUPPORTING_DOCUMENT';

export interface PendingApplication {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  /** Sourced from google_email in the view. */
  email: string;
  google_avatar_url: string | null;
  phone: string | null;
  nida_number: string | null;
  tin_number: string | null;
  region_id: string | null;
  region_name: string | null;
  employment_type: string | null;
  submitted_at: string;
  approval_status: ApprovalStatus;
  onboarding_step: number;
  document_count: number;
}

export interface MarketerDocument {
  id: string;
  marketer_id: string;
  document_type: DocumentType;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface MarketerApprovalLogEntry {
  id: string;
  marketer_id: string;
  action:
    | 'REGISTERED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
    | 'CAUTIONED' | 'RESTRICTED' | 'RESTRICTION_LIFTED'
    | 'DISABLED' | 'REINSTATED' | 'SUSPENDED' | 'SUSPENSION_LIFTED'
    | 'DELETED' | 'PROFILE_UPDATED_BY_MANAGER';
  performed_by: string;
  reason: string | null;
  created_at: string;
}

export interface ApplicationDetail {
  marketer: MarketingUser & Record<string, unknown>;
  documents: MarketerDocument[];
  auditLog: MarketerApprovalLogEntry[];
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

export interface AccountAction {
  id: string;
  marketer_id: string;
  action: string;
  performed_by: string;
  performed_by_user?: { id: string; full_name: string; role: string };
  reason: string | null;
  internal_notes: string | null;
  visible_to_marketer: boolean;
  effective_from: string;
  effective_until: string | null;
  reverted_at: string | null;
  created_at: string;
}

export interface MarketerAccountOverview {
  id: string;
  full_name: string;
  email: string;
  google_email: string | null;
  phone: string | null;
  role: MarketingUserRole;
  is_active: boolean;
  approval_status: ApprovalStatus;
  caution_count: number;
  last_caution_at: string | null;
  disabled_reason: string | null;
  disabled_at: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  deleted_at: string | null;
  region_name: string | null;
  region_id: string | null;
  visits_this_month: number | null;
  deals_this_month: number | null;
  avg_lead_score: number | null;
  last_seen_at: string | null;
  total_cautions: number;
  total_disables: number;
}

export interface DailyReport {
  id: string;
  marketer_id: string;
  report_date: string;
  narrative: string;
  visits_count: number;
  prospects_count: number;
  quotations_requested_count: number;
  submitted_at: string;
  marketer?: { id: string; full_name: string } | null;
}

export interface DailyReportDraft {
  date: string;
  visits: Array<{
    id: string;
    interest_level: InterestLevel | null;
    outcome: VisitOutcome | null;
    company: { id: string; name: string; pipeline_stage: PipelineStage } | null;
  }>;
  visitsCount: number;
  prospectsCount: number;
  quotationsRequestedCount: number;
  existingReport: DailyReport | null;
}

export type CommissionStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface MarketerCommission {
  id: string;
  company_id: string | null;
  marketer_id: string;
  client_id: string;
  invoice_id: string;
  invoice_total: number;
  commission_rate: number;
  commission_amount: number;
  split_count: number;
  status: CommissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  company: { id: string; name: string } | null;
  marketer: { id: string; full_name: string } | null;
}

export type TargetScope = 'MARKETER' | 'OVERALL';
export type TargetPeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
export type TargetAnalysisStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'MISSED';

export interface MarketingTarget {
  id: string;
  scope: TargetScope;
  marketer_id: string | null;
  period_type: TargetPeriodType;
  start_date: string;
  end_date: string;
  metrics: Record<string, number>;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  marketer?: { id: string; full_name: string } | null;
  latestAnalysis?: TargetAnalysis | null;
}

export interface TargetAnalysis {
  id: string;
  target_id: string;
  actuals: Record<string, number>;
  score: number;
  status: TargetAnalysisStatus;
  narrative: string | null;
  recommendation: string | null;
  analysed_by: string | null;
  created_at: string;
}

export type AccountActionKey =
  | 'caution' | 'restrict' | 'lift_restriction' | 'suspend'
  | 'disable' | 'reinstate' | 'delete';

export const ACCOUNT_STATUS_CONFIG: Record<ApprovalStatus, {
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
  canPerform: AccountActionKey[];
}> = {
  INCOMPLETE: {
    label: 'Incomplete',
    description: 'Onboarding not finished',
    badgeClass: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
    canPerform: [],
  },
  PENDING: {
    label: 'Pending',
    description: 'Awaiting manager approval',
    badgeClass: 'bg-warning/15 text-warning',
    dotClass: 'bg-warning',
    canPerform: [],
  },
  APPROVED: {
    label: 'Active',
    description: 'Account in good standing',
    badgeClass: 'bg-success/15 text-success',
    dotClass: 'bg-success',
    canPerform: ['caution', 'restrict', 'suspend', 'disable', 'delete'],
  },
  REJECTED: {
    label: 'Rejected',
    description: 'Application was rejected',
    badgeClass: 'bg-destructive/15 text-destructive',
    dotClass: 'bg-destructive',
    canPerform: ['delete'],
  },
  CAUTIONED: {
    label: 'Cautioned',
    description: 'Formal warning issued',
    badgeClass: 'bg-warning/15 text-warning',
    dotClass: 'bg-warning',
    canPerform: ['restrict', 'suspend', 'disable', 'delete', 'reinstate'],
  },
  RESTRICTED: {
    label: 'Restricted',
    description: 'Read-only access',
    badgeClass: 'bg-secondary text-secondary-foreground',
    dotClass: 'bg-secondary-foreground',
    canPerform: ['lift_restriction', 'disable', 'suspend', 'delete'],
  },
  DISABLED: {
    label: 'Disabled',
    description: 'Access blocked by manager',
    badgeClass: 'bg-destructive/15 text-destructive',
    dotClass: 'bg-destructive',
    canPerform: ['reinstate', 'delete'],
  },
  SUSPENDED: {
    label: 'Suspended',
    description: 'Temporary access block',
    badgeClass: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
    canPerform: ['reinstate', 'disable', 'delete'],
  },
  DELETED: {
    label: 'Deleted',
    description: 'Account removed — login revoked, data preserved',
    badgeClass: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
    canPerform: [],
  },
};
