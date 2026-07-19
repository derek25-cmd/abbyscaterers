import { differenceInDays } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { analyseLeadAndRecommend } from '@/features/marketing/utils/ai';
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

  const { companyId } = await request.json();
  if (!companyId) {
    return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400 });
  }

  const client = getRouteClient(request.headers.get('authorization'));

  const [companyRes, visitsRes, followUpsRes] = await Promise.all([
    client.from('companies').select('*').eq('id', companyId).maybeSingle(),
    client.from('visits').select('notes, check_in_time').eq('company_id', companyId).order('check_in_time', { ascending: false }),
    client.from('follow_ups').select('status').eq('company_id', companyId),
  ]);

  if (companyRes.error || !companyRes.data) {
    return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
  }

  const company = companyRes.data;
  const visits = visitsRes.data ?? [];
  const followUps = followUpsRes.data ?? [];

  const lastVisitDaysAgo = company.last_visited_at
    ? Math.max(0, differenceInDays(new Date(), new Date(company.last_visited_at)))
    : -1;

  try {
    const result = await analyseLeadAndRecommend({
      companyName: company.name,
      industry: company.industry ?? 'Unknown',
      employeeCount: company.employee_count ?? undefined,
      estimatedValue: company.estimated_value ?? undefined,
      pipelineStage: company.pipeline_stage,
      leadScore: company.lead_score,
      visitCount: visits.length,
      lastVisitDaysAgo,
      followUpsCompleted: followUps.filter((f) => f.status === 'DONE').length,
      followUpsMissed: followUps.filter((f) => f.status === 'OVERDUE' || f.status === 'CANCELLED').length,
      visitSummaries: visits.slice(0, 3).map((v) => v.notes ?? '(no notes)'),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[ai/lead-analysis] Claude API error:', err);
    return NextResponse.json({ success: false, error: 'AI service unavailable. Please try again.' }, { status: 500 });
  }
}
