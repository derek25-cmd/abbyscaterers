import { endOfMonth, startOfMonth } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Company,
  CompanyDetail,
  CompanyFilters,
  FollowUp,
  MarketerLeaderboardRow,
  MarketerPerformanceRow,
  MarketingKpis,
  MonthlyReportData,
  PaginatedResult,
  PipelineMovementRow,
  RevenueByIndustryRow,
  Visit,
} from '../types';
import { buildPipelineFunnel, FUNNEL_STAGES } from '../utils/pipeline';

const SORTABLE_COLUMNS = new Set(['name', 'industry', 'pipeline_stage', 'lead_score', 'last_visited_at', 'created_at']);

/** Strips characters that would break PostgREST's `.or()` filter syntax. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, '').trim();
}

export async function getMarketingKpis(client: SupabaseClient): Promise<MarketingKpis> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [companiesRes, pendingFollowUpsRes, dealsWonRes] = await Promise.all([
    client.from('companies').select('pipeline_stage, lead_score').is('deleted_at', null),
    client.from('follow_ups').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    client
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('pipeline_stage', 'WON')
      .gte('updated_at', startOfMonth.toISOString()),
  ]);

  const companies = companiesRes.data ?? [];

  return {
    totalCompanies: companies.length,
    activeLeads: companies.filter((c) => c.pipeline_stage !== 'WON' && c.pipeline_stage !== 'LOST').length,
    hotLeads: companies.filter((c) => c.lead_score >= 70).length,
    dealsWonThisMonth: dealsWonRes.count ?? 0,
    pendingFollowUps: pendingFollowUpsRes.count ?? 0,
  };
}

export async function getPipelineFunnel(client: SupabaseClient) {
  const { data } = await client.from('companies').select('pipeline_stage').is('deleted_at', null);
  return buildPipelineFunnel((data ?? []) as Pick<Company, 'pipeline_stage'>[]);
}

export async function getUpcomingFollowUps(client: SupabaseClient, limit = 10): Promise<FollowUp[]> {
  const { data, error } = await client
    .from('follow_ups')
    .select('*, company:companies(id, name), marketer:marketing_users(id, full_name)')
    .neq('status', 'CANCELLED')
    .neq('status', 'DONE')
    .order('due_date', { ascending: true })
    .limit(limit);

  if (error) {
    console.warn('Failed to load follow-ups:', error.message);
    return [];
  }
  return (data ?? []) as unknown as FollowUp[];
}

export async function getMarketerLeaderboard(client: SupabaseClient): Promise<MarketerLeaderboardRow[]> {
  const [marketersRes, visitsRes, companiesRes] = await Promise.all([
    client.from('marketing_users').select('id, full_name').eq('is_active', true),
    client.from('visits').select('marketer_id, gps_verified, lead_score'),
    client.from('companies').select('assigned_marketer_id, pipeline_stage, created_at'),
  ]);

  const marketers = marketersRes.data ?? [];
  const visits = (visitsRes.data ?? []) as Pick<Visit, 'marketer_id' | 'gps_verified' | 'lead_score'>[];
  const companies = companiesRes.data ?? [];

  return marketers
    .map((marketer) => {
      const marketerVisits = visits.filter((v) => v.marketer_id === marketer.id);
      const marketerCompanies = companies.filter((c) => c.assigned_marketer_id === marketer.id);
      const scoredVisits = marketerVisits.filter((v) => typeof v.lead_score === 'number');

      return {
        marketerId: marketer.id,
        marketerName: marketer.full_name,
        totalVisits: marketerVisits.length,
        verifiedVisits: marketerVisits.filter((v) => v.gps_verified).length,
        newLeads: marketerCompanies.length,
        dealsWon: marketerCompanies.filter((c) => c.pipeline_stage === 'WON').length,
        avgLeadScore: scoredVisits.length
          ? Math.round(scoredVisits.reduce((sum, v) => sum + (v.lead_score ?? 0), 0) / scoredVisits.length)
          : 0,
      };
    })
    .sort((a, b) => b.dealsWon - a.dealsWon || b.avgLeadScore - a.avgLeadScore);
}

export async function getCompanies(client: SupabaseClient, filters: CompanyFilters): Promise<PaginatedResult<Company>> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const sort = filters.sort && SORTABLE_COLUMNS.has(filters.sort) ? filters.sort : 'created_at';
  const order = filters.order ?? 'desc';

  let query = client
    .from('companies')
    .select('*, region:regions(id, name), marketer:marketing_users(id, full_name)', { count: 'exact' })
    .is('deleted_at', null);

  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,contact_name.ilike.%${term}%,industry.ilike.%${term}%`);
    }
  }
  if (filters.stage?.length) query = query.in('pipeline_stage', filters.stage);
  if (filters.regionId) query = query.eq('region_id', filters.regionId);
  if (filters.assignedMarketerId) query = query.eq('assigned_marketer_id', filters.assignedMarketerId);
  if (typeof filters.minLeadScore === 'number') query = query.gte('lead_score', filters.minLeadScore);
  if (typeof filters.maxLeadScore === 'number') query = query.lte('lead_score', filters.maxLeadScore);
  if (filters.industry) query = query.ilike('industry', `%${sanitizeSearchTerm(filters.industry)}%`);
  if (filters.visitedFrom) query = query.gte('last_visited_at', filters.visitedFrom);
  if (filters.visitedTo) query = query.lte('last_visited_at', filters.visitedTo);
  if (filters.isClient) query = query.eq('pipeline_stage', 'WON');

  const { data, error, count } = await query.order(sort, { ascending: order === 'asc' }).range(from, to);

  if (error) {
    console.warn('Failed to load companies:', error.message);
    return { data: [], total: 0, page, limit };
  }

  return { data: (data ?? []) as unknown as Company[], total: count ?? 0, page, limit };
}

export async function getCompanyDetail(client: SupabaseClient, id: string): Promise<CompanyDetail | null> {
  const { data: company, error } = await client
    .from('companies')
    .select('*, region:regions(id, name), marketer:marketing_users(id, full_name)')
    .eq('id', id)
    .maybeSingle();

  if (error || !company) {
    if (error) console.warn('Failed to load company:', error.message);
    return null;
  }

  const [visitsRes, followUpsRes, notesRes, documentsRes] = await Promise.all([
    client.from('visits').select('*').eq('company_id', id).order('check_in_time', { ascending: false }),
    client
      .from('follow_ups')
      .select('*, marketer:marketing_users(id, full_name)')
      .eq('company_id', id)
      .order('due_date', { ascending: true }),
    client
      .from('company_notes')
      .select('*')
      .eq('company_id', id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    client.from('company_documents').select('*').eq('company_id', id).order('created_at', { ascending: false }),
  ]);

  const visits = visitsRes.data ?? [];
  const visitIds = visits.map((v) => v.id);

  const visitDocumentsRes = visitIds.length
    ? await client.from('visit_documents').select('*').in('visit_id', visitIds).order('created_at', { ascending: false })
    : { data: [] };

  return {
    ...(company as unknown as Company),
    region: (company as any).region ?? null,
    marketer: (company as any).marketer ?? null,
    visits: visits as unknown as Visit[],
    followUps: (followUpsRes.data ?? []) as unknown as FollowUp[],
    notes: notesRes.data ?? [],
    documents: documentsRes.data ?? [],
    visitDocuments: visitDocumentsRes.data ?? [],
  };
}

function monthRange(month: number, year: number) {
  const reference = new Date(year, month - 1, 1);
  return { start: startOfMonth(reference), end: endOfMonth(reference) };
}

export async function getMarketerPerformance(client: SupabaseClient, month: number, year: number): Promise<MarketerPerformanceRow[]> {
  const { start, end } = monthRange(month, year);

  const [marketersRes, visitsRes, companiesRes, followUpsRes] = await Promise.all([
    client.from('marketing_users').select('id, full_name, region:regions(name)').eq('is_active', true),
    client
      .from('visits')
      .select('marketer_id, gps_verified, lead_score, outcome')
      .gte('check_in_time', start.toISOString())
      .lte('check_in_time', end.toISOString()),
    client
      .from('companies')
      .select('assigned_marketer_id, pipeline_stage, estimated_value, created_at, updated_at')
      .gte('updated_at', start.toISOString())
      .lte('updated_at', end.toISOString()),
    client
      .from('follow_ups')
      .select('assigned_to, status, due_date')
      .gte('due_date', start.toISOString())
      .lte('due_date', end.toISOString()),
  ]);

  const marketers = marketersRes.data ?? [];
  const visits = visitsRes.data ?? [];
  const companies = companiesRes.data ?? [];
  const followUps = followUpsRes.data ?? [];

  return marketers
    .map((marketer) => {
      const marketerVisits = visits.filter((v) => v.marketer_id === marketer.id);
      const marketerCompanies = companies.filter((c) => c.assigned_marketer_id === marketer.id);
      const marketerFollowUps = followUps.filter((f) => f.assigned_to === marketer.id);
      const scoredVisits = marketerVisits.filter((v) => typeof v.lead_score === 'number');
      const wonCompanies = marketerCompanies.filter((c) => c.pipeline_stage === 'WON');
      const completed = marketerFollowUps.filter((f) => f.status === 'DONE').length;
      const missed = marketerFollowUps.filter((f) => f.status === 'OVERDUE' || f.status === 'CANCELLED').length;

      return {
        marketerId: marketer.id,
        marketerName: marketer.full_name,
        region: (marketer as any).region?.name ?? null,
        totalVisits: marketerVisits.length,
        verifiedVisits: marketerVisits.filter((v) => v.gps_verified).length,
        newLeads: marketerCompanies.length,
        dealsWon: wonCompanies.length,
        quotationsRequested: marketerCompanies.filter((c) => c.pipeline_stage === 'QUOTATION_REQUESTED').length,
        revenueGenerated: wonCompanies.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0),
        avgLeadScore: scoredVisits.length
          ? Math.round(scoredVisits.reduce((sum, v) => sum + (v.lead_score ?? 0), 0) / scoredVisits.length)
          : 0,
        followUpsCompleted: completed,
        followUpsMissed: missed,
        followUpRate: completed + missed ? Math.round((completed / (completed + missed)) * 100) : 0,
      };
    })
    .sort((a, b) => b.dealsWon - a.dealsWon || b.totalVisits - a.totalVisits);
}

export async function getMonthlyReportData(client: SupabaseClient, month: number, year: number): Promise<MonthlyReportData> {
  const { start, end } = monthRange(month, year);
  const previousReference = new Date(year, month - 2, 1);
  const previousMonth = previousReference.getMonth() + 1;
  const previousYear = previousReference.getFullYear();
  const { start: prevStart, end: prevEnd } = monthRange(previousMonth, previousYear);

  const [visitsRes, prevVisitsRes, companiesRes, prevCompaniesRes, hotLeadsRes, topCompaniesRes, teamPerformance] =
    await Promise.all([
      client.from('visits').select('gps_verified, outcome, company_id').gte('check_in_time', start.toISOString()).lte('check_in_time', end.toISOString()),
      client.from('visits').select('gps_verified, outcome, company_id').gte('check_in_time', prevStart.toISOString()).lte('check_in_time', prevEnd.toISOString()),
      client.from('companies').select('id, pipeline_stage, estimated_value, industry, created_at, updated_at').gte('updated_at', start.toISOString()).lte('updated_at', end.toISOString()),
      client.from('companies').select('id, pipeline_stage, estimated_value, created_at, updated_at').gte('updated_at', prevStart.toISOString()).lte('updated_at', prevEnd.toISOString()),
      client.from('companies').select('id', { count: 'exact', head: true }).gte('lead_score', 70).is('deleted_at', null),
      client
        .from('companies')
        .select('*, region:regions(id, name), marketer:marketing_users(id, full_name)')
        .is('deleted_at', null)
        .order('lead_score', { ascending: false })
        .limit(10),
      getMarketerPerformance(client, month, year),
    ]);

  const visits = visitsRes.data ?? [];
  const prevVisits = prevVisitsRes.data ?? [];
  const companies = companiesRes.data ?? [];
  const prevCompanies = prevCompaniesRes.data ?? [];

  const newLeads = companies.filter((c) => new Date(c.created_at) >= start && new Date(c.created_at) <= end).length;
  const prevNewLeads = prevCompanies.filter((c) => new Date(c.created_at) >= prevStart && new Date(c.created_at) <= prevEnd).length;
  const wonCompanies = companies.filter((c) => c.pipeline_stage === 'WON');
  const prevWonCompanies = prevCompanies.filter((c) => c.pipeline_stage === 'WON');
  const visitedCompanyIds = new Set(visits.map((v) => v.company_id));

  // Approximation: there's no stage-history table, so "moved in" counts companies
  // currently sitting in each stage whose record was touched this month.
  const pipelineMovement: PipelineMovementRow[] = FUNNEL_STAGES.map((stage) => ({
    stage,
    movedIn: companies.filter((c) => c.pipeline_stage === stage).length,
  }));

  const lostThisMonth = companies.filter((c) => c.pipeline_stage === 'LOST').length;

  const quotationsRequested = companies.filter((c) => c.pipeline_stage === 'QUOTATION_REQUESTED').length;
  const prevQuotationsRequested = prevCompanies.filter((c) => c.pipeline_stage === 'QUOTATION_REQUESTED').length;
  const revenueGenerated = wonCompanies.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0);
  const prevRevenueGenerated = prevWonCompanies.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0);

  const industryTotals = new Map<string, { companyCount: number; totalValue: number }>();
  for (const company of wonCompanies as Array<{ industry?: string | null; estimated_value: number | null }>) {
    const industry = company.industry?.trim() || 'Uncategorised';
    const entry = industryTotals.get(industry) ?? { companyCount: 0, totalValue: 0 };
    entry.companyCount += 1;
    entry.totalValue += Number(company.estimated_value) || 0;
    industryTotals.set(industry, entry);
  }
  const revenueByIndustry: RevenueByIndustryRow[] = Array.from(industryTotals.entries())
    .map(([industry, { companyCount, totalValue }]) => ({
      industry,
      companyCount,
      totalValue,
      avgDealSize: companyCount ? Math.round(totalValue / companyCount) : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return {
    month,
    year,
    summary: {
      totalVisits: visits.length,
      verifiedVisits: visits.filter((v) => v.gps_verified).length,
      newLeads,
      hotLeads: hotLeadsRes.count ?? 0,
      quotationsRequested,
      dealsWon: wonCompanies.length,
      revenueGenerated,
      conversionRate: visitedCompanyIds.size ? Math.round((wonCompanies.length / visitedCompanyIds.size) * 100) : 0,
      previous: {
        totalVisits: prevVisits.length,
        verifiedVisits: prevVisits.filter((v) => v.gps_verified).length,
        newLeads: prevNewLeads,
        quotationsRequested: prevQuotationsRequested,
        dealsWon: prevWonCompanies.length,
        revenueGenerated: prevRevenueGenerated,
      },
    },
    pipelineMovement,
    lostThisMonth,
    teamPerformance,
    topCompanies: (topCompaniesRes.data ?? []) as unknown as Company[],
    revenueByIndustry,
  };
}
