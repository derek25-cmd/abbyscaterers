-- "Send to catering system" flow: an explicit submit action instead of
-- RFQs silently sitting in 'draft' forever (submitted/in_review were dead
-- enum values nothing ever set), plus the audit-trail entry that was
-- missing at creation time.

-- Every RFQ gets an initial rfq_status_history row the moment it's
-- created, regardless of insert path. SECURITY DEFINER so this never
-- blocks the RFQ insert itself — e.g. if requested_by_id is ever null,
-- we just skip logging rather than throwing (the row still needs
-- changed_by_id = portal_uid() to satisfy rfq_status_history's own INSERT
-- policy, which wouldn't hold for a null actor).
CREATE OR REPLACE FUNCTION public.log_rfq_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.requested_by_id IS NOT NULL THEN
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.requested_by_id, 'RFQ created');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rfq_log_initial_status ON public.rfqs;
CREATE TRIGGER rfq_log_initial_status
  AFTER INSERT ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.log_rfq_created();

-- submit_rfq(): draft -> submitted. Deliberately SECURITY INVOKER (the
-- default) — unlike link_rfq_to_proforma, no cross-identity gap exists
-- here: the existing rfqs_portal_staff_all (FOR ALL) and
-- rfq_status_history_portal_staff_insert policies already give an active
-- portal user everything this needs, so running as invoker keeps this at
-- least privilege, mirroring void_proforma's style.
CREATE OR REPLACE FUNCTION public.submit_rfq(p_rfq_id TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NOT public.is_active_portal_user() THEN
    RAISE EXCEPTION 'Not an active portal user';
  END IF;

  SELECT status INTO v_status FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'RFQ % not found', p_rfq_id;
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'RFQ % has already been submitted', p_rfq_id;
  END IF;

  UPDATE public.rfqs SET status = 'submitted', updated_at = now() WHERE id = p_rfq_id;

  INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
  VALUES (p_rfq_id, 'draft', 'submitted', public.portal_uid(), 'Submitted to catering system');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_rfq(TEXT) TO authenticated;

-- Realtime: rfq_status_history was never added to the publication, so
-- admin-portal's existing subscription on it (rfq-detail.tsx) has been a
-- silent no-op. Same guarded pattern as rfqs/rfq_proforma_links above.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rfq_status_history'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rfq_status_history;
    END IF;
  END IF;
END $$;
