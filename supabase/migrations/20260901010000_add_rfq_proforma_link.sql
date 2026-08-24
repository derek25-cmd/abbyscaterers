-- Portal users authenticate via Clerk (a third-party auth provider), so
-- their JWT's `sub` claim is a Clerk id (e.g. "user_...", not a UUID).
-- auth.uid() casts that claim to ::uuid and THROWS for any non-UUID sub —
-- meaning every existing RLS policy built on is_active_staff()/is_admin()
-- (which call auth.uid()) errors out, not just denies, for a portal
-- session. Every existing table admin-portal needs to read must therefore
-- get an ADDITIVE new policy keyed on is_active_portal_user() instead.
--
-- This adds exactly one such policy, SELECT-only, to proforma_invoices —
-- the existing staff_manage_proforma_invoices policy
-- (20260714000100_tighten_finance_rls.sql) is completely untouched.
-- Postgres ORs permissive policies together, so this only ever grants
-- additional access; it cannot revoke or narrow the existing staff policy,
-- and staff_users-authenticated requests are unaffected.

CREATE POLICY "portal_read_proforma_invoices" ON public.proforma_invoices
  FOR SELECT TO authenticated USING (public.is_active_portal_user());

-- ─── RFQ ↔ Proforma linking ────────────────────────────────────────────
-- Written entirely from the admin-portal side — no edit to
-- src/services/proformaInvoiceService.ts or the existing create-proforma
-- flow. One RFQ can link to multiple proformas (revisions, split events).

CREATE TABLE IF NOT EXISTS public.rfq_proforma_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id TEXT NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  proforma_id TEXT NOT NULL REFERENCES public.proforma_invoices(id) ON DELETE CASCADE,
  linked_by_id TEXT REFERENCES public.portal_users(id),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, proforma_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_proforma_links_rfq_id ON public.rfq_proforma_links (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_proforma_links_proforma_id ON public.rfq_proforma_links (proforma_id);

ALTER TABLE public.rfq_proforma_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfq_proforma_links_portal_staff_all" ON public.rfq_proforma_links
  FOR ALL TO authenticated
  USING (public.is_active_portal_user())
  WITH CHECK (public.is_active_portal_user());

-- Atomic: link + advance RFQ status + record history in one transaction,
-- mirroring the existing create_invoice_from_proforma RPC's pattern
-- (supabase/migrations/20260719000100_atomic_invoice_writes.sql).
CREATE OR REPLACE FUNCTION public.link_rfq_to_proforma(p_rfq_id TEXT, p_proforma_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_actor TEXT := public.portal_uid();
BEGIN
  IF NOT public.is_active_portal_user() THEN
    RAISE EXCEPTION 'Not an active portal user';
  END IF;

  SELECT status INTO v_current_status FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'RFQ % not found', p_rfq_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proforma_invoices WHERE id = p_proforma_id) THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;

  INSERT INTO public.rfq_proforma_links (rfq_id, proforma_id, linked_by_id)
  VALUES (p_rfq_id, p_proforma_id, v_actor)
  ON CONFLICT (rfq_id, proforma_id) DO NOTHING;

  -- Only advance status forward from the early stages — never regress an
  -- RFQ that's already been approved/closed/cancelled by a later link.
  IF v_current_status IN ('draft', 'submitted', 'in_review') THEN
    UPDATE public.rfqs SET status = 'proforma_created', updated_at = now() WHERE id = p_rfq_id;

    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (p_rfq_id, v_current_status, 'proforma_created', v_actor, 'Linked to proforma ' || p_proforma_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_rfq_to_proforma(TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rfq_proforma_links'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rfq_proforma_links;
    END IF;
  END IF;
END $$;
