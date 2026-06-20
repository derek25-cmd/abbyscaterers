import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { canTransitionTo } from '@/features/marketing/utils/pipeline';
import type { PipelineStage } from '@/features/marketing/types';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();
  const nextStage = body.stage as PipelineStage | undefined;

  if (!nextStage) {
    return NextResponse.json({ error: 'stage is required' }, { status: 400 });
  }

  const { data: company, error: fetchError } = await client
    .from('companies')
    .select('pipeline_stage')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  if (!canTransitionTo(company.pipeline_stage, nextStage)) {
    return NextResponse.json({ error: 'Invalid stage transition' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    pipeline_stage: nextStage,
    updated_at: new Date().toISOString(),
  };
  if (nextStage === 'WON') update.client_since = new Date().toISOString();

  const { data, error } = await client.from('companies').update(update).eq('id', params.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
