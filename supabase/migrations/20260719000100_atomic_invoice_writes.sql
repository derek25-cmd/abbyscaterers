-- Wraps the two non-atomic multi-step writes in invoiceService.ts (create
-- invoice + mark proforma invoiced; delete invoice + revert proforma) in a
-- single DB transaction each, so a crash/network failure between the two
-- steps can no longer leave an invoice and its proforma's isInvoiced flag
-- out of sync. A single SQL function call is one transaction in Postgres —
-- any exception inside rolls back everything the function did.
--
-- Uses jsonb_populate_record against the real invoices row type rather than
-- a hardcoded column list, since this project's live schema has repeatedly
-- diverged from what git history assumed — this stays correct as long as
-- the JSON keys match real column names, without needing to enumerate them.
--
-- Column names verified against the live database's PostgREST OpenAPI
-- schema (information_schema isn't exposed via the REST API) before writing
-- this: invoices/proforma_invoices genuinely use camelCase quoted columns
-- (unlike `sales`, which turned out to be unquoted/lowercase — see
-- src/services/saleService.ts). "clientId" is deliberately NOT enforced
-- NOT NULL here — orphan handling is the FK migration's job
-- (20260719000000_add_client_foreign_keys.sql), not this one's.

CREATE OR REPLACE FUNCTION public.create_invoice_from_proforma(p_invoice jsonb)
RETURNS public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_proforma_id TEXT := p_invoice->>'proformaId';
  v_existing_id TEXT;
  v_result public.invoices;
BEGIN
  IF v_proforma_id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.delete_invoice_and_revert_proforma(p_invoice_id TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_proforma_id TEXT;
BEGIN
  SELECT "proformaId" INTO v_proforma_id FROM public.invoices WHERE id = p_invoice_id;

  DELETE FROM public.invoices WHERE id = p_invoice_id;

  IF v_proforma_id IS NOT NULL THEN
    UPDATE public.proforma_invoices
    SET "isInvoiced" = false, "updatedAt" = now()
    WHERE id = v_proforma_id;
  END IF;
END;
$$;
