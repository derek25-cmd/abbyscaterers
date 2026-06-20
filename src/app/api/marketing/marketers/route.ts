import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketerPerformance } from '@/features/marketing/api/supabase-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const now = new Date();
  const month = Number(params.get('month') ?? now.getMonth() + 1);
  const year = Number(params.get('year') ?? now.getFullYear());

  const data = await getMarketerPerformance(client, month, year);
  return NextResponse.json({ data, month, year });
}

export async function POST(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();

  if (!body.fullName || !body.email) {
    return NextResponse.json({ error: 'fullName and email are required' }, { status: 400 });
  }

  const { data, error } = await client
    .from('marketing_users')
    .insert([{
      full_name: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      role: body.role ?? 'MARKETER',
      region_id: body.regionId ?? null,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
