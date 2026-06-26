import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';
import { notifyTargetSet } from '@/features/marketing/utils/targets';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'Only managers or admins can edit targets' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.startDate) updates.start_date = body.startDate;
  if (body.endDate) updates.end_date = body.endDate;
  if (body.metrics) updates.metrics = body.metrics;
  if (body.notes !== undefined) updates.notes = body.notes;

  const client = getRouteClient(request.headers.get('authorization'));
  const { data, error } = await client
    .from('marketing_targets')
    .update(updates)
    .eq('id', params.id)
    .select('*, marketer:marketing_users!marketing_targets_marketer_id_fkey(id, full_name)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.metrics || body.startDate || body.endDate) {
    try {
      await notifyTargetSet(client, data);
    } catch (notifyError) {
      console.error('[targets] TARGET_SET notification failed:', notifyError);
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'Only managers or admins can delete targets' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { error } = await client.from('marketing_targets').delete().eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
