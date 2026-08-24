-- Single source of truth for branding/document settings (header, footer,
-- signature, stamps) that catering-system's Settings page previously wrote
-- only to browser localStorage (useSettingsStorage) — meaning every staff
-- member saw different branding depending on whose browser last touched
-- Settings, and admin-portal had nothing to query at all. This table
-- replaces that localStorage backing; the hook's public shape stays the
-- same so every existing consumer (proforma/invoice templates, the
-- Settings page) needs no changes beyond the hook's internals.

CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),  -- singleton-row trick: only one row can ever exist
  login_image_url TEXT,
  header_url TEXT,
  footer_url TEXT,
  signature_url TEXT,
  proforma_stamp_url TEXT,
  invoice_stamp_url TEXT,
  next_order_number INTEGER,
  next_proforma_number TEXT,
  next_invoice_number TEXT,
  pdf_scale NUMERIC(3, 1) DEFAULT 2.0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Read: both staff and portal users need this for the proforma/invoice
-- PDF templates (same pattern as invoice_tax_rates).
CREATE POLICY "app_settings_read" ON public.app_settings
  FOR SELECT TO authenticated USING (public.is_active_staff() OR public.is_active_portal_user());

-- Write: staff only — matches who can write today (catering-system's own
-- Settings page is the only writer).
CREATE POLICY "app_settings_write" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
