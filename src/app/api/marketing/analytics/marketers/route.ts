import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketerLeaderboard } from '@/features/marketing/api/supabase-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const client = getRouteClient(request.headers.get('authorization'));
    const data = await getMarketerLeaderboard(client);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load marketer analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
