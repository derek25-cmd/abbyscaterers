-- Minimal audit trail for sensitive actions (client deletion, invoice
-- deletion, payroll changes, etc.) — there was previously no way to answer
-- "who did this and when" for the core finance/HR tables (the marketing
-- module already has marketer_approval_log for its own actions; this is the
-- equivalent for everything else). Reuses the staff_users/is_admin() model
-- from 20260714000000_add_roles.sql rather than inventing a new one.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,        -- e.g. 'client.delete', 'invoice.delete', 'payroll.update'
  table_name TEXT NOT NULL,
  record_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log (actor_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the trail — that's the whole point of an audit log.
DROP POLICY IF EXISTS "audit_log_admin_select" ON public.audit_log;
CREATE POLICY "audit_log_admin_select" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- Any active staff member can write an entry (for their own actions), but
-- never read, update, or delete existing entries — an audit log that its
-- own writers can edit or erase isn't one.
DROP POLICY IF EXISTS "audit_log_staff_insert" ON public.audit_log;
CREATE POLICY "audit_log_staff_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_active_staff() AND actor_id = auth.uid());
