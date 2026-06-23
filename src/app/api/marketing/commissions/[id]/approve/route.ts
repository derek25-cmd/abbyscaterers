import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'Only managers or admins can approve commissions' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { data: commission } = await client
    .from('marketer_commissions')
    .select('status')
    .eq('id', params.id)
    .maybeSingle();

  if (!commission) {
    return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
  }
  if (commission.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'This commission has already been reviewed' }, { status: 400 });
  }

  const { data, error } = await client
    .from('marketer_commissions')
    .update({ status: 'APPROVED', reviewed_by: session.marketerId, reviewed_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
