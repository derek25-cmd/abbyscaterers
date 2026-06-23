import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

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

  return Response.json({
    success: true,
    message: 'Performance aggregated',
    reinstated: reinstatedCount ?? 0,
    timestamp: new Date().toISOString(),
  });
}
