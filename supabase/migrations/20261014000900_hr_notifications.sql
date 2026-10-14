-- Phase 2: in-app notifications for HR staff (new leave request -> HR; decision
-- -> requester). Phase 4 reuses this table for contract-expiry reminders, so
-- `type` is free text and `link` says where the notification should take you.
--
-- Separate from marketing_notifications / portal_notifications, which belong to
-- other apps and other identity models.
--
-- Deliberately not audited with audit_row_change(): notifications are
-- derived messages, not records, and would only add noise to the Audit Trail.

CREATE TABLE IF NOT EXISTS public.hr_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_notifications_recipient
  ON public.hr_notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_notifications_unread
  ON public.hr_notifications (recipient_id) WHERE read_at IS NULL;

ALTER TABLE public.hr_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_notifications_select ON public.hr_notifications;
DROP POLICY IF EXISTS hr_notifications_update ON public.hr_notifications;

-- Everyone sees and clears only their own. There is no INSERT or DELETE policy:
-- rows are created exclusively by the SECURITY DEFINER functions below.
CREATE POLICY hr_notifications_select ON public.hr_notifications
  FOR SELECT TO authenticated USING (recipient_id = public.safe_auth_uid());
CREATE POLICY hr_notifications_update ON public.hr_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = public.safe_auth_uid()) WITH CHECK (recipient_id = public.safe_auth_uid());

-- A recipient may mark a notification read, not rewrite what it says.
CREATE OR REPLACE FUNCTION public.hr_notifications_only_read()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.link IS DISTINCT FROM OLD.link OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Notifications can only be marked as read.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hr_notifications_only_read ON public.hr_notifications;
CREATE TRIGGER hr_notifications_only_read
  BEFORE UPDATE ON public.hr_notifications
  FOR EACH ROW EXECUTE FUNCTION public.hr_notifications_only_read();

-- ── Writers (not callable from the API) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_user(
  p_recipient uuid, p_type text, p_title text, p_body text DEFAULT NULL, p_link text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.hr_notifications (recipient_id, type, title, body, link)
  VALUES (p_recipient, p_type, p_title, p_body, p_link);
$$;

-- Everyone who can approve: active admin, hr_manager and general_manager.
CREATE OR REPLACE FUNCTION public.notify_hr_roles(
  p_type text, p_title text, p_body text DEFAULT NULL, p_link text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.hr_notifications (recipient_id, type, title, body, link)
  SELECT s.id, p_type, p_title, p_body, p_link
  FROM public.staff_users s
  WHERE s.is_active AND s.role IN ('admin', 'hr_manager', 'general_manager');
$$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_hr_roles(text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ── New leave request -> tell HR ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_request_notify_hr()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  type_name text;
BEGIN
  SELECT name INTO type_name FROM public.leave_types WHERE id = NEW.leave_type_id;
  PERFORM public.notify_hr_roles(
    'leave_request',
    'New leave request',
    format('%s asked for %s leave, %s to %s (%s day(s)).',
           public.leave_employee_name(NEW.employee_id), type_name, NEW.start_date, NEW.end_date, NEW.days),
    '/hr/leave'
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS leave_request_notify_hr ON public.leave_requests;
CREATE TRIGGER leave_request_notify_hr
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_request_notify_hr();
