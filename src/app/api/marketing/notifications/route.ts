import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const includeAll = request.nextUrl.searchParams.get('all') === 'true';

  let query = client
    .from('marketing_notifications')
    .select('*, company:companies(name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!includeAll) query = query.eq('is_read', false);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    companyId: n.company_id,
    companyName: (n as any).company?.name,
    marketerId: n.marketer_id,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));

  return NextResponse.json({ data: notifications });
}
