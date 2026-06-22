import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getCompanies } from '@/features/marketing/api/supabase-queries';
import { getMarketingSession } from '@/features/marketing/utils/auth';
import type { CompanyFilters, PipelineStage } from '@/features/marketing/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const session = await getMarketingSession(request);
  const params = request.nextUrl.searchParams;
  const stageParam = params.get('stage');

  const filters: CompanyFilters = {
    search: params.get('search') ?? undefined,
    stage: stageParam ? (stageParam.split(',') as PipelineStage[]) : undefined,
    regionId: params.get('regionId') ?? undefined,
    // A marketer only sees companies assigned to them — managers/admins see everything.
    assignedMarketerId: session?.role === 'MARKETER' ? session.marketerId : params.get('assignedMarketerId') ?? undefined,
    minLeadScore: params.has('minLeadScore') ? Number(params.get('minLeadScore')) : undefined,
    maxLeadScore: params.has('maxLeadScore') ? Number(params.get('maxLeadScore')) : undefined,
    industry: params.get('industry') ?? undefined,
    visitedFrom: params.get('visitedFrom') ?? undefined,
    visitedTo: params.get('visitedTo') ?? undefined,
    isClient: params.get('isClient') === 'true' ? true : undefined,
    page: params.has('page') ? Number(params.get('page')) : undefined,
    limit: params.has('limit') ? Number(params.get('limit')) : undefined,
    sort: params.get('sort') ?? undefined,
    order: (params.get('order') as 'asc' | 'desc') ?? undefined,
  };

  const result = await getCompanies(client, filters);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const qrCode = `ABBYS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const { data, error } = await client
    .from('companies')
    .insert([{
      name: body.name.trim(),
      industry: body.industry ?? null,
      business_size: body.businessSize ?? null,
      employee_count: body.employeeCount ?? null,
      address: body.address ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      region_id: body.regionId ?? null,
      contact_name: body.contactName ?? null,
      contact_position: body.contactPosition ?? null,
      contact_phone: body.contactPhone ?? null,
      contact_email: body.contactEmail ?? null,
      current_caterer: body.currentCaterer ?? null,
      current_caterer_notes: body.competitorNotes ?? null,
      assigned_marketer_id: body.assignedMarketerId ?? null,
      estimated_value: body.estimatedValue ?? null,
      qr_code: qrCode,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
