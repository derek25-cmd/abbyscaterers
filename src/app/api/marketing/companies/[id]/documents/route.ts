import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import type { DocumentRow } from '@/features/marketing/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getRouteClient(request.headers.get('authorization'));

  const [companyDocsRes, visitsRes] = await Promise.all([
    client.from('company_documents').select('*').eq('company_id', params.id),
    client.from('visits').select('id').eq('company_id', params.id),
  ]);

  const visitIds = (visitsRes.data ?? []).map((v) => v.id);
  const visitDocsRes = visitIds.length
    ? await client.from('visit_documents').select('*').in('visit_id', visitIds)
    : { data: [] as any[] };

  const companyDocs: DocumentRow[] = (companyDocsRes.data ?? []).map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    path: doc.url,
    bucket: 'company-documents',
    uploadedBy: doc.uploaded_by,
    createdAt: doc.created_at,
  }));

  const visitDocs: DocumentRow[] = (visitDocsRes.data ?? []).map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    path: doc.url,
    bucket: doc.type === 'VOICE_NOTE' ? 'voice-notes' : 'visit-photos',
    uploadedBy: doc.uploaded_by,
    createdAt: doc.created_at,
  }));

  const data = [...companyDocs, ...visitDocs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ data });
}
