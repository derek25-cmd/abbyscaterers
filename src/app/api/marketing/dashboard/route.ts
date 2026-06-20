import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import {
  getMarketerLeaderboard,
  getMarketingKpis,
  getPipelineFunnel,
  getUpcomingFollowUps,
} from '@/features/marketing/api/supabase-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));

  const [kpis, pipeline, followUps, leaderboard] = await Promise.all([
    getMarketingKpis(client),
    getPipelineFunnel(client),
    getUpcomingFollowUps(client),
    getMarketerLeaderboard(client),
  ]);

  return NextResponse.json({ kpis, pipeline, followUps, leaderboard });
}
