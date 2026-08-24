-- Costing Module: there is no backend costing calculation to "request" —
-- catering-system computes costing entirely client-side (costing-report.tsx,
-- DailyCostingModule.tsx, menuCostingService.ts), nothing persisted.
-- Re-deriving that whole engine as a Postgres RPC would be its own project
-- and risks silently diverging from catering-system's real numbers. This
-- mirrors portal_invoice_requests' proven request/fulfill pattern instead:
-- admin requests a costing report for an RFQ, staff fulfills it with the
-- real numbers from their existing tools. Keeps "portal has no costing
-- logic itself" literally true.

CREATE TABLE IF NOT EXISTS public.portal_costing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id TEXT NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'rejected')) DEFAULT 'pending',
  total_cost NUMERIC,
  total_revenue NUMERIC,
  gross_margin_pct NUMERIC,
  notes TEXT,
  requested_by_id TEXT REFERENCES public.portal_users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_by_id UUID REFERENCES auth.users(id),
  fulfilled_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_costing_requests_rfq_id ON public.portal_costing_requests (rfq_id);
CREATE INDEX IF NOT EXISTS idx_portal_costing_requests_status ON public.portal_costing_requests (status);
-- Only one open (pending) request per RFQ at a time — mirrors
-- portal_invoice_requests' one-pending-per-proforma constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_costing_requests_one_pending_per_rfq
  ON public.portal_costing_requests (rfq_id) WHERE status = 'pending';

ALTER TABLE public.portal_costing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_read_costing_requests" ON public.portal_costing_requests
  FOR SELECT TO authenticated USING (public.is_active_portal_user());

CREATE POLICY "portal_insert_costing_requests" ON public.portal_costing_requests
  FOR INSERT TO authenticated WITH CHECK (public.is_active_portal_user());

CREATE POLICY "staff_read_costing_requests" ON public.portal_costing_requests
  FOR SELECT TO authenticated USING (public.is_active_staff());

CREATE POLICY "staff_update_costing_requests" ON public.portal_costing_requests
  FOR UPDATE TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_costing_requests'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_costing_requests;
    END IF;
  END IF;
END $$;
