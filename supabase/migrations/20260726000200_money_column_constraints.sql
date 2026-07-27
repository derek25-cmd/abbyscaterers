-- Standardizes serviceCharge/transportCosts to NOT NULL DEFAULT 0 with a
-- non-negative CHECK, matching the discipline already used elsewhere (e.g.
-- expenses.amount CHECK (amount > 0)). Verified against live data first:
-- zero NULLs and zero negative values currently exist in either column on
-- either table, so this applies cleanly with no backfill needed.
--
-- Note: app code (src/components/invoices/invoice-preview.tsx and the
-- booking-details-page-component.tsx proforma-creation flow) already
-- defensively treats these as nullable via `?? 0` / `?? null` — that
-- defensive code is harmless to leave in place after this migration, it
-- just becomes dead-simple rather than load-bearing.

DO $$
BEGIN
  IF to_regclass('public.proforma_invoices') IS NOT NULL THEN
    UPDATE public.proforma_invoices SET "serviceCharge" = 0 WHERE "serviceCharge" IS NULL;
    UPDATE public.proforma_invoices SET "transportCosts" = 0 WHERE "transportCosts" IS NULL;
    ALTER TABLE public.proforma_invoices ALTER COLUMN "serviceCharge" SET DEFAULT 0;
    ALTER TABLE public.proforma_invoices ALTER COLUMN "serviceCharge" SET NOT NULL;
    ALTER TABLE public.proforma_invoices ALTER COLUMN "transportCosts" SET DEFAULT 0;
    ALTER TABLE public.proforma_invoices ALTER COLUMN "transportCosts" SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proforma_invoices_service_charge_nonneg') THEN
      ALTER TABLE public.proforma_invoices ADD CONSTRAINT proforma_invoices_service_charge_nonneg CHECK ("serviceCharge" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proforma_invoices_transport_costs_nonneg') THEN
      ALTER TABLE public.proforma_invoices ADD CONSTRAINT proforma_invoices_transport_costs_nonneg CHECK ("transportCosts" >= 0);
    END IF;
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    UPDATE public.invoices SET "serviceCharge" = 0 WHERE "serviceCharge" IS NULL;
    UPDATE public.invoices SET "transportCosts" = 0 WHERE "transportCosts" IS NULL;
    ALTER TABLE public.invoices ALTER COLUMN "serviceCharge" SET DEFAULT 0;
    ALTER TABLE public.invoices ALTER COLUMN "serviceCharge" SET NOT NULL;
    ALTER TABLE public.invoices ALTER COLUMN "transportCosts" SET DEFAULT 0;
    ALTER TABLE public.invoices ALTER COLUMN "transportCosts" SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_service_charge_nonneg') THEN
      ALTER TABLE public.invoices ADD CONSTRAINT invoices_service_charge_nonneg CHECK ("serviceCharge" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_transport_costs_nonneg') THEN
      ALTER TABLE public.invoices ADD CONSTRAINT invoices_transport_costs_nonneg CHECK ("transportCosts" >= 0);
    END IF;
  END IF;
END $$;
