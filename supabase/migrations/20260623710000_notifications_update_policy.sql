-- Mobile marketer app needs to mark its own notifications read, and needs
-- new notification types for targets. Extend the enum first (must not be
-- used in the same statement/transaction it's added in).
ALTER TYPE marketing_notification_type ADD VALUE IF NOT EXISTS 'TARGET_SET';
ALTER TYPE marketing_notification_type ADD VALUE IF NOT EXISTS 'TARGET_DUE';
ALTER TYPE marketing_notification_type ADD VALUE IF NOT EXISTS 'FOLLOW_UP_DUE';
ALTER TYPE marketing_notification_type ADD VALUE IF NOT EXISTS 'APPROVAL';
ALTER TYPE marketing_notification_type ADD VALUE IF NOT EXISTS 'MESSAGE';

-- Re-create the update policy with an explicit WITH CHECK so a marketer's
-- "mark as read" UPDATE is unambiguously allowed under RLS.
DROP POLICY IF EXISTS "notifications_update" ON public.marketing_notifications;

CREATE POLICY "notifications_update" ON public.marketing_notifications
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Both notification-producing triggers omitted marketer_id, so the rows
-- they create were invisible to the mobile app's per-marketer realtime
-- filter. Recreate them so the assigned marketer is always set.
CREATE OR REPLACE FUNCTION notify_hot_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_score >= 80 AND (OLD.lead_score IS NULL OR OLD.lead_score < 80) THEN
    INSERT INTO public.marketing_notifications (type, title, message, company_id, marketer_id)
    VALUES (
      'HOT_LEAD',
      'Hot Lead Detected',
      NEW.name || ' has reached a lead score of ' || NEW.lead_score || '/100',
      NEW.id,
      NEW.assigned_marketer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_deal_won()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pipeline_stage = 'WON' AND OLD.pipeline_stage != 'WON' THEN
    INSERT INTO public.marketing_notifications (type, title, message, company_id, marketer_id)
    VALUES (
      'DEAL_WON',
      'New Client Won!',
      NEW.name || ' has been converted to a client.',
      NEW.id,
      NEW.assigned_marketer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
