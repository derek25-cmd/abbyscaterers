-- Closes the gap where portal_notifications only ever got one type
-- (rfq_answered, from link_rfq_to_proforma) — proforma approval/rejection
-- and invoice/costing request fulfillment never notified anyone. Also
-- wires the same actions into portal_audit_log (20260901200000_audit_log.sql).

-- approve_proforma / reject_proforma: re-declared with the notify + audit
-- steps added — everything else is unchanged from 20260901130000_proforma_review.sql.
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

  PERFORM public.log_portal_audit_event(v_actor, 'portal', 'proforma.approved', 'proforma_invoices', p_proforma_id, NULL);

  FOR v_rfq IN
    SELECT r.id, r.requested_by_id FROM public.rfqs r
    JOIN public.rfq_proforma_links l ON l.rfq_id = r.id
    WHERE l.proforma_id = p_proforma_id AND r.status = 'proforma_created'
  LOOP
    UPDATE public.rfqs SET status = 'approved', updated_at = now() WHERE id = v_rfq.id;
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (v_rfq.id, 'proforma_created', 'approved', v_actor, 'Proforma ' || p_proforma_id || ' approved');

    IF v_rfq.requested_by_id IS NOT NULL THEN
      INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
      VALUES (
        v_rfq.requested_by_id, 'proforma_approved', 'Proforma approved',
        'Proforma ' || p_proforma_id || ' was approved.', v_rfq.id, p_proforma_id
      );
    END IF;
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

  PERFORM public.log_portal_audit_event(v_actor, 'portal', 'proforma.rejected', 'proforma_invoices', p_proforma_id, p_reason);

  FOR v_rfq IN
    SELECT r.id, r.requested_by_id FROM public.rfqs r
    JOIN public.rfq_proforma_links l ON l.rfq_id = r.id
    WHERE l.proforma_id = p_proforma_id AND r.status = 'proforma_created'
  LOOP
    UPDATE public.rfqs SET status = 'in_review', updated_at = now() WHERE id = v_rfq.id;
    INSERT INTO public.rfq_status_history (rfq_id, from_status, to_status, changed_by_id, note)
    VALUES (
      v_rfq.id, 'proforma_created', 'in_review', v_actor,
      'Proforma ' || p_proforma_id || ' rejected' || CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END
    );

    IF v_rfq.requested_by_id IS NOT NULL THEN
      INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
      VALUES (
        v_rfq.requested_by_id, 'proforma_rejected', 'Proforma rejected',
        'Proforma ' || p_proforma_id || ' was rejected' || CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '.' END,
        v_rfq.id, p_proforma_id
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_proforma(TEXT, TEXT) TO authenticated;

-- portal_invoice_requests: notify + audit-log when staff fulfills/rejects.
CREATE OR REPLACE FUNCTION public.notify_invoice_request_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('fulfilled', 'rejected') THEN
    RETURN NEW;
  END IF;

  PERFORM public.log_portal_audit_event(
    NEW.fulfilled_by_id::TEXT, 'staff', 'invoice_request.' || NEW.status,
    'portal_invoice_requests', NEW.id::TEXT, NEW.rejection_reason
  );

  IF NEW.requested_by_id IS NOT NULL THEN
    INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id, proforma_id)
    VALUES (
      NEW.requested_by_id,
      'invoice_request_' || NEW.status,
      CASE WHEN NEW.status = 'fulfilled' THEN 'Invoice generated' ELSE 'Invoice request rejected' END,
      CASE WHEN NEW.status = 'fulfilled'
        THEN 'Invoice ' || COALESCE(NEW.invoice_id, '') || ' was generated from proforma ' || NEW.proforma_id || '.'
        ELSE 'Your invoice request for proforma ' || NEW.proforma_id || ' was rejected' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ': ' || NEW.rejection_reason ELSE '.' END
      END,
      NEW.rfq_id, NEW.proforma_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portal_invoice_requests_notify ON public.portal_invoice_requests;
CREATE TRIGGER portal_invoice_requests_notify
  AFTER UPDATE ON public.portal_invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_request_change();

-- portal_costing_requests: same shape.
CREATE OR REPLACE FUNCTION public.notify_costing_request_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('fulfilled', 'rejected') THEN
    RETURN NEW;
  END IF;

  PERFORM public.log_portal_audit_event(
    NEW.fulfilled_by_id::TEXT, 'staff', 'costing_request.' || NEW.status,
    'portal_costing_requests', NEW.id::TEXT, NEW.rejection_reason
  );

  IF NEW.requested_by_id IS NOT NULL THEN
    INSERT INTO public.portal_notifications (portal_user_id, type, title, body, rfq_id)
    VALUES (
      NEW.requested_by_id,
      'costing_request_' || NEW.status,
      CASE WHEN NEW.status = 'fulfilled' THEN 'Costing report ready' ELSE 'Costing request rejected' END,
      CASE WHEN NEW.status = 'fulfilled'
        THEN 'Costing for RFQ ' || NEW.rfq_id || ' is ready — margin ' || COALESCE(NEW.gross_margin_pct::TEXT, '—') || '%.'
        ELSE 'Your costing request for RFQ ' || NEW.rfq_id || ' was rejected' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ': ' || NEW.rejection_reason ELSE '.' END
      END,
      NEW.rfq_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portal_costing_requests_notify ON public.portal_costing_requests;
CREATE TRIGGER portal_costing_requests_notify
  AFTER UPDATE ON public.portal_costing_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_costing_request_change();
