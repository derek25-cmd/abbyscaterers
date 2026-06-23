import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

/** Auto-compiles the calling marketer's visits for a given date (defaults
 * to today) into draft counts, and returns any report already submitted
 * for that date so the page can show "already submitted" instead of a
 * blank form. */
export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const client = getRouteClient(request.headers.get('authorization'));

  const [{ data: visits }, { data: existingReport }] = await Promise.all([
    client
      .from('visits')
      .select('id, interest_level, outcome, company:companies(id, name, pipeline_stage)')
      .eq('marketer_id', session.marketerId)
      .gte('check_in_time', dayStart)
      .lte('check_in_time', dayEnd)
      .order('check_in_time', { ascending: true }),
    client
      .from('marketer_daily_reports')
      .select('*')
      .eq('marketer_id', session.marketerId)
      .eq('report_date', date)
      .maybeSingle(),
  ]);

  const visitRows = visits ?? [];
  const prospectsCount = visitRows.filter((v) => v.interest_level === 'INTERESTED' || v.interest_level === 'VERY_INTERESTED').length;
  const quotationsRequestedCount = visitRows.filter((v) => (v.company as any)?.pipeline_stage === 'QUOTATION_REQUESTED').length;

  return NextResponse.json({
    date,
    visits: visitRows,
    visitsCount: visitRows.length,
    prospectsCount,
    quotationsRequestedCount,
    existingReport,
  });
}
