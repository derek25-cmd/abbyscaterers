import { supabase } from '@/lib/supabase-client';
import type { ModuleReportData } from './types';
import type { PeriodRange } from './periods';
import { kpi } from './aggregate-helpers';

interface CompanyRow { id: string; pipeline_stage: string; estimated_value: number | null }
interface FollowUpRow { status: string }

/**
 * Marketing/CRM tables (companies, visits, follow_ups) have permissive
 * "any authenticated user" RLS policies (see
 * supabase/migrations/20260620120000_add_marketing_crm.sql) — unlike the
 * core finance/HR tables, they're safe to query directly from the browser
 * client, so this module doesn't need the service-layer indirection
 * business-data.ts uses for tables with known column-casing drift.
 */
export async function fetchMarketingModuleData(range: PeriodRange): Promise<ModuleReportData> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const prevFromIso = range.prevFrom.toISOString();
  const prevToIso = range.prevTo.toISOString();

  const [companiesRes, prevCompaniesRes, visitsRes, followUpsRes, wonRes] = await Promise.all([
    supabase.from('companies').select('id, pipeline_stage, estimated_value').is('deleted_at', null).gte('created_at', fromIso).lte('created_at', toIso),
    supabase.from('companies').select('id').is('deleted_at', null).gte('created_at', prevFromIso).lte('created_at', prevToIso),
    supabase.from('visits').select('id, gps_verified').gte('check_in_time', fromIso).lte('check_in_time', toIso),
    supabase.from('follow_ups').select('status').gte('due_date', fromIso).lte('due_date', toIso),
    supabase.from('companies').select('id, estimated_value').eq('pipeline_stage', 'WON').is('deleted_at', null).gte('updated_at', fromIso).lte('updated_at', toIso),
  ]);

  const companies = (companiesRes.data ?? []) as CompanyRow[];
  const prevCompanies = prevCompaniesRes.data ?? [];
  const visits = visitsRes.data ?? [];
  const followUps = (followUpsRes.data ?? []) as FollowUpRow[];
  const won = (wonRes.data ?? []) as CompanyRow[];

  const revenueWon = won.reduce((s, c) => s + (Number(c.estimated_value) || 0), 0);
  const completed = followUps.filter((f) => f.status === 'DONE').length;
  const missed = followUps.filter((f) => f.status === 'OVERDUE' || f.status === 'CANCELLED').length;

  const stageGroups = new Map<string, number>();
  companies.forEach((c) => stageGroups.set(c.pipeline_stage, (stageGroups.get(c.pipeline_stage) || 0) + 1));
  const stageRows = Array.from(stageGroups.entries()).sort((a, b) => b[1] - a[1]);

  return {
    moduleId: 'marketing-crm',
    moduleLabel: 'Marketing & CRM',
    kpis: [
      kpi('New Leads (Companies)', companies.length, 'number', prevCompanies.length),
      kpi('Field Visits', visits.length, 'number'),
      kpi('Verified Visits', visits.filter((v) => v.gps_verified).length, 'number'),
      kpi('Deals Won', won.length, 'number'),
      kpi('Revenue from Deals Won', revenueWon, 'currency'),
      kpi('Follow-ups Completed', completed, 'number'),
      kpi('Follow-ups Missed', missed, 'number'),
    ],
    tables: [
      { title: 'New Leads by Pipeline Stage', columns: ['Stage', 'Count'], rows: stageRows },
    ],
    charts: [{ title: 'Pipeline Stage Split', type: 'pie', data: stageRows.map(([name, value]) => ({ name, value })) }],
  };
}
