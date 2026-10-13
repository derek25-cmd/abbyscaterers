-- Phase 1 (HR Manager review, section 2.9): widen the role model and put every
-- "who may do what" decision behind named SQL helpers, so RLS policies never
-- hardcode role lists. Changing a role's rights later is a one-line edit to
-- the relevant helper, not a sweep of policies.

-- ── 1. Widen staff_users.role ──────────────────────────────────────────────
-- The original CHECK was created inline and unnamed, so find it by what it
-- constrains rather than guessing the generated name.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.staff_users'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
      AND c.conname <> 'staff_users_role_check_v2'
  LOOP
    EXECUTE format('ALTER TABLE public.staff_users DROP CONSTRAINT %I', con.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.staff_users'::regclass AND conname = 'staff_users_role_check_v2'
  ) THEN
    ALTER TABLE public.staff_users
      ADD CONSTRAINT staff_users_role_check_v2
      CHECK (role IN ('admin', 'general_manager', 'hr_manager', 'finance', 'staff'));
  END IF;
END $$;

-- ── 2. Role helpers ────────────────────────────────────────────────────────
-- SECURITY DEFINER because ordinary users can only SELECT their own
-- staff_users row. Uses safe_auth_uid() (20260901100000) so a Clerk/portal
-- session gets `false` instead of a uuid-cast error.
CREATE OR REPLACE FUNCTION public.has_staff_role(roles text[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = public.safe_auth_uid() AND is_active = true AND role = ANY (roles)
  );
$$;

-- Edit/delete/approve on HR tables. Single place to change if the HR
-- Manager's answer on admin or general_manager rights changes.
CREATE OR REPLACE FUNCTION public.can_manage_hr()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_staff_role(ARRAY['admin', 'hr_manager', 'general_manager']);
$$;

-- Ops locking is deferred: addIssuance() decrements assets.quantity from the
-- client, so restricting Ops writes now would stop staff issuing stock. Until
-- that moves server-side this stays "any active staff", matching today's
-- staff_manage_* policies. Tighten here (e.g. admin + general_manager) later.
CREATE OR REPLACE FUNCTION public.can_manage_ops()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_active_staff();
$$;

-- Users, roles and app settings.
CREATE OR REPLACE FUNCTION public.can_manage_settings()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_staff_role(ARRAY['admin']);
$$;

GRANT EXECUTE ON FUNCTION public.has_staff_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_ops() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_settings() TO authenticated;

-- ── 3. staff_users admin policy ────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_users_admin_all" ON public.staff_users;
CREATE POLICY "staff_users_admin_all" ON public.staff_users
  FOR ALL TO authenticated
  USING (public.can_manage_settings()) WITH CHECK (public.can_manage_settings());
