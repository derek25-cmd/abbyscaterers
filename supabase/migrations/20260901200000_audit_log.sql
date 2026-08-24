-- Generic audit log for admin-portal-relevant actions. The one generic
-- audit_log table that already exists (20260726010000_add_audit_log.sql)
-- is Supabase-Auth-only (actor_id references auth.users) — the same
-- auth.uid()-cast problem documented in portal_users' own migration means
-- Clerk-authenticated portal actors can't satisfy it. This mirrors
-- portal_notifications' proven Clerk-compatible shape instead
-- (portal_user_id TEXT, SECURITY DEFINER writer) rather than reusing
-- audit_log as-is.
--
-- Scoped to the actions that actually matter for oversight (approvals,
-- rejections, request fulfillment, role/access changes) — not a generic
-- "every field edit on every table" log, which would need triggers on
-- every table in the schema.

CREATE TABLE IF NOT EXISTS public.portal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('portal', 'staff', 'system')),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_audit_log_created_at ON public.portal_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_table_record ON public.portal_audit_log (table_name, record_id);

ALTER TABLE public.portal_audit_log ENABLE ROW LEVEL SECURITY;

-- Super Admin only — matches the build spec's "/audit-log → Super Admin only".
CREATE POLICY "portal_audit_log_admin_select" ON public.portal_audit_log
  FOR SELECT TO authenticated USING (public.is_portal_admin());

-- No client-side INSERT policy at all — every row is written by this
-- SECURITY DEFINER function, same discipline as portal_notifications.
CREATE OR REPLACE FUNCTION public.log_portal_audit_event(
  p_actor_id TEXT,
  p_actor_type TEXT,
  p_action TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.portal_audit_log (actor_id, actor_type, action, table_name, record_id, note)
  VALUES (p_actor_id, p_actor_type, p_action, p_table_name, p_record_id, p_note);
$$;

-- portal_users role/is_active changes weren't logged anywhere — the one
-- gap flagged by research. SECURITY DEFINER since staff/other portal
-- sessions have no direct INSERT grant on portal_audit_log.
CREATE OR REPLACE FUNCTION public.log_portal_user_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.log_portal_audit_event(
      public.portal_uid(),
      'portal',
      'portal_user.updated',
      'portal_users',
      NEW.id,
      format('role: %s -> %s, active: %s -> %s', OLD.role, NEW.role, OLD.is_active, NEW.is_active)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portal_users_log_changes ON public.portal_users;
CREATE TRIGGER portal_users_log_changes
  AFTER UPDATE ON public.portal_users
  FOR EACH ROW EXECUTE FUNCTION public.log_portal_user_change();
