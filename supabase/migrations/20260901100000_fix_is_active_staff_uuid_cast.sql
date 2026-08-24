-- Fixes "invalid input syntax for type uuid: user_..." on any table with
-- both a staff policy (is_active_staff()/is_admin(), calling auth.uid())
-- and a portal policy (is_active_portal_user(), calling portal_uid()) —
-- e.g. clients, proforma_invoices, invoices.
--
-- PostgreSQL combines multiple permissive RLS policies for the same
-- command with OR, and its docs are explicit that the evaluation order is
-- NOT specified. The earlier assumption (20260901010000 and after) was
-- that adding a portal policy alongside an existing staff one was purely
-- additive and safe. It wasn't: when Postgres happens to evaluate the
-- staff policy first for a Clerk-authenticated request, is_active_staff()
-- calls auth.uid(), which casts the JWT sub claim to uuid and THROWS for
-- Clerk's non-UUID ids — aborting the whole query before the portal
-- policy (which would have granted access) is ever reached. This is why
-- some tables appeared to work (rfqs, where the portal policy happened to
-- get checked first) while others didn't (clients, embedded via
-- rfqs?select=*,clients(...) — reported as "Failed to load RFQs: invalid
-- input syntax for type uuid").
--
-- The robust, order-independent fix: make is_active_staff()/is_admin()
-- themselves safe to evaluate under any session — return false instead of
-- throwing — so it no longer matters which policy Postgres checks first.
-- For a real staff session auth.uid() still returns its normal UUID and
-- behavior is completely unchanged; only a session where auth.uid() would
-- have thrown (any Clerk/portal session) now gets a clean `false` instead
-- of an error.

CREATE OR REPLACE FUNCTION public.safe_auth_uid()
RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN auth.uid();
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = public.safe_auth_uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = public.safe_auth_uid() AND is_active = true AND role = 'admin'
  );
$$;
