import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMonthlyReportData } from '@/features/marketing/api/supabase-queries';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const session = await getMarketingSession(request);
  const params = request.nextUrl.searchParams;
  const now = new Date();
  const month = Number(params.get('month') ?? now.getMonth() + 1);
  const year = Number(params.get('year') ?? now.getFullYear());

  const data = await getMonthlyReportData(client, month, year);

  // A marketer only sees their own row in the team table and their own
  // assigned companies in the top-companies list — the rest of the report
  // (company-wide totals, pipeline, revenue by industry) stays as-is since
  // those are inherently business-wide figures, not owned by one marketer.
  if (session?.role === 'MARKETER') {
    data.teamPerformance = data.teamPerformance.filter((row) => row.marketerId === session.marketerId);
    data.topCompanies = data.topCompanies.filter((c) => c.assigned_marketer_id === session.marketerId);
  }

  return NextResponse.json({ data });
}
