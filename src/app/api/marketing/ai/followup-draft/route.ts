import { NextRequest, NextResponse } from 'next/server';
import { draftFollowUpMessage, type FollowUpDraftInput } from '@/features/marketing/utils/ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI features not configured. Add ANTHROPIC_API_KEY to environment variables.' },
      { status: 503 }
    );
  }

  const body = (await request.json()) as FollowUpDraftInput;

  if (!body.companyName || !body.followUpType || !body.language) {
    return NextResponse.json({ success: false, error: 'companyName, followUpType and language are required' }, { status: 400 });
  }

  try {
    const draft = await draftFollowUpMessage(body);
    return NextResponse.json({ success: true, data: { draft, type: body.followUpType, language: body.language } });
  } catch (error) {
    console.error('[ai/followup-draft] Claude API error:', error);
    return NextResponse.json({ success: false, error: 'AI service unavailable. Please try again.' }, { status: 500 });
  }
}
