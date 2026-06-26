import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

const FIELD_MAP: Record<string, string> = {
  fullName: 'full_name',
  phone: 'phone',
  role: 'role',
  regionId: 'region_id',
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getRouteClient(request.headers.get('authorization'));
  const [marketerRes, visitsRes, companiesRes, performanceRes] = await Promise.all([
    client.from('marketing_users').select('*, region:regions(id, name)').eq('id', params.id).maybeSingle(),
    client.from('visits').select('*, company:companies(id, name)').eq('marketer_id', params.id).order('check_in_time', { ascending: false }),
    client.from('companies').select('*').eq('assigned_marketer_id', params.id),
    client.from('marketing_performance').select('*').eq('marketer_id', params.id).order('year', { ascending: false }).order('month', { ascending: false }),
  ]);

  if (!marketerRes.data) {
    return NextResponse.json({ error: 'Marketer not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...marketerRes.data,
      visits: visitsRes.data ?? [],
      companies: companiesRes.data ?? [],
      performanceHistory: performanceRes.data ?? [],
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'Only managers or admins can edit a marketer profile' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) update[column] = body[key];
  }

  const { data, error } = await client.from('marketing_users').update(update).eq('id', params.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
