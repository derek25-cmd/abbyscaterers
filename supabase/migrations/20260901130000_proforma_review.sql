-- Proforma approve/reject: the admin-portal build prompt's Proforma
-- Module lists "approve/reject" as a core capability, but nothing in the
-- schema tracks review status at all today — only isInvoiced/isVoided
-- (20260901070000_void_proforma.sql). Approving/rejecting is what should
-- actually push the RFQ lifecycle from 'proforma_created' onward
-- (nothing today ever sets an rfq to 'approved').

ALTER TABLE public.proforma_invoices
  ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("reviewStatus" IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT REFERENCES public.portal_users(id),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- SECURITY DEFINER: the portal's only RLS access to proforma_invoices is
-- SELECT (portal_read_proforma_invoices, 20260901010000_add_rfq_proforma_link.sql)
-- — same reason link_rfq_to_proforma and void_proforma need it.
CREATE OR REPLACE FUNCTION public.approve_proforma(p_proforma_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_voided BOOLEAN;
  v_review_status TEXT;
  v_actor TEXT := public.portal_uid();
  v_rfq RECORD;
BEGIN
  IF NOT public.is_active_portal_user() THEN
    RAISE EXCEPTION 'Not an active portal user';
  END IF;

  SELECT "isVoided", "reviewStatus" INTO v_is_voided, v_review_status
  FROM public.proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF v_review_status IS NULL THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;
  IF v_is_voided THEN
    RAISE EXCEPTION 'Proforma % has been marked Uninvoiced and cannot be approved', p_proforma_id;
  END IF;
  IF v_review_status <> 'pending' THEN
    RAISE EXCEPTION 'Proforma % has already been %', p_proforma_id, v_review_status;
  END IF;

  UPDATE public.proforma_invoices
  SET "reviewStatus" = 'approved', "reviewedAt" = now(), "reviewedById" = v_actor, "updatedAt" = now()
  WHERE id = p_proforma_id;

  FOR v_rfq IN
    SELECT r.id FROM public.rfqs r
    JOIN public.rfq_proforma_links l ON l.rfq_id = r.id
    WHERE l.proforma_id = p_proforma_id AND r.status = 'proforma_created'
  LOOP
    UPDATE public.rfqs SET status = 'approved', updated_at = now() WHERE id = v_rfq.id;
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (v_rfq.id, 'proforma_created', 'approved', v_actor, 'Proforma ' || p_proforma_id || ' approved');
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_proforma(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_proforma(p_proforma_id TEXT, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_voided BOOLEAN;
  v_review_status TEXT;
  v_actor TEXT := public.portal_uid();
  v_rfq RECORD;
BEGIN
  IF NOT public.is_active_portal_user() THEN
    RAISE EXCEPTION 'Not an active portal user';
  END IF;

  SELECT "isVoided", "reviewStatus" INTO v_is_voided, v_review_status
  FROM public.proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF v_review_status IS NULL THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;
  IF v_is_voided THEN
    RAISE EXCEPTION 'Proforma % has been marked Uninvoiced and cannot be rejected', p_proforma_id;
  END IF;
  IF v_review_status <> 'pending' THEN
    RAISE EXCEPTION 'Proforma % has already been %', p_proforma_id, v_review_status;
  END IF;

  UPDATE public.proforma_invoices
  SET "reviewStatus" = 'rejected', "rejectionReason" = p_reason, "reviewedAt" = now(), "reviewedById" = v_actor, "updatedAt" = now()
  WHERE id = p_proforma_id;

  FOR v_rfq IN
    SELECT r.id FROM public.rfqs r
    JOIN public.rfq_proforma_links l ON l.rfq_id = r.id
    WHERE l.proforma_id = p_proforma_id AND r.status = 'proforma_created'
  LOOP
    UPDATE public.rfqs SET status = 'in_review', updated_at = now() WHERE id = v_rfq.id;
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (
      v_rfq.id, 'proforma_created', 'in_review', v_actor,
      'Proforma ' || p_proforma_id || ' rejected' || CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_proforma(TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'proforma_invoices'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.proforma_invoices;
    END IF;
  END IF;
END $$;
