import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';
import { analyseTargetPerformance } from '@/features/marketing/utils/ai';
import { computeTargetActuals, scoreTarget } from '@/features/marketing/utils/targets';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { data: target, error: targetError } = await client
    .from('marketing_targets')
    .select('*, marketer:marketing_users(id, full_name)')
    .eq('id', params.id)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });
  }

  // A marketer may only analyse their own target; OVERALL (team-wide) targets are manager-only.
  const ownsTarget = target.scope === 'MARKETER' && target.marketer_id === session.marketerId;
  if (!isManager(session.role) && !ownsTarget) {
    return NextResponse.json({ error: 'You can only analyse your own targets' }, { status: 403 });
  }

  const actuals = await computeTargetActuals(
    client,
    target.scope === 'MARKETER' ? target.marketer_id : null,
    target.start_date,
    target.end_date,
    Object.keys(target.metrics)
  );
  const { percentAchieved, score, status } = scoreTarget(target.metrics, actuals, target.end_date);

  const daysRemaining = Math.ceil(
    (new Date(`${target.end_date}T23:59:59.999Z`).getTime() - Date.now()) / 86_400_000
  );

  let narrative: string | null = null;
  let recommendation: string | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await analyseTargetPerformance({
        subjectName: target.scope === 'OVERALL' ? 'the whole team' : target.marketer?.full_name ?? 'the marketer',
        periodType: target.period_type,
        startDate: target.start_date,
        endDate: target.end_date,
        daysRemaining,
        metricGoals: target.metrics,
        metricActuals: actuals,
        metricPercentAchieved: percentAchieved,
        score,
        status,
      });
      narrative = result.narrative;
      recommendation = result.recommendation;
    } catch (err) {
      console.error('[targets/analyse] Claude API error:', err);
    }
  }

  const { data, error } = await client
    .from('marketing_target_analyses')
    .insert([{
      target_id: target.id,
      actuals,
      score,
      status,
      narrative,
      recommendation,
      analysed_by: session.marketerId,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
