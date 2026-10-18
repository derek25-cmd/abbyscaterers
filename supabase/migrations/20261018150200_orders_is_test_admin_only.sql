-- Data readiness Phase 3, Step 7: only admins may change orders.is_test.
--
-- The orders RLS lets every active staff member edit orders, and the
-- "Exclude from analytics" switch is admin-only in the app, so the database
-- enforces the same rule: a signed-in user who is not an admin
-- (can_manage_settings(), the 'settings.manage' permission in
-- src/lib/permissions.ts) cannot set or clear is_test, on insert or update.
-- No signed-in user (SQL editor, service role, migrations) is not checked,
-- so the confirmed test orders can be flagged with SQL.
-- Nothing else about saving an order changes.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS orders_is_test_admin_only ON public.orders;
--   DROP FUNCTION IF EXISTS public.orders_is_test_admin_only();

CREATE OR REPLACE FUNCTION public.orders_is_test_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.safe_auth_uid() IS NOT NULL
     AND NOT public.can_manage_settings()
     AND (CASE WHEN TG_OP = 'INSERT' THEN NEW.is_test
               ELSE NEW.is_test IS DISTINCT FROM OLD.is_test END) THEN
    RAISE EXCEPTION 'Only admins can mark an order as a test order'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_is_test_admin_only() FROM PUBLIC;

DROP TRIGGER IF EXISTS orders_is_test_admin_only ON public.orders;
CREATE TRIGGER orders_is_test_admin_only
  BEFORE INSERT OR UPDATE OF is_test ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_is_test_admin_only();
