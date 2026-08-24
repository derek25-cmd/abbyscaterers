-- Admin Portal foundation: a separate identity/role table for the new
-- portal, plus the RFQ tables it manages.
--
-- The portal authenticates via Clerk, wired as a Supabase third-party auth
-- provider. Clerk-issued JWTs are verified by Supabase directly, but Clerk
-- identities do NOT create rows in Supabase's own auth.users table, so the
-- existing staff_users table (hard FK'd to auth.users, see
-- 20260714000000_add_roles.sql) cannot hold them. portal_users is a wholly
-- separate table, keyed by the Clerk user id (the JWT `sub` claim, a
-- string like "user_2NNy...", not a UUID). staff_users, is_admin(), and
-- is_active_staff() are untouched by this migration.
--
-- Critical: auth.uid() casts the JWT `sub` claim to uuid, which throws for
-- Clerk's non-UUID ids. Every helper below reads auth.jwt()->>'sub'
-- directly instead — never auth.uid().

CREATE TABLE IF NOT EXISTS public.portal_users (
  id TEXT PRIMARY KEY,                 -- Clerk user id (sub claim)
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'super_admin', 'management', 'finance', 'operations', 'hr', 'branch_manager', 'staff'
  )) DEFAULT 'staff',
  branch TEXT CHECK (branch IN ('Dar es Salaam', 'Dodoma', 'Arusha')), -- nullable = all branches
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.portal_uid()
RETURNS text LANGUAGE sql STABLE
SET search_path = public, pg_temp AS $$
  SELECT auth.jwt()->>'sub';
$$;

CREATE OR REPLACE FUNCTION public.is_active_portal_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE id = public.portal_uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE id = public.portal_uid() AND is_active = true AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_portal_role(roles TEXT[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE id = public.portal_uid() AND is_active = true AND role = ANY(roles)
  );
$$;

DROP POLICY IF EXISTS "portal_users_self_select" ON public.portal_users;
CREATE POLICY "portal_users_self_select" ON public.portal_users
  FOR SELECT TO authenticated USING (id = public.portal_uid());

DROP POLICY IF EXISTS "portal_users_admin_all" ON public.portal_users;
CREATE POLICY "portal_users_admin_all" ON public.portal_users
  FOR ALL TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

-- Seed the first super_admin manually after this migration runs, e.g.:
-- INSERT INTO public.portal_users (id, email, role)
-- VALUES ('<clerk-user-id>', 'you@abbyscaterers.com', 'super_admin');

-- ─── RFQs ───────────────────────────────────────────────────────────────
-- rfq_attachments, rfq_revisions, and any RFQ↔proforma link are deferred to
-- the Proforma integration phase (needs a new Storage bucket / touches
-- proforma_invoices) — deliberately not part of this migration.

CREATE TABLE IF NOT EXISTS public.rfqs (
  id TEXT PRIMARY KEY,                  -- e.g. RFQ-000123, via claim_ids('rfq_id')
  client_id TEXT REFERENCES public.clients(id),  -- nullable: RFQ may predate a clients row
  client_name_freetext TEXT,            -- for prospects with no clients row yet
  title TEXT NOT NULL,
  description TEXT,
  requested_by_id TEXT REFERENCES public.portal_users(id),
  status TEXT NOT NULL CHECK (status IN (
    'draft', 'submitted', 'in_review', 'proforma_created', 'approved', 'closed', 'cancelled'
  )) DEFAULT 'draft',
  target_event_date DATE,
  region TEXT,
  branch TEXT CHECK (branch IN ('Dar es Salaam', 'Dodoma', 'Arusha')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfqs_status ON public.rfqs (status);
CREATE INDEX IF NOT EXISTS idx_rfqs_client_id ON public.rfqs (client_id);

CREATE TABLE IF NOT EXISTS public.rfq_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id TEXT NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_id TEXT REFERENCES public.portal_users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfq_status_history_rfq_id ON public.rfq_status_history (rfq_id);

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfqs_portal_staff_all" ON public.rfqs;
CREATE POLICY "rfqs_portal_staff_all" ON public.rfqs
  FOR ALL TO authenticated
  USING (public.is_active_portal_user())
  WITH CHECK (public.is_active_portal_user());

DROP POLICY IF EXISTS "rfq_status_history_portal_staff_select" ON public.rfq_status_history;
CREATE POLICY "rfq_status_history_portal_staff_select" ON public.rfq_status_history
  FOR SELECT TO authenticated USING (public.is_active_portal_user());

DROP POLICY IF EXISTS "rfq_status_history_portal_staff_insert" ON public.rfq_status_history;
CREATE POLICY "rfq_status_history_portal_staff_insert" ON public.rfq_status_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_portal_user() AND changed_by_id = public.portal_uid());

-- Reuse the existing claim_ids() mechanism (20260702100000_id_counters.sql)
-- for RFQ numbering — a flat monotonic counter, no year-reset. Acceptable
-- for v1; a year-scoped scheme can be layered on later if wanted.
INSERT INTO public.id_counters (name, value) VALUES ('rfq_id', 0)
ON CONFLICT (name) DO NOTHING;

-- Realtime: only enable if this project's supabase_realtime publication
-- already exists and rfqs isn't already a member (ADD TABLE errors on a
-- duplicate add, so this is guarded).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rfqs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rfqs;
    END IF;
  END IF;
END $$;
