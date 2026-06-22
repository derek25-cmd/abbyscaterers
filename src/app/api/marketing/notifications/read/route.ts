import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();

  let query = client.from('marketing_notifications').update({ is_read: true });

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
