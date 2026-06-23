import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

/** Links a WON company to a real `clients` row once a manager approves it
 * for the clients database. Sets `landed_at` so commission rate stepping
 * (1% first month, 0.5% after) has a start date to measure from. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'Only managers or admins can approve a company for the clients database' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientId = (body.clientId as string | undefined)?.trim();
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));

  const { data: company } = await client
    .from('companies')
    .select('pipeline_stage, client_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
  if (company.pipeline_stage !== 'WON') {
    return NextResponse.json({ error: 'Only WON companies can be linked to a client record' }, { status: 400 });
  }
  if (company.client_id) {
    return NextResponse.json({ error: 'This company is already linked to a client' }, { status: 400 });
  }

  const { data, error } = await client
    .from('companies')
    .update({ client_id: clientId, landed_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
