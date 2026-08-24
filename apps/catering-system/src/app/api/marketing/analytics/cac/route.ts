import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession } from '@/features/marketing/utils/auth';

export const dynamic = 'force-dynamic';

async function getNewClientsCount(client: ReturnType<typeof getRouteClient>, month: number, year: number): Promise<number> {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();
  const { count } = await client
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .eq('pipeline_stage', 'WON')
    .gte('client_since', start)
    .lt('client_since', end);
  return count ?? 0;
}

async function getExpenses(client: ReturnType<typeof getRouteClient>, month: number, year: number): Promise<number | null> {
  const { data } = await client
    .from('marketing_monthly_expenses')
    .select('total_expenses')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();
  return data ? Number(data.total_expenses) : null;
}

export async function GET(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  const client = getRouteClient(request.headers.get('authorization'));
  const now = new Date();
  const month = Number(request.nextUrl.searchParams.get('month') ?? now.getMonth() + 1);
  const year = Number(request.nextUrl.searchParams.get('year') ?? now.getFullYear());

  const prevRef = new Date(year, month - 2, 1);

  const [newClients, totalExpenses, prevExpenses, prevNewClients] = await Promise.all([
    getNewClientsCount(client, month, year),
    getExpenses(client, month, year),
    getExpenses(client, prevRef.getMonth() + 1, prevRef.getFullYear()),
    getNewClientsCount(client, prevRef.getMonth() + 1, prevRef.getFullYear()),
  ]);

  const cac = totalExpenses != null && newClients > 0 ? Math.round(totalExpenses / newClients) : null;
  const previousMonthCAC = prevExpenses != null && prevNewClients > 0 ? Math.round(prevExpenses / prevNewClients) : null;

  return NextResponse.json({ data: { newClients, totalExpenses, cac, previousMonthCAC } });
}

export async function POST(request: NextRequest) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }
  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();
  const { month, year, totalExpenses, notes } = body;

  if (!month || !year || typeof totalExpenses !== 'number') {
    return NextResponse.json({ error: 'month, year and totalExpenses are required' }, { status: 400 });
  }

  const { error } = await client
    .from('marketing_monthly_expenses')
    .upsert([{ month, year, total_expenses: totalExpenses, notes: notes ?? null, updated_at: new Date().toISOString() }], { onConflict: 'month,year' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
