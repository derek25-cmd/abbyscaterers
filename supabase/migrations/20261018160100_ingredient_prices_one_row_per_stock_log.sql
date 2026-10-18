-- Data readiness Phase 3, Step 6: one price row per stock log.
--
-- A Stock In is recorded by the trigger (source 'stock_in') or by the
-- backfill (source 'backfill'), both with source_ref = the stock log id. The
-- unique index is on (source, source_ref), so re-running
-- 20261018140100_ingredient_prices_backfill.sql after the trigger has
-- recorded new Stock In rows would add them a second time as 'backfill'.
-- This guard skips such an insert, whichever way round, and removes any
-- double that already exists (keeping the 'stock_in' row).
--
-- Rollback:
--   DROP TRIGGER IF EXISTS ingredient_prices_one_row_per_stock_log ON public.ingredient_prices;
--   DROP FUNCTION IF EXISTS public.ingredient_prices_one_row_per_stock_log();

CREATE OR REPLACE FUNCTION public.ingredient_prices_one_row_per_stock_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source IN ('stock_in', 'backfill') AND NEW.source_ref IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.ingredient_prices ip
       WHERE ip.source_ref = NEW.source_ref
         AND ip.source IN ('stock_in', 'backfill')
         AND ip.source <> NEW.source
     ) THEN
    RETURN NULL;  -- this stock log already has its price row
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ingredient_prices_one_row_per_stock_log() FROM PUBLIC;

DROP TRIGGER IF EXISTS ingredient_prices_one_row_per_stock_log ON public.ingredient_prices;
CREATE TRIGGER ingredient_prices_one_row_per_stock_log
  BEFORE INSERT ON public.ingredient_prices
  FOR EACH ROW EXECUTE FUNCTION public.ingredient_prices_one_row_per_stock_log();

DELETE FROM public.ingredient_prices b
USING public.ingredient_prices s
WHERE b.source = 'backfill'
  AND s.source = 'stock_in'
  AND b.source_ref = s.source_ref;
