import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getRouteClient(request.headers.get('authorization'));

  const [marketerRes, documentsRes, logRes] = await Promise.all([
    client.from('marketing_users').select('*, region:regions(id, name)').eq('id', params.id).maybeSingle(),
    client.from('marketer_documents').select('*').eq('marketer_id', params.id).order('uploaded_at', { ascending: false }),
    client.from('marketer_approval_log').select('*').eq('marketer_id', params.id).order('created_at', { ascending: false }),
  ]);

  if (marketerRes.error || !marketerRes.data) {
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      marketer: marketerRes.data,
      documents: documentsRes.data ?? [],
      auditLog: logRes.data ?? [],
    },
  });
}
