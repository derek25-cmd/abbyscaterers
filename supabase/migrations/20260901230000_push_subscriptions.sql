-- Web Push subscriptions — one row per browser/device a portal user has
-- enabled notifications on. Written via the admin-portal API routes
-- (/api/push-subscribe, /api/push-unsubscribe) using a service-role
-- client, since Clerk sessions aren't Supabase JWTs and can't satisfy
-- portal_uid() directly from a server route the way client-side calls do.
-- RLS is still defined here for defense-in-depth and any future direct
-- client reads, matching the portal_notifications own-rows convention.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id TEXT NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_portal_user_id ON public.push_subscriptions (portal_user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_read_push_subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (portal_user_id = public.portal_uid());

CREATE POLICY "own_insert_push_subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (portal_user_id = public.portal_uid());

CREATE POLICY "own_delete_push_subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (portal_user_id = public.portal_uid());

-- No client INSERT policy is needed for service-role writes — service_role
-- bypasses RLS entirely, same as every SECURITY DEFINER function elsewhere
-- in this project.
