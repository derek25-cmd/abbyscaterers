import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const CONFIRM_PHRASE = 'PERMANENTLY DELETE';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be a registered marketing user' }, { status: 403 });
  }
  if (!isManager(session.role)) {
    return NextResponse.json({ success: false, error: 'Only managers or admins can permanently delete accounts' }, { status: 403 });
  }

  let adminClient: ReturnType<typeof getAdminClient>;
  try {
    adminClient = getAdminClient();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Server is not configured with SUPABASE_SERVICE_ROLE_KEY — add it to the environment before permanent deletion can run' },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const reason = (body.reason as string | undefined)?.trim();
  const confirmPhrase = (body.confirmPhrase as string | undefined)?.trim();

  if (!reason || reason.length < 20) {
    return NextResponse.json({ success: false, error: 'Deletion reason must be at least 20 characters' }, { status: 400 });
  }
  if (confirmPhrase !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { success: false, error: `Type "${CONFIRM_PHRASE}" exactly to confirm.` },
      { status: 400 }
    );
  }

  const client = getRouteClient(request.headers.get('authorization'));

  const { data: marketer } = await client
    .from('marketing_users')
    .select('role, approval_status')
    .eq('id', params.id)
    .single();

  if (!marketer) {
    return NextResponse.json({ success: false, error: 'Marketer not found' }, { status: 404 });
  }
  if (marketer.role !== 'MARKETER') {
    return NextResponse.json({ success: false, error: 'Only MARKETER accounts can be permanently deleted through this action' }, { status: 400 });
  }
  if (marketer.approval_status !== 'DELETED') {
    return NextResponse.json({ success: false, error: 'Delete the account first; it must be soft-deleted before it can be permanently purged' }, { status: 400 });
  }

  const { data, error } = await client.rpc('permanently_delete_marketer', {
    p_marketer_id: params.id,
    p_manager_id: session.marketerId,
    p_reason: reason,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const warnings: string[] = [];
  const authUserId = data?.auth_user_id as string | null;
  const profilePhotoPath = data?.profile_photo_path as string | null;
  const documentPaths = (data?.document_storage_paths as string[] | null) ?? [];

  if (authUserId) {
    const { error: authError } = await adminClient.auth.admin.deleteUser(authUserId);
    if (authError) warnings.push(`Could not delete auth login: ${authError.message}`);
  }

  if (documentPaths.length > 0) {
    const { error: docsError } = await adminClient.storage.from('marketer-documents').remove(documentPaths);
    if (docsError) warnings.push(`Could not delete some documents from storage: ${docsError.message}`);
  }

  if (profilePhotoPath) {
    const { error: avatarError } = await adminClient.storage.from('marketer-avatars').remove([profilePhotoPath]);
    if (avatarError) warnings.push(`Could not delete profile photo from storage: ${avatarError.message}`);
  }

  return NextResponse.json({ success: true, warnings: warnings.length > 0 ? warnings : undefined });
}
