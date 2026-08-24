-- Two-way comment thread on a proforma, visible to both the admin portal
-- and the existing system — so an admin can leave a note on a proforma
-- staff answered from her RFQ, and staff can reply, without either side
-- needing the other's login.

CREATE TABLE IF NOT EXISTS public.proforma_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id TEXT NOT NULL REFERENCES public.proforma_invoices(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('portal', 'staff')),
  portal_author_id TEXT REFERENCES public.portal_users(id),
  staff_author_id UUID REFERENCES auth.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proforma_comments_proforma_id ON public.proforma_comments (proforma_id, created_at);

ALTER TABLE public.proforma_comments ENABLE ROW LEVEL SECURITY;

-- Same breadth as the rest of the portal-facing proforma access
-- (portal_read_proforma_invoices, 20260901010000): any active portal user
-- can read/write comments on any proforma. Refine per-RFQ-ownership later
-- if that's ever needed.
CREATE POLICY "portal_read_proforma_comments" ON public.proforma_comments
  FOR SELECT TO authenticated USING (public.is_active_portal_user());

CREATE POLICY "portal_insert_proforma_comments" ON public.proforma_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_portal_user() AND author_type = 'portal' AND portal_author_id = public.portal_uid());

CREATE POLICY "staff_read_proforma_comments" ON public.proforma_comments
  FOR SELECT TO authenticated USING (public.is_active_staff());

CREATE POLICY "staff_insert_proforma_comments" ON public.proforma_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND author_type = 'staff');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'proforma_comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.proforma_comments;
    END IF;
  END IF;
END $$;
