import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getSignedUrl, type UploadBucket } from '@/features/marketing/utils/upload';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_BUCKETS = new Set<UploadBucket>(['visit-photos', 'voice-notes', 'company-documents']);

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const bucket = params.get('bucket') as UploadBucket | null;
  const path = params.get('path');

  if (!bucket || !path || !ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'A valid bucket and path are required' }, { status: 400 });
  }

  const url = await getSignedUrl(client, bucket, path);
  if (!url) {
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 404 });
  }
  return NextResponse.json({ url });
}
