import { NextRequest, NextResponse } from 'next/server';
import { draftFollowUpMessage, type FollowUpDraftInput } from '@/features/marketing/utils/ai';
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
