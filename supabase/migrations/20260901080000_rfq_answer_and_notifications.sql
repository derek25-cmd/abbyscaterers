-- "Answer RFQ" flow: staff creates a proforma from the wizard (pre-filled
-- from the RFQ), and the same link_rfq_to_proforma() RPC the portal used
-- for manual linking now also runs from the staff/catering-system side,
-- then notifies the requesting admin.
--
-- Re-declared as SECURITY DEFINER (it was SECURITY INVOKER) because two
-- things it does now need to bypass RLS regardless of which identity
-- system is calling: the rfqs/rfq_status_history/rfq_proforma_links
-- writes (staff has no UPDATE/INSERT policy on those — only the
-- staff_read_* SELECT policies from 20260901020000 — and adding a pile of
-- staff-write policies just for this one function is more surface area
-- than tightening access at the function boundary instead), and the
-- portal_notifications insert below (a portal caller shouldn't need
-- INSERT rights into another user's notification row, and a staff caller
-- has no portal identity at all). The function's own guard clause is the
-- real access check, same as before — just broadened to accept either
-- identity, since staff now calls it too.
CREATE OR REPLACE FUNCTION public.link_rfq_to_proforma(p_rfq_id TEXT, p_proforma_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_actor TEXT := public.portal_uid();
  v_requested_by TEXT;
BEGIN
  IF NOT (public.is_active_portal_user() OR public.is_active_staff()) THEN
    RAISE EXCEPTION 'Not an active portal user or staff member';
  END IF;

  SELECT status, requested_by_id INTO v_current_status, v_requested_by
  FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'RFQ % not found', p_rfq_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proforma_invoices WHERE id = p_proforma_id) THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;

  INSERT INTO public.rfq_proforma_links (rfq_id, proforma_id, linked_by_id)
  VALUES (p_rfq_id, p_proforma_id, v_actor)
  ON CONFLICT (rfq_id, proforma_id) DO NOTHING;

  IF v_current_status IN ('draft', 'submitted', 'in_review') THEN
    UPDATE public.rfqs SET status = 'proforma_created', updated_at = now() WHERE id = p_rfq_id;

    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (p_rfq_id, v_current_status, 'proforma_created', v_actor, 'Linked to proforma ' || p_proforma_id);

    -- Notify the admin who requested this RFQ that it's been answered.
    -- Only on the actual status transition, not on a later re-link.
    IF v_requested_by IS NOT NULL THEN
      INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
      VALUES (
        v_requested_by,
        'rfq_answered',
        'Your RFQ has been answered',
        'Proforma ' || p_proforma_id || ' was created for RFQ ' || p_rfq_id || '.',
        p_rfq_id,
        p_proforma_id
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_rfq_to_proforma(TEXT, TEXT) TO authenticated;

-- ─── Portal notifications ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.portal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id TEXT NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  rfq_id TEXT REFERENCES public.rfqs(id) ON DELETE CASCADE,
  proforma_id TEXT REFERENCES public.proforma_invoices(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_recipient ON public.portal_notifications (portal_user_id, is_read);

ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;

-- Only the recipient can see or update (mark-read) their own notifications.
-- No client-side INSERT policy at all — every row is written by the
-- SECURITY DEFINER function above.
CREATE POLICY "portal_notifications_own_select" ON public.portal_notifications
  FOR SELECT TO authenticated USING (portal_user_id = public.portal_uid());

CREATE POLICY "portal_notifications_own_update" ON public.portal_notifications
  FOR UPDATE TO authenticated
  USING (portal_user_id = public.portal_uid())
  WITH CHECK (portal_user_id = public.portal_uid());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_notifications;
    END IF;
  END IF;
END $$;
