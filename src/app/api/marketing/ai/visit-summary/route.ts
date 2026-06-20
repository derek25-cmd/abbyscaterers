import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { generateVisitSummary } from '@/features/marketing/utils/ai';
import { titleCase } from '@/features/marketing/utils/format';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI features not configured. Add ANTHROPIC_API_KEY to environment variables.' },
      { status: 503 }
    );
  }

  const { visitId } = await request.json();
  if (!visitId) {
    return NextResponse.json({ success: false, error: 'visitId is required' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const { data: visit, error } = await client
    .from('visits')
    .select('*, company:companies(name), marketer:marketing_users(full_name)')
    .eq('id', visitId)
    .maybeSingle();

  if (error || !visit) {
    return NextResponse.json({ success: false, error: 'Visit not found' }, { status: 404 });
  }

  try {
    const summary = await generateVisitSummary({
      companyName: (visit as any).company?.name ?? 'Unknown company',
      visitDate: visit.check_in_time ?? visit.created_at,
      marketerName: (visit as any).marketer?.full_name ?? 'Unknown marketer',
      purpose: visit.purpose ? titleCase(visit.purpose) : 'Not specified',
      notes: visit.notes ?? '',
      interestLevel: visit.interest_level ? titleCase(visit.interest_level) : 'Not recorded',
      decisionMakerMet: Boolean(visit.decision_maker_met),
      budgetConfirmed: Boolean(visit.budget_confirmed),
      servicesPresented: visit.services_presented ?? [],
      outcome: visit.outcome ? titleCase(visit.outcome) : 'Not recorded',
      leadScore: visit.lead_score ?? 0,
    });

    if (!visit.notes) {
      await client.from('visits').update({ notes: summary }).eq('id', visitId);
    }

    return NextResponse.json({ success: true, data: { summary } });
  } catch (err) {
    console.error('[ai/visit-summary] Claude API error:', err);
    return NextResponse.json({ success: false, error: 'AI service unavailable. Please try again.' }, { status: 500 });
  }
}
