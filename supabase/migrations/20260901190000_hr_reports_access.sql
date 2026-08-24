-- HR Reports Centre access, per explicit confirmation: included, but
-- gated to Super Admin/Finance rather than the blanket is_active_portal_user()
-- used everywhere else — payroll/attendance/employees hold real PII and
-- (for payroll) salary data.
--
-- payroll and attendance don't hold bank/national-ID data (that's only on
-- employees), so a normal role-gated RLS policy is sufficient — same shape
-- as invoice_tax_rates_write.
CREATE POLICY "portal_read_payroll" ON public.payroll
  FOR SELECT TO authenticated USING (public.has_portal_role(ARRAY['super_admin', 'finance']));

CREATE POLICY "portal_read_attendance" ON public.attendance
  FOR SELECT TO authenticated USING (public.has_portal_role(ARRAY['super_admin', 'finance']));

-- employees is different: RLS is row-level, not column-level, so any
-- SELECT policy on the raw table would also expose bankAccountNumber,
-- nationalId, tin, dob, address, and monthlySalary regardless of what a
-- report UI chooses to display — a determined caller could just select
-- different columns. Instead of a table policy, a SECURITY DEFINER
-- function returns only the fields a payroll/attendance report actually
-- needs to show a name against an id.
CREATE OR REPLACE FUNCTION public.get_employee_directory_for_portal()
RETURNS TABLE (id TEXT, "firstName" TEXT, "lastName" TEXT, department TEXT, role TEXT, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_portal_role(ARRAY['super_admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT e.id, e."firstName", e."lastName", e.department, e.role, e.status
    FROM public.employees e;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_directory_for_portal() TO authenticated;
