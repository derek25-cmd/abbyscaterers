import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const session = await getMarketingSession(request);
  const status = request.nextUrl.searchParams.get('status');
  // A marketer can only see their own follow-ups — managers/admins see everything.
  const assignedTo = session?.role === 'MARKETER' ? session.marketerId : request.nextUrl.searchParams.get('assignedTo');

  const page  = Math.max(1, Number(request.nextUrl.searchParams.get('page')  ?? '1'));
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? '200')));
  const from  = (page - 1) * limit;

  let query = client
    .from('follow_ups')
    .select('*, company:companies(id, name), marketer:marketing_users(id, full_name)', { count: 'exact' })
    .order('due_date', { ascending: true })
    .range(from, from + limit - 1);

  if (status) query = query.eq('status', status);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);

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

  const { companyId, assignedTo, type, dueDate, notes, visitId } = body;
  if (!companyId || !assignedTo || !type || !dueDate) {
    return NextResponse.json(
      { error: 'companyId, assignedTo, type and dueDate are required' },
      { status: 400 }
    );
  }

  const { data, error } = await client
    .from('follow_ups')
    .insert([{
      company_id: companyId,
      visit_id: visitId ?? null,
      assigned_to: assignedTo,
      type,
      due_date: dueDate,
      notes: notes ?? null,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
