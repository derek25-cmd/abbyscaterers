import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [marketersRes, regionsRes, companiesRes, visitsTodayRes] = await Promise.all([
    client.from('marketer_live_locations').select('*'),
    client.from('regions').select('id, name'),
    client.from('companies').select('id, region_id').eq('is_active', true).not('assigned_marketer_id', 'is', null),
    client
      .from('visits')
      .select('id, company_id, check_in_time, gps_verified, marketer:marketing_users(full_name), company:companies(name, region_id)')
      .gte('check_in_time', todayStart.toISOString())
      .order('check_in_time', { ascending: false })
      .limit(15),
  ]);

  if (marketersRes.error || regionsRes.error || companiesRes.error || visitsTodayRes.error) {
    const error = marketersRes.error ?? regionsRes.error ?? companiesRes.error ?? visitsTodayRes.error;
    return NextResponse.json({ error: error?.message ?? 'Failed to load live data' }, { status: 500 });
  }

  const assignedByRegion = new Map<string, Set<string>>();
  for (const company of companiesRes.data ?? []) {
    if (!company.region_id) continue;
    if (!assignedByRegion.has(company.region_id)) assignedByRegion.set(company.region_id, new Set());
    assignedByRegion.get(company.region_id)!.add(company.id);
  }

  const visitedTodayByRegion = new Map<string, Set<string>>();
  for (const visit of visitsTodayRes.data ?? []) {
    const regionId = (visit as any).company?.region_id;
    if (!regionId) continue;
    if (!visitedTodayByRegion.has(regionId)) visitedTodayByRegion.set(regionId, new Set());
    visitedTodayByRegion.get(regionId)!.add(visit.company_id);
  }

  const territoryCoverage = (regionsRes.data ?? []).map((region) => {
    const assigned = assignedByRegion.get(region.id)?.size ?? 0;
    const visited = visitedTodayByRegion.get(region.id)?.size ?? 0;
    const coveragePercent = assigned > 0 ? Math.round((visited / assigned) * 100) : 0;
    return { regionId: region.id, regionName: region.name, assigned, visitedToday: visited, coveragePercent };
  });

  const todaysActivity = (visitsTodayRes.data ?? []).map((visit) => ({
    id: visit.id,
    marketerName: (visit as any).marketer?.full_name ?? 'Unknown',
    companyName: (visit as any).company?.name ?? 'Unknown',
    checkInTime: visit.check_in_time,
    gpsVerified: visit.gps_verified,
  }));

  return NextResponse.json({
    data: {
      marketers: marketersRes.data ?? [],
      todaysActivity,
      territoryCoverage,
    },
  });
}
