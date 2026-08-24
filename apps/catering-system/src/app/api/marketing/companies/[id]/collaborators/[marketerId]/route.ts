import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession, isManager } from '@/features/marketing/utils/auth';
import { resyncCommissionsForCompany } from '@/features/marketing/utils/commission';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; marketerId: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
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

  const isOwner = company.assigned_marketer_id === session.marketerId;
  if (!isManager(session.role) && !isOwner) {
    return NextResponse.json({ error: 'Only the assigned marketer or a manager can remove collaborators' }, { status: 403 });
  }

  const { error } = await client
    .from('company_collaborators')
    .delete()
    .eq('company_id', params.id)
    .eq('marketer_id', params.marketerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  resyncCommissionsForCompany(params.id).catch((err) => console.error('Error resyncing commissions after collaborator removal:', err));

  return NextResponse.json({ success: true });
}
