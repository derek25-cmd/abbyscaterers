import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const status = params.get('status');

  let query = client
    .from('marketer_commissions')
    .select('*, company:companies(id, name), marketer:marketing_users!marketer_commissions_marketer_id_fkey(id, full_name)')
    .order('created_at', { ascending: false });

  // A marketer only sees their own commissions — managers/admins see everyone's.
  query = isManager(session.role) ? query : query.eq('marketer_id', session.marketerId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
