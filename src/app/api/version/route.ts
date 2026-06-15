import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  // In development there is no stable build ID — return a constant so
  // the client never triggers a false "update available" notification.
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({ buildId: 'dev' });
  }

  try {
    const buildId = fs
      .readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf-8')
      .trim();
    return NextResponse.json({ buildId });
  } catch {
    return NextResponse.json({ buildId: 'unknown' });
  }
}
