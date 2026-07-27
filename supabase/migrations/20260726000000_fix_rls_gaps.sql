-- ============================================================
-- Fixes for Supabase database linter findings (2026-07-26):
--   * rls_disabled_in_public: training_participants, service_feedback
--   * security_definer_view: marketer_live_locations, company_map_pins,
--     pending_marketer_applications, marketer_account_overview,
--     marketer_commission_summary, marketer_landed_clients
-- ============================================================

-- ── 1. RLS was never enabled on these two tables (created outside
--    the tracked migration history). Both are queried from the browser
--    via the anon-key client (trainingService.ts / feedbackService.ts),
--    so without RLS they are fully readable/writable by anyone holding
--    the public anon key. Match the "authenticated staff, full access"
--    model already used for other internal CMS tables (see
--    20260620120000_add_marketing_crm.sql).
DO $$
BEGIN
  IF to_regclass('public.training_participants') IS NOT NULL THEN
    ALTER TABLE public.training_participants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "training_participants_authenticated" ON public.training_participants;
    CREATE POLICY "training_participants_authenticated" ON public.training_participants
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.service_feedback') IS NOT NULL THEN
    ALTER TABLE public.service_feedback ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "service_feedback_authenticated" ON public.service_feedback;
    CREATE POLICY "service_feedback_authenticated" ON public.service_feedback
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 2. Views without security_invoker run with the view owner's
--    privileges and silently bypass RLS on their underlying tables
--    (marketing_users, companies, visits, commissions, ...). Switching
--    them to security_invoker makes each view re-check RLS as the
--    querying user, closing that bypass.
DO $$
BEGIN
  IF to_regclass('public.marketer_live_locations') IS NOT NULL THEN
    ALTER VIEW public.marketer_live_locations SET (security_invoker = true);
  END IF;
  IF to_regclass('public.company_map_pins') IS NOT NULL THEN
    ALTER VIEW public.company_map_pins SET (security_invoker = true);
  END IF;
  IF to_regclass('public.marketer_commission_summary') IS NOT NULL THEN
    ALTER VIEW public.marketer_commission_summary SET (security_invoker = true);
  END IF;
  IF to_regclass('public.marketer_landed_clients') IS NOT NULL THEN
    ALTER VIEW public.marketer_landed_clients SET (security_invoker = true);
  END IF;
END $$;

-- ── 3. marketer_account_overview and pending_marketer_applications carry
--    sensitive PII (NIDA/TIN numbers, disable/suspension reasons, contact
--    details). Both API routes that query them already require
--    isManager() (see src/app/api/marketing/marketers/overview/route.ts
--    and src/app/api/marketing/applications/route.ts), but that check
--    only guards the Next.js route — a direct PostgREST call with any
--    active marketing user's JWT could read them otherwise. Add a
--    manager-only gate at the DB layer so the two enforcement points
--    agree, instead of just flipping to security_invoker (which would
--    only restrict them to "any active marketing user", matching
--    marketing_users' existing is_marketing_user() policy).
CREATE OR REPLACE FUNCTION public.is_marketing_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $body$
  SELECT EXISTS (
    SELECT 1 FROM marketing_users
    WHERE email = auth.jwt() ->> 'email'
    AND is_active = true
    AND role IN ('MARKETING_MANAGER', 'ADMIN')
  );
$body$;

DO $$
BEGIN
  IF to_regclass('public.marketer_account_overview') IS NOT NULL THEN
    ALTER VIEW public.marketer_account_overview SET (security_invoker = true);
  END IF;
  IF to_regclass('public.pending_marketer_applications') IS NOT NULL THEN
    ALTER VIEW public.pending_marketer_applications SET (security_invoker = true);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.marketer_account_overview AS
SELECT
  mu.id,
  mu.full_name,
  mu.email,
  mu.google_email,
  mu.phone,
  mu.role,
  mu.is_active,
  mu.approval_status,
  mu.caution_count,
  mu.last_caution_at,
  mu.disabled_reason,
  mu.disabled_at,
  mu.suspended_until,
  mu.suspension_reason,
  mu.deleted_at,
  r.name AS region_name,
  mu.region_id,

  mp.total_visits  AS visits_this_month,
  mp.deals_won      AS deals_this_month,
  mp.avg_lead_score,

  mu.last_seen_at,
  mu.last_latitude,
  mu.last_longitude,

  (SELECT COUNT(*) FROM marketer_account_actions a
   WHERE a.marketer_id = mu.id AND a.action = 'CAUTIONED') AS total_cautions,

  (SELECT COUNT(*) FROM marketer_account_actions a
   WHERE a.marketer_id = mu.id AND a.action = 'DISABLED') AS total_disables

FROM marketing_users mu
LEFT JOIN regions r ON r.id = mu.region_id
LEFT JOIN marketing_performance mp
  ON mp.marketer_id = mu.id
  AND mp.month = EXTRACT(MONTH FROM NOW())::INTEGER
  AND mp.year  = EXTRACT(YEAR FROM NOW())::INTEGER
WHERE public.is_marketing_manager()
ORDER BY
  CASE mu.approval_status
    WHEN 'PENDING' THEN 0
    WHEN 'INCOMPLETE' THEN 1
    ELSE 2
  END,
  mu.full_name ASC;

ALTER VIEW public.marketer_account_overview SET (security_invoker = true);

CREATE OR REPLACE VIEW public.pending_marketer_applications AS
SELECT
  mu.id, mu.full_name, mu.first_name, mu.last_name,
  mu.google_email AS email, mu.google_avatar_url, mu.phone,
  mu.nida_number, mu.tin_number, mu.region_id,
  r.name AS region_name, mu.employment_type,
  mu.submitted_at, mu.approval_status, mu.onboarding_step,
  COUNT(md.id) AS document_count
FROM marketing_users mu
LEFT JOIN regions r ON r.id = mu.region_id
LEFT JOIN marketer_documents md ON md.marketer_id = mu.id
WHERE mu.approval_status = 'PENDING' AND mu.submitted_at IS NOT NULL
  AND public.is_marketing_manager()
GROUP BY mu.id, mu.full_name, mu.first_name, mu.last_name,
         mu.google_email, mu.google_avatar_url, mu.phone,
         mu.nida_number, mu.tin_number, mu.region_id,
         r.name, mu.employment_type, mu.submitted_at,
         mu.approval_status, mu.onboarding_step
ORDER BY mu.submitted_at ASC;

ALTER VIEW public.pending_marketer_applications SET (security_invoker = true);
