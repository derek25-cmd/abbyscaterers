import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const now = new Date();
  const month = Number(params.get('month') ?? now.getMonth() + 1);
  const year = Number(params.get('year') ?? now.getFullYear());

  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const { data, error } = await client
    .from('visits')
    .select('check_in_latitude, check_in_longitude')
    .gte('check_in_time', start)
    .lt('check_in_time', end)
    .not('check_in_latitude', 'is', null)
    .not('check_in_longitude', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const points = (data ?? []).map((v) => ({
    lat: v.check_in_latitude as number,
    lng: v.check_in_longitude as number,
    weight: 1,
  }));

  return NextResponse.json({ data: points });
}
