-- ============================================================
-- Phase 4 — Realtime, Live Map & Notifications
-- Abby's Legendary Caterers — Marketing & CRM Module
-- ============================================================

-- Enable Supabase Realtime on the tables that need live updates.
-- Wrapped in DO blocks so re-running this migration is safe.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_users;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_ups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Realtime UPDATE payloads only include the primary key in `old` by default.
-- The live activity feed needs the previous pipeline_stage/status to detect
-- WON transitions and completed follow-ups client-side without an extra round trip.
ALTER TABLE public.companies REPLICA IDENTITY FULL;
ALTER TABLE public.follow_ups REPLICA IDENTITY FULL;

-- View for live map: marketer locations with today's visit count
CREATE OR REPLACE VIEW marketer_live_locations AS
SELECT
  mu.id,
  mu.full_name,
  mu.email,
  mu.last_latitude,
  mu.last_longitude,
  mu.last_seen_at,
  mu.region_id,
  r.name AS region_name,
  COUNT(v.id) FILTER (
    WHERE DATE(v.check_in_time) = CURRENT_DATE
  ) AS visits_today,
  MAX(v.check_in_time) AS last_check_in
FROM marketing_users mu
LEFT JOIN regions r ON r.id = mu.region_id
LEFT JOIN visits v ON v.marketer_id = mu.id
WHERE mu.is_active = true
  AND mu.last_latitude IS NOT NULL
  AND mu.last_longitude IS NOT NULL
GROUP BY mu.id, mu.full_name, mu.email, mu.last_latitude,
         mu.last_longitude, mu.last_seen_at, mu.region_id, r.name;

-- View for map company pins with visit recency
CREATE OR REPLACE VIEW company_map_pins AS
SELECT
  c.id,
  c.name,
  c.latitude,
  c.longitude,
  c.pipeline_stage,
  c.lead_score,
  c.last_visited_at,
  c.assigned_marketer_id,
  mu.full_name AS marketer_name,
  CASE
    WHEN DATE(c.last_visited_at) = CURRENT_DATE THEN 'visited_today'
    WHEN c.last_visited_at >= NOW() - INTERVAL '7 days' THEN 'visited_week'
    WHEN c.last_visited_at IS NULL THEN 'never_visited'
    ELSE 'not_recent'
  END AS visit_recency
FROM companies c
LEFT JOIN marketing_users mu ON mu.id = c.assigned_marketer_id
WHERE c.is_active = true
  AND c.latitude IS NOT NULL
  AND c.longitude IS NOT NULL;

-- ============================================================
-- Notification centre
-- ============================================================

CREATE TYPE marketing_notification_type AS ENUM (
  'HOT_LEAD', 'DEAL_WON', 'FOLLOWUP_OVERDUE', 'FOLLOWUP_DUE_TODAY',
  'QUOTATION_REQUESTED', 'STAGE_CHANGE', 'MARKETER_INACTIVE'
);

CREATE TABLE IF NOT EXISTS public.marketing_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        marketing_notification_type NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  company_id  UUID REFERENCES public.companies(id),
  marketer_id UUID REFERENCES public.marketing_users(id),
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.marketing_notifications(is_read, created_at DESC);

ALTER TABLE public.marketing_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.marketing_notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.marketing_notifications;

CREATE POLICY "notifications_select" ON public.marketing_notifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "notifications_update" ON public.marketing_notifications
  FOR UPDATE TO authenticated USING (true);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Function: auto-create notification when a hot lead is detected
CREATE OR REPLACE FUNCTION notify_hot_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_score >= 80 AND (OLD.lead_score IS NULL OR OLD.lead_score < 80) THEN
    INSERT INTO public.marketing_notifications (type, title, message, company_id)
    VALUES (
      'HOT_LEAD',
      'Hot Lead Detected',
      NEW.name || ' has reached a lead score of ' || NEW.lead_score || '/100',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS hot_lead_trigger ON public.companies;
CREATE TRIGGER hot_lead_trigger
  AFTER UPDATE OF lead_score ON public.companies
  FOR EACH ROW EXECUTE FUNCTION notify_hot_lead();

-- Function: auto-create notification when a deal is won
CREATE OR REPLACE FUNCTION notify_deal_won()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pipeline_stage = 'WON' AND OLD.pipeline_stage != 'WON' THEN
    INSERT INTO public.marketing_notifications (type, title, message, company_id)
    VALUES (
      'DEAL_WON',
      'New Client Won!',
      NEW.name || ' has been converted to a client.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS deal_won_trigger ON public.companies;
CREATE TRIGGER deal_won_trigger
  AFTER UPDATE OF pipeline_stage ON public.companies
  FOR EACH ROW EXECUTE FUNCTION notify_deal_won();
