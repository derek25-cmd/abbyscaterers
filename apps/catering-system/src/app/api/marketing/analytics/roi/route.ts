import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  const client = getRouteClient(request.headers.get('authorization'));
  const now = new Date();
  const month = Number(request.nextUrl.searchParams.get('month') ?? now.getMonth() + 1);
  const year = Number(request.nextUrl.searchParams.get('year') ?? now.getFullYear());

  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const [wonRes, expensesRes] = await Promise.all([
    client.from('companies').select('estimated_value').eq('pipeline_stage', 'WON').gte('client_since', start).lt('client_since', end),
    client.from('marketing_monthly_expenses').select('total_expenses').eq('month', month).eq('year', year).maybeSingle(),
  ]);

  const revenueGenerated = (wonRes.data ?? []).reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0);
  const marketingExpenses = expensesRes.data ? Number(expensesRes.data.total_expenses) : null;

  const roiPercent = marketingExpenses && marketingExpenses > 0
    ? Math.round(((revenueGenerated - marketingExpenses) / marketingExpenses) * 100)
    : null;

  // estimated_value already represents recurring monthly revenue, so dividing by 12
  // here converts it to an annualised baseline before computing payback in months.
  const paybackMonths = marketingExpenses && revenueGenerated > 0
    ? Math.round((marketingExpenses / (revenueGenerated / 12)) * 10) / 10
    : null;

  return NextResponse.json({ data: { revenueGenerated, marketingExpenses, roiPercent, paybackMonths } });
}
