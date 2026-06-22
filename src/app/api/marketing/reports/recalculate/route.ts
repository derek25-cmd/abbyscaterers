import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

// Lets a logged-in manager trigger the same aggregation the nightly cron runs,
// without ever exposing CRON_SECRET to the browser (that secret is reserved
// for the scheduler-only /api/cron/marketing-performance route).
export async function POST(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const { error } = await client.rpc('aggregate_marketing_performance');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}
