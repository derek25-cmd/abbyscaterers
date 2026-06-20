import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getSignedUrl, type UploadBucket } from '@/features/marketing/utils/upload';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const bucket = params.get('bucket') as UploadBucket | null;
  const path = params.get('path');

  if (!bucket || !path) {
    return NextResponse.json({ error: 'bucket and path are required' }, { status: 400 });
  }

  const url = await getSignedUrl(client, bucket, path);
  if (!url) {
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 404 });
  }
  return NextResponse.json({ url });
}
