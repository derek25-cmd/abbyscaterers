-- Closes a gap found by supabase/tests/hr_ops_rls.sql on the live database:
-- `products` and `stock_logs` each carry a leftover "Allow authenticated users
-- to manage ..." policy with USING (true) / WITH CHECK (true), on top of the
-- staff_manage_* policy from 20260714000100. Permissive policies are OR'd, so
-- the open one wins and any signed-in user — including a deactivated staff
-- member — can read and write both tables. products also keeps the old
-- "Owner access to products" policy from base_schema.sql.
--
-- Same fix as 20261014000200 applied to assets/issuance: drop every policy by
-- its real name (keeping `portal_%`, none exist here today) and leave exactly
-- one staff-only policy. Only the staff catering app reads these tables
-- (productService, stockLogService, menuCostingService), so nothing legitimate
-- depends on the open policies. Write access stays staff-wide per Phase 1:
-- can_manage_ops() is "any active staff" until Ops locking is done.

DO $$
DECLARE
  t text;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'stock_logs']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Skipping % — table does not exist in this database', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname NOT LIKE 'portal\_%'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_manage_ops()) WITH CHECK (public.can_manage_ops())',
      'staff_manage_' || t, t
    );
    RAISE NOTICE 'Replaced all policies on % with a single staff-only policy', t;
  END LOOP;
END $$;
