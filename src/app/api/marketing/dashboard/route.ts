import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import {
  getMarketerLeaderboard,
  getMarketingKpis,
  getPipelineFunnel,
  getUpcomingFollowUps,
} from '@/features/marketing/api/supabase-queries';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const session = await getMarketingSession(request);

  const [kpis, pipeline, followUps, leaderboard] = await Promise.all([
    getMarketingKpis(client),
    getPipelineFunnel(client),
    getUpcomingFollowUps(client),
    getMarketerLeaderboard(client),
  ]);

  if (session?.role === 'MARKETER') {
    const now = new Date();
    const { data: myPerformance } = await client
      .from('marketing_performance')
      .select('*')
      .eq('marketer_id', session.marketerId)
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear())
      .maybeSingle();

    return NextResponse.json({
      kpis,
      pipeline,
      followUps: followUps.filter((f) => f.marketer?.id === session.marketerId),
      leaderboard: leaderboard.filter((row) => row.marketerId === session.marketerId),
      role: session.role,
      myPerformance: myPerformance ?? null,
    });
  }

  return NextResponse.json({ kpis, pipeline, followUps, leaderboard, role: session?.role ?? null, myPerformance: null });
}
