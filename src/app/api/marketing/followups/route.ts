import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const status = request.nextUrl.searchParams.get('status');
  const assignedTo = request.nextUrl.searchParams.get('assignedTo');

  let query = client
    .from('follow_ups')
    .select('*, company:companies(id, name), marketer:marketing_users(id, full_name)')
    .order('due_date', { ascending: true });

  if (status) query = query.eq('status', status);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
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
