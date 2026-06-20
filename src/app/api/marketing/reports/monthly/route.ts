import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMonthlyReportData } from '@/features/marketing/api/supabase-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const params = request.nextUrl.searchParams;
  const now = new Date();
  const month = Number(params.get('month') ?? now.getMonth() + 1);
  const year = Number(params.get('year') ?? now.getFullYear());

  const data = await getMonthlyReportData(client, month, year);
  return NextResponse.json({ data });
}
