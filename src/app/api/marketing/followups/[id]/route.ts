import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));

  // A marketer can only edit their own follow-ups; managers/admins can edit anyone's.
  if (!isManager(session.role)) {
    const { data: followUp } = await client.from('follow_ups').select('assigned_to').eq('id', params.id).maybeSingle();
    if (!followUp) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }
    if (followUp.assigned_to !== session.marketerId) {
      return NextResponse.json({ error: 'You can only edit your own follow-ups' }, { status: 403 });
    }
  }

  const body = await request.json();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.dueDate !== undefined) update.due_date = body.dueDate;
  if (body.status !== undefined) update.status = body.status;
  if (body.notes !== undefined) update.notes = body.notes;

  const { data, error } = await client.from('follow_ups').update(update).eq('id', params.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
