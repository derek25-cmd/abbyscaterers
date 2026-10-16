import { NextResponse } from 'next/server';

// Digital Asset Links for the Android Trusted Web Activity build. Read at
// request time so the fingerprint can be set per environment without a
// rebuild. Unset or invalid -> [] (the TWA then shows the browser bar).
export const dynamic = 'force-dynamic';

export function GET() {
  const raw = process.env.ANDROID_ASSETLINKS_JSON?.trim();
  let body: unknown = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) body = parsed;
      else console.error('ANDROID_ASSETLINKS_JSON must be a JSON array; serving [].');
    } catch {
      console.error('ANDROID_ASSETLINKS_JSON is not valid JSON; serving [].');
    }
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
