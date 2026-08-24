import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();

  let query = client.from('marketing_notifications').update({ is_read: true });

  // A marketer can only mark their own notifications read; managers/admins can mark anyone's.
  if (!isManager(session.role)) query = query.eq('marketer_id', session.marketerId);

  if (body.all) {
    query = query.eq('is_read', false);
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    query = query.in('id', body.ids);
  } else {
    return NextResponse.json({ error: 'ids or all is required' }, { status: 400 });
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
