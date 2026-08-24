import type { SupabaseClient } from '@supabase/supabase-js';

export const TARGET_METRIC_KEYS = [
  'visits',
  'new_leads',
  'quotations_requested',
  'deals_won',
  'revenue_generated',
  'commission_earned',
] as const;

export type TargetMetricKey = typeof TARGET_METRIC_KEYS[number];

export const TARGET_PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const;

export type TargetPeriodType = typeof TARGET_PERIOD_TYPES[number];

export const TARGET_PERIOD_LABELS: Record<TargetPeriodType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: '6 Months',
  ANNUAL: 'Annual',
};

/** Default end date for a period type anchored at `startDate` (e.g. QUARTERLY -> +3 months - 1 day). */
export function computePeriodEndDate(periodType: TargetPeriodType, startDate: string): string {
  const end = new Date(`${startDate}T00:00:00.000Z`);
  switch (periodType) {
    case 'DAILY':
      break;
    case 'WEEKLY':
      end.setUTCDate(end.getUTCDate() + 6);
      break;
    case 'MONTHLY':
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCDate(end.getUTCDate() - 1);
      break;
    case 'QUARTERLY':
      end.setUTCMonth(end.getUTCMonth() + 3);
      end.setUTCDate(end.getUTCDate() - 1);
      break;
    case 'SEMI_ANNUAL':
      end.setUTCMonth(end.getUTCMonth() + 6);
      end.setUTCDate(end.getUTCDate() - 1);
      break;
    case 'ANNUAL':
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      end.setUTCDate(end.getUTCDate() - 1);
      break;
  }
  return end.toISOString().slice(0, 10);
}

/**
 * Inserts a TARGET_SET notification for whoever a newly created/updated
 * target applies to. Always sets marketer_id — the mobile app's realtime
 * stream filters on it, so a notification without one reaches nobody.
 */
export async function notifyTargetSet(
  client: SupabaseClient,
  target: { scope: string; marketer_id: string | null }
): Promise<void> {
  if (target.scope === 'MARKETER') {
    if (!target.marketer_id) return;
    await client.from('marketing_notifications').insert([{
      type: 'TARGET_SET',
      title: 'New Target Set',
      message: 'A new performance target has been set for you.',
      marketer_id: target.marketer_id,
    }]);
    return;
  }

  const { data: marketers } = await client
    .from('marketing_users')
    .select('id')
    .eq('role', 'MARKETER')
    .eq('is_active', true);

  if (marketers && marketers.length > 0) {
    await client.from('marketing_notifications').insert(
      marketers.map((m: { id: string }) => ({
        type: 'TARGET_SET' as const,
        title: 'New Team Target Set',
        message: 'A new team-wide performance target has been set.',
        marketer_id: m.id,
      }))
    );
  }
}

/**
 * Computes actuals for one or more marketers (all of them, for an OVERALL
 * target) over [startDate, endDate], for whichever metric keys appear in
 * `goalKeys`. Pulled straight from visits/companies/marketer_commissions —
 * the same tables the marketer's own daily reports and the dashboard
 * already aggregate from.
 */
export async function computeTargetActuals(
  client: SupabaseClient,
  marketerId: string | null,
  startDate: string,
  endDate: string,
  goalKeys: string[]
): Promise<Record<string, number>> {
  const dayStart = `${startDate}T00:00:00.000Z`;
  const dayEnd = `${endDate}T23:59:59.999Z`;
  const actuals: Record<string, number> = {};
  const needs = (key: string) => goalKeys.includes(key);

  if (needs('visits')) {
    let q = client.from('visits').select('id', { count: 'exact', head: true })
      .gte('check_in_time', dayStart).lte('check_in_time', dayEnd);
    if (marketerId) q = q.eq('marketer_id', marketerId);
    const { count } = await q;
    actuals.visits = count ?? 0;
  }

  if (needs('new_leads')) {
    let q = client.from('companies').select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart).lte('created_at', dayEnd);
    if (marketerId) q = q.eq('assigned_marketer_id', marketerId);
    const { count } = await q;
    actuals.new_leads = count ?? 0;
  }

  if (needs('quotations_requested')) {
    let q = client.from('visits').select('id, company:companies(pipeline_stage)')
      .gte('check_in_time', dayStart).lte('check_in_time', dayEnd);
    if (marketerId) q = q.eq('marketer_id', marketerId);
    const { data } = await q;
    actuals.quotations_requested = (data ?? []).filter(
      (v: any) => v.company?.pipeline_stage === 'QUOTATION_REQUESTED'
    ).length;
  }

  if (needs('deals_won') || needs('revenue_generated')) {
    let q = client.from('companies').select('id, estimated_value')
      .eq('pipeline_stage', 'WON')
      .gte('landed_at', dayStart).lte('landed_at', dayEnd);
    if (marketerId) q = q.eq('assigned_marketer_id', marketerId);
    const { data } = await q;
    const won = data ?? [];
    if (needs('deals_won')) actuals.deals_won = won.length;
    if (needs('revenue_generated')) {
      actuals.revenue_generated = won.reduce((sum: number, c: any) => sum + (c.estimated_value ?? 0), 0);
    }
  }

  if (needs('commission_earned')) {
    let q = client.from('marketer_commissions').select('commission_amount')
      .eq('status', 'APPROVED')
      .gte('created_at', dayStart).lte('created_at', dayEnd);
    if (marketerId) q = q.eq('marketer_id', marketerId);
    const { data } = await q;
    actuals.commission_earned = (data ?? []).reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);
  }

  return actuals;
}

export interface ComputedScore {
  percentAchieved: Record<string, number>;
  score: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'MISSED';
}

/** Per-metric % achieved (capped at 100), averaged into one 0-100 score. Status reflects both the score and whether the period has ended yet. */
export function scoreTarget(
  goals: Record<string, number>,
  actuals: Record<string, number>,
  endDate: string
): ComputedScore {
  const keys = Object.keys(goals);
  const percentAchieved: Record<string, number> = {};

  for (const key of keys) {
    const goal = goals[key];
    const actual = actuals[key] ?? 0;
    percentAchieved[key] = goal > 0 ? Math.round((actual / goal) * 100) : 0;
  }

  const cappedAvg = keys.length > 0
    ? keys.reduce((sum, key) => sum + Math.min(percentAchieved[key], 100), 0) / keys.length
    : 0;
  const score = Math.round(cappedAvg * 100) / 100;

  const periodEnded = new Date(`${endDate}T23:59:59.999Z`).getTime() < Date.now();
  const anyProgress = keys.some((key) => (actuals[key] ?? 0) > 0);

  let status: ComputedScore['status'];
  if (!anyProgress && !periodEnded) status = 'NOT_STARTED';
  else if (!periodEnded) status = 'IN_PROGRESS';
  else if (score >= 100) status = 'ACHIEVED';
  else if (score >= 50) status = 'PARTIALLY_ACHIEVED';
  else status = 'MISSED';

  return { percentAchieved, score, status };
}
