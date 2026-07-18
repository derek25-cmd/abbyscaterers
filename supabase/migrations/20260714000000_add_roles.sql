-- Introduces a real staff/role model. Every table's RLS previously relied on
-- "any authenticated user" (USING (true)), which is indistinguishable from
-- "any signed-up user" since public self sign-up was open. This table is the
-- source of truth every subsequent RLS policy checks against.

CREATE TABLE IF NOT EXISTS public.staff_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'finance', 'staff')) DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_users_self_select" ON public.staff_users;
CREATE POLICY "staff_users_self_select" ON public.staff_users
  FOR SELECT TO authenticated USING (id = auth.uid());

-- SECURITY DEFINER: RLS policies on other tables call these, and the caller
-- (an ordinary authenticated user) has no direct SELECT grant on staff_users
-- rows other than their own, so the check must run with elevated privilege.
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = auth.uid() AND is_active = true AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "staff_users_admin_all" ON public.staff_users;
CREATE POLICY "staff_users_admin_all" ON public.staff_users
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed the first admin manually after this migration runs, e.g.:
-- INSERT INTO public.staff_users (id, email, role)
-- VALUES ('<your-auth-uid>', 'you@abbyscaterers.com', 'admin');
