import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role) && session.marketerId !== params.id) {
    return NextResponse.json({ success: false, error: 'You can only view your own account history' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));

  const { data, error } = await client
    .from('marketer_account_actions')
    .select('*, performed_by_user:marketing_users!performed_by(id, full_name, role)')
    .eq('marketer_id', params.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
