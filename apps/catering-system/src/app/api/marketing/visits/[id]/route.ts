import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

const FIELD_MAP: Record<string, string> = {
  purpose: 'purpose',
  outcome: 'outcome',
  interestLevel: 'interest_level',
  decisionMakerMet: 'decision_maker_met',
  budgetConfirmed: 'budget_confirmed',
  followUpRequested: 'follow_up_requested',
  servicesPresented: 'services_presented',
  notes: 'notes',
  checkOutTime: 'check_out_time',
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  const client = getRouteClient(request.headers.get('authorization'));
  const { data, error } = await client
    .from('visits')
    .select('*, company:companies(id, name), marketer:marketing_users(id, full_name)')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));

  // A marketer can correct their own visit; managers/admins can correct anyone's.
  if (!isManager(session.role)) {
    const { data: visit } = await client.from('visits').select('marketer_id').eq('id', params.id).maybeSingle();
    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
    if (visit.marketer_id !== session.marketerId) {
      return NextResponse.json({ error: 'You can only edit your own visits' }, { status: 403 });
    }
  }

  const body = await request.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) update[column] = body[key];
  }

  const { data, error } = await client.from('visits').update(update).eq('id', params.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'Only managers or admins can delete a visit' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { error } = await client.from('visits').delete().eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
