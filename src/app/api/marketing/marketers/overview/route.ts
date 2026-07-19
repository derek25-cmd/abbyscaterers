import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ success: false, error: 'Only managers or admins can view marketer account overview' }, { status: 403 });
  }
  const client = getRouteClient(request.headers.get('authorization'));

  const { data, error } = await client.from('marketer_account_overview').select('*');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
