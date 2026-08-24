import { NextRequest, NextResponse } from 'next/server';
import { getReportSession } from '@/lib/reports/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  generateReportInsights,
  generateExecutiveNarrative,
  generateComparisonInsights,
  type ReportInsightsInput,
  type ExecutiveSummaryInput,
  type ComparisonInsightsInput,
} from '@/lib/reports/ai-insights';

export const dynamic = 'force-dynamic';

/**
 * Never touches the database — the client has already computed every number
 * (via the existing service layer + client-side aggregation, same as every
 * other report page in this app) and posts them here purely for Claude to
 * narrate. Gated to admin/finance staff so the ANTHROPIC_API_KEY-backed call
 * can't be triggered by every logged-in user.
 */
export async function POST(request: NextRequest) {
  const session = await getReportSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'You must be an admin or finance staff member to generate AI insights' }, { status: 403 });
  }

  const { allowed } = await checkRateLimit('ai', session.userId);
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Too many AI requests. Please wait a moment and try again.' }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI features not configured. Add ANTHROPIC_API_KEY to environment variables.' },
      { status: 503 }
    );
  }

  const body = await request.json();

  try {
    if (body.kind === 'executive-summary') {
      const insights = await generateExecutiveNarrative(body as ExecutiveSummaryInput);
      return NextResponse.json({ success: true, data: insights });
    }
    if (body.kind === 'comparison') {
      const insights = await generateComparisonInsights(body as ComparisonInsightsInput);
      return NextResponse.json({ success: true, data: insights });
    }
    const insights = await generateReportInsights(body as ReportInsightsInput);
    return NextResponse.json({ success: true, data: insights });
  } catch (error) {
    console.error('[reports/ai-insights] Claude API error:', error);
    return NextResponse.json({ success: false, error: 'AI service unavailable. Please try again.' }, { status: 500 });
  }
}
