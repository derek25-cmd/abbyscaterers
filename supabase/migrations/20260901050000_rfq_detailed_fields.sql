-- Expands the RFQ create form to match the proforma wizard's structure:
-- a real client picker (needs portal read access to clients, same
-- additive-policy pattern as proforma_invoices/invoices/orders before it)
-- plus service period, a proforma-required-by deadline, per-day pax (with
-- a same-for-all-dates shortcut), rate per plate, VAT mode, and location.
--
-- target_event_date and client_name_freetext (20260901000000) are left in
-- place, unused by the new form, rather than dropped — no data-loss risk
-- on columns that may already hold rows from before this change.

CREATE POLICY "portal_read_clients" ON public.clients
  FOR SELECT TO authenticated USING (public.is_active_portal_user());

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS service_start_date DATE,
  ADD COLUMN IF NOT EXISTS service_end_date DATE,
  ADD COLUMN IF NOT EXISTS proforma_required_by DATE,
  ADD COLUMN IF NOT EXISTS same_pax_all_dates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pax_per_day JSONB, -- [{ date: 'YYYY-MM-DD', pax: number }, ...]
  ADD COLUMN IF NOT EXISTS rate_per_plate NUMERIC CHECK (rate_per_plate IS NULL OR rate_per_plate >= 0),
  ADD COLUMN IF NOT EXISTS vat_type TEXT CHECK (vat_type IN ('inclusive', 'exclusive')),
  ADD COLUMN IF NOT EXISTS location TEXT;
