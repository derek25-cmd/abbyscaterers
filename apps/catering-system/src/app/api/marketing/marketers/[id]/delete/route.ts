import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ success: false, error: 'Only managers or admins can delete accounts' }, { status: 403 });
  }
  if (params.id === session.marketerId) {
    return NextResponse.json({ success: false, error: 'You cannot delete your own account' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = (body.reason as string | undefined)?.trim();
  const internalNotes = (body.internalNotes as string | undefined)?.trim();
  const confirmName = (body.confirmName as string | undefined)?.trim();

  if (!reason || reason.length < 20) {
    return NextResponse.json({ success: false, error: 'Deletion reason must be at least 20 characters' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));

  const { data: marketer } = await client
    .from('marketing_users')
    .select('full_name, approval_status')
    .eq('id', params.id)
    .single();

  if (!marketer) {
    return NextResponse.json({ success: false, error: 'Marketer not found' }, { status: 404 });
  }
  if (marketer.approval_status === 'DELETED') {
    return NextResponse.json({ success: false, error: 'Account is already deleted' }, { status: 400 });
  }
  if (!confirmName || confirmName.toLowerCase() !== marketer.full_name?.toLowerCase()) {
    return NextResponse.json(
      { success: false, error: "Name confirmation does not match. Type the marketer's full name exactly." },
      { status: 400 }
    );
  }

  const { data, error } = await client.rpc('delete_marketer', {
    p_marketer_id: params.id,
    p_manager_id: session.marketerId,
    p_reason: reason,
    p_notes: internalNotes ?? null,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const warnings: string[] = [];
  const authUserId = data?.auth_user_id as string | null;

  if (authUserId) {
    try {
      const adminClient = getAdminClient();
      const { error: authError } = await adminClient.auth.admin.deleteUser(authUserId);
      if (authError) warnings.push(`Account deleted, but the Auth login could not be revoked: ${authError.message}`);
    } catch {
      warnings.push('Account deleted, but SUPABASE_SERVICE_ROLE_KEY is not configured — the Auth login was not revoked, so this person may still be able to sign in.');
    }
  }

  return NextResponse.json({ success: true, warnings: warnings.length > 0 ? warnings : undefined });
}
