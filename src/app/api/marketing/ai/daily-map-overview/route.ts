import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { generateDailyMapOverview, type DailyMapOverviewMarketerInput } from '@/features/marketing/utils/ai';
import { getMarketingSession } from '@/features/marketing/utils/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be a registered marketing user' }, { status: 403 });
  }
  const { allowed } = await checkRateLimit('ai', session.marketerId);
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Too many AI requests. Please wait a moment and try again.' }, { status: 429 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI features not configured. Add ANTHROPIC_API_KEY to environment variables.' },
      { status: 503 }
    );
  }

  const client = getRouteClient(request.headers.get('authorization'));

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const dateLabel = dayStart.toISOString().slice(0, 10);

  const { data: visits, error } = await client
    .from('visits')
    .select('id, company_id, check_in_time, check_out_time, gps_verified, marketer_id, marketer:marketing_users(id, full_name), company:companies(name)')
    .gte('check_in_time', dayStart.toISOString())
    .lte('check_in_time', dayEnd.toISOString())
    .order('check_in_time', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const byMarketer = new Map<string, { marketerId: string; marketerName: string; stops: any[] }>();
  for (const visit of visits ?? []) {
    const marketerId = (visit as any).marketer?.id ?? visit.marketer_id;
    const marketerName = (visit as any).marketer?.full_name ?? 'Unknown';
    if (!byMarketer.has(marketerId)) byMarketer.set(marketerId, { marketerId, marketerName, stops: [] });

    const checkIn = visit.check_in_time ? new Date(visit.check_in_time) : null;
    const checkOut = visit.check_out_time ? new Date(visit.check_out_time) : null;
    const durationMinutes = checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : null;

    byMarketer.get(marketerId)!.stops.push({
      companyId: visit.company_id,
      companyName: (visit as any).company?.name ?? 'Unknown',
      checkInTime: visit.check_in_time,
      checkOutTime: visit.check_out_time,
      durationMinutes,
      gpsVerified: visit.gps_verified,
    });
  }

  const marketers = Array.from(byMarketer.values());

  if (marketers.length === 0) {
    return NextResponse.json({
      success: true,
      data: { date: dateLabel, narrative: 'No field visits have been logged yet today.', marketers: [] },
    });
  }

  const aiInput: DailyMapOverviewMarketerInput[] = marketers.map((m) => ({
    marketerName: m.marketerName,
    stops: m.stops.map((s) => ({
      companyName: s.companyName,
      checkInTime: s.checkInTime,
      checkOutTime: s.checkOutTime,
      durationMinutes: s.durationMinutes,
    })),
  }));

  try {
    const narrative = await generateDailyMapOverview(dateLabel, aiInput);
    return NextResponse.json({ success: true, data: { date: dateLabel, narrative, marketers } });
  } catch (err) {
    console.error('[ai/daily-map-overview] Claude API error:', err);
    return NextResponse.json({ success: false, error: 'AI service unavailable. Please try again.' }, { status: 500 });
  }
}
