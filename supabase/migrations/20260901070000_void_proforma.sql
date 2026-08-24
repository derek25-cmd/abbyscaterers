-- "Mark as Uninvoiced" — for a proforma that will never be invoiced (e.g.
-- order cancellations before the event). Permanent: once voided, a
-- proforma can never be invoiced, enforced at the DB level (not just a
-- disabled button) by teaching the existing create_invoice_from_proforma()
-- RPC to reject voided proformas. Cascades to cancel every order linked to
-- that proforma (orders.status, added in 20260901040000).

-- proforma_invoices' existing columns are quoted camelCase ("clientId",
-- "invoiceDate", "isInvoiced" — confirmed against the live schema, unlike
-- orders' snake_case), so the new ones follow suit for consistency and to
-- avoid the exact camelCase/snake_case mismatch bug already hit once in
-- apps/admin-portal/src/components/rfq/rfq-detail.tsx.
ALTER TABLE public.proforma_invoices
  ADD COLUMN IF NOT EXISTS "isVoided" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "voidedReason" TEXT;

CREATE OR REPLACE FUNCTION public.void_proforma(p_proforma_id TEXT, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_invoiced BOOLEAN;
BEGIN
  SELECT "isInvoiced" INTO v_is_invoiced FROM public.proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF v_is_invoiced IS NULL THEN
    RAISE EXCEPTION 'Proforma % not found', p_proforma_id;
  END IF;
  IF v_is_invoiced THEN
    RAISE EXCEPTION 'Proforma % has already been invoiced and cannot be voided', p_proforma_id;
  END IF;

  UPDATE public.proforma_invoices
  SET "isVoided" = true, "voidedAt" = now(), "voidedReason" = p_reason, "updatedAt" = now()
  WHERE id = p_proforma_id;

  -- Cascade: every order this proforma covers is no longer going ahead.
  UPDATE public.orders
  SET status = 'cancelled', "updatedAt" = now()
  WHERE proforma_id = p_proforma_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_proforma(TEXT, TEXT) TO authenticated;

-- Defense in depth: even if a UI ever forgets to check is_voided before
-- offering "Create Final Invoice", the DB itself refuses. Re-declaring the
-- existing function (supabase/migrations/20260719000100_atomic_invoice_writes.sql)
-- with the same signature — CREATE OR REPLACE, not a new function — adding
-- exactly one guard clause at the top; every other line is unchanged.
CREATE OR REPLACE FUNCTION public.create_invoice_from_proforma(p_invoice jsonb)
RETURNS public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_proforma_id TEXT := p_invoice->>'proformaId';
  v_existing_id TEXT;
  v_is_voided BOOLEAN;
  v_result public.invoices;
BEGIN
  IF v_proforma_id IS NOT NULL THEN
    SELECT "isVoided" INTO v_is_voided FROM public.proforma_invoices WHERE id = v_proforma_id;
    IF v_is_voided THEN
      RAISE EXCEPTION 'Proforma % has been marked Uninvoiced and can never be invoiced.', v_proforma_id;
    END IF;

    SELECT id INTO v_existing_id FROM public.invoices WHERE "proformaId" = v_proforma_id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'A final invoice (%) already exists for this proforma. Open that invoice instead of creating a new one.', v_existing_id;
    END IF;
  END IF;

  INSERT INTO public.invoices
  SELECT * FROM jsonb_populate_record(NULL::public.invoices, p_invoice)
  RETURNING * INTO v_result;

  IF v_proforma_id IS NOT NULL THEN
    UPDATE public.proforma_invoices SET "isInvoiced" = true WHERE id = v_proforma_id;
  END IF;

  RETURN v_result;
END;
$$;
