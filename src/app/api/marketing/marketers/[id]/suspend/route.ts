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
    return NextResponse.json({ success: false, error: 'Only managers or admins can suspend accounts' }, { status: 403 });
  }
  if (params.id === session.marketerId) {
    return NextResponse.json({ success: false, error: 'You cannot suspend your own account' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = (body.reason as string | undefined)?.trim();
  const internalNotes = (body.internalNotes as string | undefined)?.trim();
  const suspendedUntil = body.suspendedUntil as string | undefined;

  if (!reason || reason.length < 10) {
    return NextResponse.json({ success: false, error: 'Suspension reason required (min 10 characters)' }, { status: 400 });
  }
  if (!suspendedUntil) {
    return NextResponse.json({ success: false, error: 'Suspension end date is required' }, { status: 400 });
  }

  const until = new Date(suspendedUntil);
  if (Number.isNaN(until.getTime()) || until <= new Date()) {
    return NextResponse.json({ success: false, error: 'Suspension end date must be in the future' }, { status: 400 });
  }

  const maxUntil = new Date();
  maxUntil.setDate(maxUntil.getDate() + 90);
  if (until > maxUntil) {
    return NextResponse.json({ success: false, error: 'Suspension cannot exceed 90 days. Use Disable for longer periods.' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { error } = await client.rpc('suspend_marketer', {
    p_marketer_id: params.id,
    p_manager_id: session.marketerId,
    p_reason: reason,
    p_until: until.toISOString(),
    p_notes: internalNotes ?? null,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
