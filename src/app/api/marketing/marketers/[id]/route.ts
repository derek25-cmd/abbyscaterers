import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

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
