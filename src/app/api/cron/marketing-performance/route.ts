import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // No user session exists for a cron-triggered request, so this uses the anon-key
  // client; aggregate_marketing_performance() is SECURITY DEFINER so it runs
  // regardless of the caller's RLS role.
  const client = getRouteClient(null);
  const { error } = await client.rpc('aggregate_marketing_performance');

  if (error) {
    console.error('[cron] marketing-performance aggregation failed:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: 'Performance aggregated',
    timestamp: new Date().toISOString(),
  });
}
