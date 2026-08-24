-- Configurable tax rates + per-client applicability, so the admin-portal
-- invoice view can show a real WHT/VAT-withholding breakdown instead of
-- inventing fixed rules — neither concept exists anywhere in
-- catering-system today (no per-invoice WHT/VAT-withholding, no client
-- TIN/withholding-agent flag). VAT stays included here too so a client can
-- be marked VAT-exempt, not just WHT/withholding.
--
-- Named invoice_tax_rates (not tax_rates) — public.tax_rates already exists
-- for an unrelated purpose (payroll PAYE/NSSF/SDL/WCF bands,
-- 20260727000000_tax_rates.sql, completely different columns). Reusing
-- that name silently no-ops CREATE TABLE IF NOT EXISTS against it.

CREATE TABLE IF NOT EXISTS public.invoice_tax_rates (
  tax_type TEXT PRIMARY KEY CHECK (tax_type IN ('vat', 'wht', 'vat_withholding')),
  rate NUMERIC(5, 2) NOT NULL,
  updated_by TEXT REFERENCES public.portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.invoice_tax_rates (tax_type, rate) VALUES
  ('vat', 18.00),
  ('wht', 5.00),
  ('vat_withholding', 33.33)
ON CONFLICT (tax_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.client_invoice_tax_settings (
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('vat', 'wht', 'vat_withholding')),
  applies BOOLEAN NOT NULL DEFAULT false,
  updated_by TEXT REFERENCES public.portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, tax_type)
);

ALTER TABLE public.invoice_tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invoice_tax_settings ENABLE ROW LEVEL SECURITY;

-- Read: both sides — cheap, symmetric with how other shared config (RFQ
-- tables) is readable from both portal and staff sessions.
CREATE POLICY "invoice_tax_rates_read" ON public.invoice_tax_rates
  FOR SELECT TO authenticated USING (public.is_active_portal_user() OR public.is_active_staff());

CREATE POLICY "client_invoice_tax_settings_read" ON public.client_invoice_tax_settings
  FOR SELECT TO authenticated USING (public.is_active_portal_user() OR public.is_active_staff());

-- Write: gated to Finance/Super Admin — org-wide financial configuration,
-- not a per-record action, so unlike every other portal write in this app
-- (gated only on "active portal user"), this one is worth restricting by
-- role. has_portal_role() has existed since the very first portal
-- migration but was never actually used in a policy until now.
CREATE POLICY "invoice_tax_rates_write" ON public.invoice_tax_rates
  FOR ALL TO authenticated
  USING (public.has_portal_role(ARRAY['super_admin', 'finance']))
  WITH CHECK (public.has_portal_role(ARRAY['super_admin', 'finance']));

CREATE POLICY "client_invoice_tax_settings_write" ON public.client_invoice_tax_settings
  FOR ALL TO authenticated
  USING (public.has_portal_role(ARRAY['super_admin', 'finance']))
  WITH CHECK (public.has_portal_role(ARRAY['super_admin', 'finance']));

-- Realtime for the invoice detail view (payment-status updates); invoices
-- was never added to the publication before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    END IF;
  END IF;
END $$;
