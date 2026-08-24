-- Mirror image of 20260901010000's proforma_invoices fix, in the other
-- direction: staff (native Supabase Auth, staff_users/is_active_staff())
-- need to read the RFQ tables the admin portal writes, for the new
-- "Requests" view in apps/catering-system. Without this, is_active_staff()
-- correctly evaluates false for staff on rfqs/rfq_status_history/
-- rfq_proforma_links (those tables' only existing policies are portal-only,
-- gated on is_active_portal_user()), so staff would just see an empty list,
-- not an error — but empty is still wrong, they need to actually see it.
--
-- Unlike the auth.uid() problem in 20260901010000, this direction is safe
-- by construction: portal_uid() reads auth.jwt()->>'sub' as plain text,
-- never casts to uuid, so it doesn't throw for a staff session's
-- UUID-shaped sub — it just won't match any portal_users.id, which is
-- correct (a staff member isn't a portal user unless separately added).
--
-- Additive only: the existing rfqs_portal_staff_all /
-- rfq_status_history_portal_staff_* / rfq_proforma_links_portal_staff_all
-- policies (20260901000000, 20260901010000) are untouched.

CREATE POLICY "staff_read_rfqs" ON public.rfqs
  FOR SELECT TO authenticated USING (public.is_active_staff());

CREATE POLICY "staff_read_rfq_status_history" ON public.rfq_status_history
  FOR SELECT TO authenticated USING (public.is_active_staff());

CREATE POLICY "staff_read_rfq_proforma_links" ON public.rfq_proforma_links
  FOR SELECT TO authenticated USING (public.is_active_staff());
