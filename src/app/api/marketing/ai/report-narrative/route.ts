import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyReportNarrative, type ReportNarrativeInput } from '@/features/marketing/utils/ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI features not configured. Add ANTHROPIC_API_KEY to environment variables.' },
      { status: 503 }
    );
  }

  const body = (await request.json()) as ReportNarrativeInput;

  try {
    const narrative = await generateMonthlyReportNarrative(body);
    return NextResponse.json({ success: true, data: { narrative } });
  } catch (error) {
    console.error('[ai/report-narrative] Claude API error:', error);
    return NextResponse.json({ success: false, error: 'AI service unavailable. Please try again.' }, { status: 500 });
  }
}
