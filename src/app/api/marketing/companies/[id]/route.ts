import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getCompanyDetail } from '@/features/marketing/api/supabase-queries';

export const dynamic = 'force-dynamic';

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  industry: 'industry',
  businessSize: 'business_size',
  employeeCount: 'employee_count',
  address: 'address',
  latitude: 'latitude',
  longitude: 'longitude',
  regionId: 'region_id',
  contactName: 'contact_name',
  contactPosition: 'contact_position',
  contactPhone: 'contact_phone',
  contactEmail: 'contact_email',
  currentCaterer: 'current_caterer',
  competitorNotes: 'current_caterer_notes',
  assignedMarketerId: 'assigned_marketer_id',
  estimatedValue: 'estimated_value',
  leadScore: 'lead_score',
  lastVisitedAt: 'last_visited_at',
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getRouteClient(request.headers.get('authorization'));
  const company = await getCompanyDetail(client, params.id);
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
  return NextResponse.json({ data: company });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) update[column] = body[key];
  }

  const { data, error } = await client.from('companies').update(update).eq('id', params.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getRouteClient(request.headers.get('authorization'));
  const { error } = await client
    .from('companies')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
