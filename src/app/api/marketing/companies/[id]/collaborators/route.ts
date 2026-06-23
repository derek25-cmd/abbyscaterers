import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const marketerCode = (body.marketerCode as string | undefined)?.trim().toUpperCase();
  if (!marketerCode) {
    return NextResponse.json({ error: 'marketerCode is required' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { data: company, error: companyError } = await client
    .from('companies')
    .select('id, assigned_marketer_id')
    .eq('id', params.id)
    .maybeSingle();

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  // Only the marketer who landed the company, or a manager, can add collaborators.
  const isOwner = company.assigned_marketer_id === session.marketerId;
  if (!isManager(session.role) && !isOwner) {
    return NextResponse.json({ error: 'Only the assigned marketer or a manager can add collaborators' }, { status: 403 });
  }

  const { data: marketer, error: marketerError } = await client
    .from('marketing_users')
    .select('id')
    .eq('marketer_code', marketerCode)
    .maybeSingle();

  if (marketerError || !marketer) {
    return NextResponse.json({ error: `No marketer found with ID "${marketerCode}"` }, { status: 404 });
  }
  const marketerId = marketer.id as string;

  if (marketerId === company.assigned_marketer_id) {
    return NextResponse.json({ error: 'This marketer already owns the company' }, { status: 400 });
  }

  const { data, error } = await client
    .from('company_collaborators')
    .insert([{ company_id: params.id, marketer_id: marketerId, added_by: session.marketerId }])
    .select('*, marketer:marketing_users(id, full_name, marketer_code)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This marketer is already a collaborator on this company' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
