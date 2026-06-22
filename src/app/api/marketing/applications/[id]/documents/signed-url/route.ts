import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';

const ALLOWED_BUCKETS = new Set(['marketer-documents', 'marketer-avatars']);

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const path = params.get('path');
  const bucket = params.get('bucket') ?? 'marketer-documents';

  if (!path || !ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ success: false, error: 'path and a valid bucket are required' }, { status: 400 });
  }

  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 3600);

  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Could not generate signed URL' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { url: data.signedUrl } });
}
