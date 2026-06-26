import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession } from '@/features/marketing/utils/auth';
import { calculateLeadScore } from '@/features/marketing/utils/lead-score';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const session = await getMarketingSession(request);
  const params = request.nextUrl.searchParams;
  const companyId = params.get('companyId');
  // A marketer can only see their own visits — managers/admins (and callers
  // not registered in marketing_users) see everything, unrestricted.
  const marketerId = session?.role === 'MARKETER' ? session.marketerId : params.get('marketerId');
  const date = params.get('date'); // YYYY-MM-DD — restricts to that single day's check-ins
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? '20')));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = client
    .from('visits')
    .select('*, company:companies(id, name, latitude, longitude, pipeline_stage), marketer:marketing_users(id, full_name)', { count: 'exact' })
    .order('check_in_time', { ascending: false })
    .range(from, to);

  if (companyId) query = query.eq('company_id', companyId);
  if (marketerId) query = query.eq('marketer_id', marketerId);
  if (date) {
    query = query.gte('check_in_time', `${date}T00:00:00.000Z`).lte('check_in_time', `${date}T23:59:59.999Z`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data, total: count ?? 0, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();

  const { companyId, marketerId } = body;
  if (!companyId || !marketerId) {
    return NextResponse.json({ error: 'companyId and marketerId are required' }, { status: 400 });
  }

  const checkInTime = body.checkInTime ?? new Date().toISOString();
  const leadScore = calculateLeadScore({
    interestLevel: body.interestLevel ?? null,
    decisionMakerMet: Boolean(body.decisionMakerMet),
    budgetConfirmed: Boolean(body.budgetConfirmed),
    followUpRequested: Boolean(body.followUpRequested),
    gpsVerified: Boolean(body.gpsVerified),
  });

  const { data: visit, error } = await client
    .from('visits')
    .insert([{
      company_id: companyId,
      marketer_id: marketerId,
      check_in_time: checkInTime,
      check_in_latitude: body.latitude ?? null,
      check_in_longitude: body.longitude ?? null,
      gps_verified: Boolean(body.gpsVerified),
      gps_accuracy_tag: body.gpsAccuracyTag ?? null,
      purpose: body.purpose ?? null,
      outcome: body.outcome ?? null,
      interest_level: body.interestLevel ?? null,
      decision_maker_met: Boolean(body.decisionMakerMet),
      budget_confirmed: Boolean(body.budgetConfirmed),
      follow_up_requested: Boolean(body.followUpRequested),
      services_presented: body.servicesPresented ?? [],
      notes: body.notes ?? null,
      lead_score: leadScore,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await client
    .from('companies')
    .update({
      last_visited_at: checkInTime,
      lead_score: leadScore,
      pipeline_stage: body.advanceToVisited ? 'VISITED' : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  return NextResponse.json({ data: visit, leadScore }, { status: 201 });
}
