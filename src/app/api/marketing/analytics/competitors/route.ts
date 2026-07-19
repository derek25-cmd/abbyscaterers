import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import type { CompetitorRow } from '@/features/marketing/types';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  const client = getRouteClient(request.headers.get('authorization'));

  const { data: companies, error } = await client
    .from('companies')
    .select('id, current_caterer, industry, estimated_value, lead_score')
    .eq('is_active', true)
    .not('current_caterer', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const companyIds = (companies ?? []).map((c) => c.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const recentVisitsByCompany = new Map<string, number>();
  if (companyIds.length > 0) {
    const { data: visits } = await client
      .from('visits')
      .select('company_id')
      .in('company_id', companyIds)
      .gte('check_in_time', thirtyDaysAgo);

    for (const visit of visits ?? []) {
      recentVisitsByCompany.set(visit.company_id, (recentVisitsByCompany.get(visit.company_id) ?? 0) + 1);
    }
  }

  const byCompetitor = new Map<string, CompetitorRow>();
  for (const company of companies ?? []) {
    const name = company.current_caterer!.trim();
    if (!name) continue;
    const entry: CompetitorRow = byCompetitor.get(name) ?? {
      name,
      companyCount: 0,
      totalEstimatedValue: 0,
      avgLeadScore: 0,
      industries: [] as string[],
      recentlyMentioned: 0,
    };
    entry.companyCount += 1;
    entry.totalEstimatedValue += Number(company.estimated_value) || 0;
    entry.avgLeadScore += company.lead_score ?? 0;
    if (company.industry && !entry.industries.includes(company.industry)) entry.industries.push(company.industry);
    entry.recentlyMentioned += recentVisitsByCompany.get(company.id) ?? 0;
    byCompetitor.set(name, entry);
  }

  const competitors: CompetitorRow[] = Array.from(byCompetitor.values())
    .map((c) => ({ ...c, avgLeadScore: c.companyCount ? Math.round(c.avgLeadScore / c.companyCount) : 0 }))
    .sort((a, b) => b.totalEstimatedValue - a.totalEstimatedValue);

  return NextResponse.json({ data: competitors });
}
