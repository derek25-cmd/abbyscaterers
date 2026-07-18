-- Replaces whatever RLS policies currently exist on finance/orders tables
-- with a single staff-membership check.
-- Depends on public.is_active_staff() from 20260714000000_add_roles.sql.
--
-- Does NOT rely on hardcoded old policy names: this project's live schema
-- has already been shown to diverge from git history (20260714000100's
-- first draft assumed "equipment" existed; it didn't, and separately
-- is_marketing_user() turned out to be missing too). A named DROP POLICY
-- IF EXISTS is a no-op against a policy under an unknown name, and since
-- Postgres OR's permissive RLS policies together, any leftover "USING
-- (true)" policy under a name we didn't guess would silently keep granting
-- full access alongside our new restrictive one. So instead: for every
-- target table that exists, look up ALL of its current policies via
-- pg_policies and drop them by their real (not assumed) names, then add
-- exactly one new one.

DO $$
DECLARE
  r RECORD;
  pol RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('clients'), ('equipment'), ('orders'), ('proforma_invoices'), ('invoices'),
    ('bookings'), ('delivery_notes'), ('daily_menus'), ('products'), ('stock_logs'),
    ('sales'), ('costing_reports'), ('expenses'), ('vat_wht_ledger'), ('payroll')
  ) AS t(table_name)
  LOOP
    IF to_regclass('public.' || r.table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);

      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = r.table_name
      LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, r.table_name);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())',
        'staff_manage_' || r.table_name, r.table_name
      );

      RAISE NOTICE 'Applied staff-only RLS policy to % (removed any prior policies)', r.table_name;
    ELSE
      RAISE NOTICE 'Skipping % — table does not exist in this database', r.table_name;
    END IF;
  END LOOP;
END $$;
