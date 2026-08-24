import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { getMarketingSession } from '@/features/marketing/utils/auth';
import { canTransitionTo } from '@/features/marketing/utils/pipeline';
import type { PipelineStage } from '@/features/marketing/types';

export const dynamic = 'force-dynamic';

const ONBOARDING_ELIGIBLE_STAGES: PipelineStage[] = ['QUOTATION_REQUESTED', 'NEGOTIATING', 'WON'];

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMarketingSession(request);
  if (!session) {
    return NextResponse.json({ error: 'You must be a registered marketing user' }, { status: 403 });
  }

  const client = getRouteClient(request.headers.get('authorization'));
  const body = await request.json();
  const nextStage = body.stage as PipelineStage | undefined;
  const requestOnboarding = Boolean(body.requestOnboarding);

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

  if (company.pipeline_stage !== nextStage && !canTransitionTo(company.pipeline_stage, nextStage)) {
    return NextResponse.json({ error: 'Invalid stage transition' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    pipeline_stage: nextStage,
    updated_at: new Date().toISOString(),
  };
  if (nextStage === 'WON') update.client_since = new Date().toISOString();

  if (requestOnboarding && ONBOARDING_ELIGIBLE_STAGES.includes(nextStage)) {
    update.onboarding_requested = true;
    update.onboarding_requested_at = new Date().toISOString();
    update.onboarding_requested_by = session.marketerId;
  }

  const { data, error } = await client.from('companies').update(update).eq('id', params.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (nextStage === 'QUOTATION_REQUESTED') {
    const { data: latestVisit } = await client
      .from('visits')
      .select('services_presented')
      .eq('company_id', params.id)
      .order('check_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      data,
      quotationPrompt: {
        companyId: data.id,
        companyName: data.name,
        contactName: data.contact_name,
        contactEmail: data.contact_email,
        estimatedValue: data.estimated_value,
        services: latestVisit?.services_presented ?? [],
        // No Quotation module exists in this app — "quotations" are Proforma Invoices,
        // which key off the separate `clients` table (not `companies`). There is no
        // FK linking the two, so we link to the creation page without a fake prefill.
        createQuotationUrl: `/proforma-invoices/new`,
      },
    });
  }

  if (nextStage === 'WON') {
    return NextResponse.json({
      data,
      wonAlert: {
        companyName: data.name,
        estimatedMonthlyValue: data.estimated_value,
        // Bookings also key off the separate `clients` table — no FK to companies exists,
        // so this links to the bookings list rather than a fabricated prefilled URL.
        viewBookingsUrl: `/bookings`,
      },
    });
  }

  return NextResponse.json({ data });
}
