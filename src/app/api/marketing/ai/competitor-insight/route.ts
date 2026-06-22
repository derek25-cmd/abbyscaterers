import { NextRequest, NextResponse } from 'next/server';
import { generateCompetitorInsight, type CompetitorInsightInput } from '@/features/marketing/utils/ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI features not configured. Add ANTHROPIC_API_KEY to environment variables.' },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { competitors: CompetitorInsightInput[] };

  try {
    const insight = await generateCompetitorInsight(body.competitors ?? []);
    return NextResponse.json({ success: true, data: { insight } });
  } catch (error) {
    console.error('[ai/competitor-insight] Claude API error:', error);
    return NextResponse.json({ success: false, error: 'AI service unavailable. Please try again.' }, { status: 500 });
  }
}
