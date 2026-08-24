import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ success: false, error: 'Only managers or admins can restrict accounts' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = (body.reason as string | undefined)?.trim();
  const internalNotes = (body.internalNotes as string | undefined)?.trim();

  if (!reason || reason.length < 10) {
    return NextResponse.json({ success: false, error: 'Restriction reason required (min 10 characters)' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { error } = await client.rpc('restrict_marketer', {
    p_marketer_id: params.id,
    p_manager_id: session.marketerId,
    p_reason: reason,
    p_notes: internalNotes ?? null,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ success: false, error: 'Only managers or admins can lift restrictions' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const notes = (body.notes as string | undefined)?.trim();

  const client = getRouteClient(request.headers.get('authorization'));
  const { error } = await client.rpc('lift_restriction', {
    p_marketer_id: params.id,
    p_manager_id: session.marketerId,
    p_notes: notes ?? null,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
