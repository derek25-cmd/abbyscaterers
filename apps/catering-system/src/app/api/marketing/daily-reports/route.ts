import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const requestedMarketerId = params.get('marketerId');
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  const limit = Number(params.get('limit') ?? 30);

  // A marketer only sees their own daily reports — managers/admins can browse anyone's.
  const marketerId = isManager(session.role) ? requestedMarketerId ?? undefined : session.marketerId;

  let query = client
    .from('marketer_daily_reports')
    .select('*, marketer:marketing_users(id, full_name)')
    .order('report_date', { ascending: false })
    .limit(limit);

  if (marketerId) query = query.eq('marketer_id', marketerId);
  if (dateFrom) query = query.gte('report_date', dateFrom);
  if (dateTo) query = query.lte('report_date', dateTo);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reportDate = (body.reportDate as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const narrative = (body.narrative as string | undefined)?.trim();

  if (!narrative || narrative.length < 10) {
    return NextResponse.json({ error: 'Narrative must be at least 10 characters' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const dayStart = `${reportDate}T00:00:00.000Z`;
  const dayEnd = `${reportDate}T23:59:59.999Z`;

  const { data: visits } = await client
    .from('visits')
    .select('id, interest_level, company:companies(pipeline_stage)')
    .eq('marketer_id', session.marketerId)
    .gte('check_in_time', dayStart)
    .lte('check_in_time', dayEnd);

  const visitRows = visits ?? [];
  const prospectsCount = visitRows.filter((v) => v.interest_level === 'INTERESTED' || v.interest_level === 'VERY_INTERESTED').length;
  const quotationsRequestedCount = visitRows.filter((v) => (v.company as any)?.pipeline_stage === 'QUOTATION_REQUESTED').length;

  const { data, error } = await client
    .from('marketer_daily_reports')
    .upsert(
      {
        marketer_id: session.marketerId,
        report_date: reportDate,
        narrative,
        visits_count: visitRows.length,
        prospects_count: prospectsCount,
        quotations_requested_count: quotationsRequestedCount,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'marketer_id,report_date' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
