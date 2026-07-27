-- Adds missing FK constraints from financial tables back to clients.id.
--
-- Verified against the live database via the PostgREST OpenAPI schema
-- (information_schema isn't exposed through the REST API, so this was the
-- available introspection path) before writing this migration:
--   - orders.client_id already has a FK to clients.id — confirmed via the
--     OpenAPI spec's <fk table='clients' column='id'/> annotation. Skipped
--     here; adding it again would fail with "constraint already exists".
--   - proforma_invoices.clientId and invoices.clientId have ONE orphaned
--     row each (both referencing clientId '596200', which does not exist
--     in clients — proforma 0015072 / invoice 0013385, created together on
--     2026-07-02, both with an empty receiverName — looks like a single
--     mistaken/test entry, not widespread corruption). Added as NOT VALID
--     so existing rows aren't blocked; new writes are enforced immediately.
--     Run VALIDATE CONSTRAINT once that pair is investigated/fixed.
--   - sales.customerid (yes, unquoted/lowercase in the live schema, not
--     customerId or customer_id — confirmed via OpenAPI) had zero rows at
--     migration time, so it gets a normal (validated) FK.
--
-- ON DELETE RESTRICT, not CASCADE: deleting a client should never silently
-- delete their financial history. clientService.deleteClient() also gets an
-- app-level guard for a friendlier error message before this constraint
-- would ever reject the delete.

DO $$
BEGIN
  IF to_regclass('public.proforma_invoices') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'proforma_invoices_client_id_fkey'
     )
  THEN
    ALTER TABLE public.proforma_invoices
      ADD CONSTRAINT proforma_invoices_client_id_fkey
      FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON DELETE RESTRICT
      NOT VALID;
    RAISE NOTICE 'Added NOT VALID FK proforma_invoices.clientId -> clients.id (1 known orphan: clientId 596200, proforma 0015072)';
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'invoices_client_id_fkey'
     )
  THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_client_id_fkey
      FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON DELETE RESTRICT
      NOT VALID;
    RAISE NOTICE 'Added NOT VALID FK invoices.clientId -> clients.id (1 known orphan: clientId 596200, invoice 0013385)';
  END IF;

  IF to_regclass('public.sales') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'sales_customerid_fkey'
     )
  THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_customerid_fkey
      FOREIGN KEY (customerid) REFERENCES public.clients(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added FK sales.customerid -> clients.id';
  END IF;
END $$;
