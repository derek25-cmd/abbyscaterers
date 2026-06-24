import { getRouteClient } from '@/features/marketing/api/route-client';
import { computeTargetActuals, scoreTarget } from '@/features/marketing/utils/targets';

export const dynamic = 'force-dynamic';

async function runTargetAnalysis(client: ReturnType<typeof getRouteClient>) {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00.000Z`;

  const { data: activeTargets, error } = await client
    .from('marketing_targets')
    .select('id, scope, marketer_id, start_date, end_date, metrics')
    .lte('start_date', today)
    .gte('end_date', today);

  if (error) {
    console.error('[cron] fetching active targets failed:', error);
    return { analysed: 0, notified: 0 };
  }
  if (!activeTargets || activeTargets.length === 0) {
    return { analysed: 0, notified: 0 };
  }

  const { data: activeMarketers } = await client
    .from('marketing_users')
    .select('id')
    .eq('role', 'MARKETER')
    .eq('is_active', true);
  const allMarketerIds = (activeMarketers ?? []).map((m: { id: string }) => m.id);

  const { data: notifiedToday } = await client
    .from('marketing_notifications')
    .select('marketer_id')
    .eq('type', 'TARGET_DUE')
    .gte('created_at', todayStart);
  const alreadyNotified = new Set((notifiedToday ?? []).map((n: { marketer_id: string | null }) => n.marketer_id));

  let analysed = 0;
  let notified = 0;

  for (const target of activeTargets) {
    const actuals = await computeTargetActuals(
      client,
      target.scope === 'MARKETER' ? target.marketer_id : null,
      target.start_date,
      target.end_date,
      Object.keys(target.metrics)
    );
    const { score, status } = scoreTarget(target.metrics, actuals, target.end_date);

    const { error: insertError } = await client.from('marketing_target_analyses').insert([{
      target_id: target.id,
      actuals,
      score,
      status,
    }]);
    if (insertError) {
      console.error(`[cron] target analysis insert failed for ${target.id}:`, insertError);
      continue;
    }
    analysed += 1;

    if (status === 'ACHIEVED') continue;

    const candidateMarketerIds = target.scope === 'MARKETER'
      ? (target.marketer_id ? [target.marketer_id] : [])
      : allMarketerIds;
    const toNotify = candidateMarketerIds.filter((id: string) => !alreadyNotified.has(id));
    if (toNotify.length === 0) continue;

    const { error: notifyError } = await client.from('marketing_notifications').insert(
      toNotify.map((marketerId: string) => ({
        type: 'TARGET_DUE' as const,
        title: 'Target Needs Attention',
        message: 'One of your performance targets is due and not yet achieved.',
        marketer_id: marketerId,
      }))
    );
    if (!notifyError) {
      toNotify.forEach((id: string) => alreadyNotified.add(id));
      notified += toNotify.length;
    } else {
      console.error(`[cron] TARGET_DUE notification insert failed for target ${target.id}:`, notifyError);
    }
  }

  return { analysed, notified };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // No user session exists for a cron-triggered request, so this uses the anon-key
  // client; both RPCs are SECURITY DEFINER so they run regardless of the
  // caller's RLS role.
  const client = getRouteClient(null);
  const { error } = await client.rpc('aggregate_marketing_performance');

  if (error) {
    console.error('[cron] marketing-performance aggregation failed:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  const { data: reinstatedCount, error: reinstateError } = await client.rpc('auto_reinstate_expired_suspensions');

  if (reinstateError) {
    console.error('[cron] auto-reinstate failed:', reinstateError);
  } else {
    console.log(`[cron] Auto-reinstated ${reinstatedCount} suspended marketers`);
  }

  const { analysed, notified } = await runTargetAnalysis(client);

  return Response.json({
    success: true,
    message: 'Performance aggregated',
    reinstated: reinstatedCount ?? 0,
    targetsAnalysed: analysed,
    targetDueNotifications: notified,
    timestamp: new Date().toISOString(),
  });
}
