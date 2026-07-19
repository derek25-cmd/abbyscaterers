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
  const { data, error } = await client
    .from('marketing_users')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
