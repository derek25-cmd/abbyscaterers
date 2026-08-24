-- Invoice requests are a REQUEST/FULFILL queue, not a direct write path:
-- the admin portal submits a request, and the existing system (staff,
-- authenticated via Supabase Auth/staff_users) is the one that actually
-- calls create_invoice_from_proforma() and processes it — mirroring the
-- RFQ pattern exactly (admin requests, staff fulfills). This is a revision
-- of this migration's first draft, which let the portal call the RPC
-- directly; that draft was never applied (verified via a live schema-cache
-- probe before writing this), so it's revised in place rather than layered
-- with a follow-up correction.
--
-- Because staff — not the portal — does the actual invoice creation, staff
-- already has everything it needs via the existing
-- staff_manage_invoices/staff_manage_proforma_invoices policies
-- (20260714000100_tighten_finance_rls.sql). No new INSERT/UPDATE grants on
-- invoices/proforma_invoices for the portal are needed at all — only a
-- read-only policy so the portal can display the outcome once fulfilled.

CREATE POLICY "portal_read_invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_active_portal_user());

CREATE TABLE IF NOT EXISTS public.portal_invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id TEXT REFERENCES public.rfqs(id) ON DELETE SET NULL,
  proforma_id TEXT NOT NULL REFERENCES public.proforma_invoices(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'rejected')) DEFAULT 'pending',
  invoice_id TEXT REFERENCES public.invoices(id) ON DELETE SET NULL,
  requested_by_id TEXT REFERENCES public.portal_users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_by_id UUID REFERENCES auth.users(id),
  fulfilled_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_invoice_requests_rfq_id ON public.portal_invoice_requests (rfq_id);
CREATE INDEX IF NOT EXISTS idx_portal_invoice_requests_status ON public.portal_invoice_requests (status);
-- Only one open (pending) request per proforma at a time — nothing stops a
-- second request after the first is fulfilled/rejected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_invoice_requests_one_pending_per_proforma
  ON public.portal_invoice_requests (proforma_id) WHERE status = 'pending';

ALTER TABLE public.portal_invoice_requests ENABLE ROW LEVEL SECURITY;

-- Portal: can create requests and read their own submissions (and anyone
-- else's — same "any active portal user" breadth as rfqs' own policy;
-- refine per-role later if that's ever needed). No portal UPDATE/DELETE —
-- fulfillment is staff's job, not something the requester can self-grant.
CREATE POLICY "portal_read_invoice_requests" ON public.portal_invoice_requests
  FOR SELECT TO authenticated USING (public.is_active_portal_user());

CREATE POLICY "portal_insert_invoice_requests" ON public.portal_invoice_requests
  FOR INSERT TO authenticated WITH CHECK (public.is_active_portal_user());

-- Staff: read (Requests page) and update (mark fulfilled/rejected, set
-- invoice_id) — mirroring 20260901020000's staff-read-portal-tables
-- pattern, extended with UPDATE since staff is the one acting on these.
CREATE POLICY "staff_read_invoice_requests" ON public.portal_invoice_requests
  FOR SELECT TO authenticated USING (public.is_active_staff());

CREATE POLICY "staff_update_invoice_requests" ON public.portal_invoice_requests
  FOR UPDATE TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_invoice_requests'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_invoice_requests;
    END IF;
  END IF;
END $$;
