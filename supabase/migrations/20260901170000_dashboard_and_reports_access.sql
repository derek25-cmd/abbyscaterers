-- Admin-portal Dashboard ("upcoming events") and the Operational Reports
-- both need to read orders — schedule/client/pax data, not financial or
-- HR-sensitive, so a blanket portal-read policy (same breadth as rfqs'
-- own) is appropriate here, unlike payroll/attendance/employees.

CREATE POLICY "portal_read_orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_active_portal_user());
