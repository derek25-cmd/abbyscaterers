import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';
import { computeTargetActuals, notifyTargetSet, scoreTarget, TARGET_METRIC_KEYS, TARGET_PERIOD_TYPES } from '@/features/marketing/utils/targets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const requestedMarketerId = params.get('marketerId');
  const scope = params.get('scope');
  const periodType = params.get('periodType');
  const active = params.get('active'); // "true" => start_date <= today <= end_date

  let query = client
    .from('marketing_targets')
    .select('*, marketer:marketing_users!marketing_targets_marketer_id_fkey(id, full_name), latestAnalysis:marketing_target_analyses(id, target_id, actuals, score, status, narrative, recommendation, analysed_by, created_at)')
    .order('start_date', { ascending: false });

  // A marketer sees their own targets plus every OVERALL (team-wide) target.
  // Managers/admins can browse anyone's.
  if (!isManager(session.role)) {
    query = query.or(`marketer_id.eq.${session.marketerId},scope.eq.OVERALL`);
  } else if (requestedMarketerId) {
    query = query.eq('marketer_id', requestedMarketerId);
  }

  if (scope) query = query.eq('scope', scope);
  if (periodType) query = query.eq('period_type', periodType);
  if (active === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    query = query.lte('start_date', today).gte('end_date', today);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Embedded one-to-many analysis selects return an array — keep only the latest.
  const normalised = (data ?? []).map((row: any) => ({
    ...row,
    latestAnalysis: Array.isArray(row.latestAnalysis)
      ? row.latestAnalysis.sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null
      : row.latestAnalysis,
  }));

  // liveProgress is always computed fresh from visits/companies/commissions —
  // unlike latestAnalysis (a manually-triggered, point-in-time AI snapshot),
  // this is what the progress board renders so it never looks stale.
  const withProgress = await Promise.all(
    normalised.map(async (target: any) => {
      const actuals = await computeTargetActuals(
        client,
        target.marketer_id,
        target.start_date,
        target.end_date,
        Object.keys(target.metrics)
      );
      const { percentAchieved, score, status } = scoreTarget(target.metrics, actuals, target.end_date);
      return { ...target, liveProgress: { actuals, percentAchieved, score, status } };
    })
  );

  return NextResponse.json({ data: withProgress });
}

export async function POST(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'Only managers or admins can set targets' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { scope, marketerId, periodType, startDate, endDate, metrics, notes } = body;

  if (scope !== 'MARKETER' && scope !== 'OVERALL') {
    return NextResponse.json({ error: 'scope must be MARKETER or OVERALL' }, { status: 400 });
  }
  if (scope === 'MARKETER' && !marketerId) {
    return NextResponse.json({ error: 'marketerId is required for a MARKETER-scoped target' }, { status: 400 });
  }
  if (!TARGET_PERIOD_TYPES.includes(periodType)) {
    return NextResponse.json({ error: 'Invalid periodType' }, { status: 400 });
  }
  if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
  }
  if (!metrics || typeof metrics !== 'object' || Object.keys(metrics).length === 0) {
    return NextResponse.json({ error: 'At least one metric goal is required' }, { status: 400 });
  }
  for (const key of Object.keys(metrics)) {
    if (!TARGET_METRIC_KEYS.includes(key as any) || typeof metrics[key] !== 'number' || metrics[key] <= 0) {
      return NextResponse.json({ error: `Invalid metric "${key}" — must be one of ${TARGET_METRIC_KEYS.join(', ')} with a positive numeric goal` }, { status: 400 });
    }
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { data, error } = await client
    .from('marketing_targets')
    .insert([{
      scope,
      marketer_id: scope === 'MARKETER' ? marketerId : null,
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
      metrics,
      notes: notes ?? null,
      created_by: session.marketerId,
    }])
    .select('*, marketer:marketing_users!marketing_targets_marketer_id_fkey(id, full_name)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await notifyTargetSet(client, data);
  } catch (notifyError) {
    console.error('[targets] TARGET_SET notification failed:', notifyError);
  }

  return NextResponse.json({ data });
}
