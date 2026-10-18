-- Data readiness Phase 3, Step 6: dated price history per product and branch.
--
-- Until now a product had one price per branch (products."unitPrice_dar" /
-- "_arusha" / "_dodoma"), overwritten on every change, so the cost of a menu
-- on a past date could not be known. ingredient_prices keeps every price with
-- the date it applies from:
--   * every new Stock In with a price is copied in by a trigger (source
--     'stock_in', source_ref = the stock log id);
--   * history and today's catalog prices are loaded by
--     20261018140100_ingredient_prices_backfill.sql.
--
-- Differences from the Phase 3 brief, to fit the live schema:
--   * product_id is TEXT: products.id is text ('PROD' + 8 hex), not uuid;
--   * products' price columns are "unitPrice_dar", "unitPrice_arusha",
--     "unitPrice_dodoma"; stock logs use "productId", type 'Stock In',
--     actual_unit_price, date and branch.
--
-- The trigger never blocks a Stock In: rows it cannot record (product no
-- longer in the catalog, branch outside the three, no unit) are skipped.
-- Staff can read prices; nobody can write them directly (no insert / update
-- policies): rows arrive only through the trigger and the backfill.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS capture_stock_price ON public.stock_logs;
--   DROP FUNCTION IF EXISTS public.capture_stock_price();
--   DROP FUNCTION IF EXISTS public.prices_on(text, date);
--   DROP FUNCTION IF EXISTS public.price_on(text, text, date);
--   DROP TABLE IF EXISTS public.ingredient_prices;

CREATE TABLE IF NOT EXISTS public.ingredient_prices (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  text NOT NULL REFERENCES public.products(id),
  branch      text NOT NULL CHECK (branch IN ('Dar es Salaam', 'Arusha', 'Dodoma')),
  unit        text NOT NULL,
  unit_price  numeric(12,2) NOT NULL CHECK (unit_price > 0),
  valid_from  date NOT NULL,
  source      text NOT NULL CHECK (source IN ('stock_in', 'purchase', 'manual', 'backfill')),
  source_ref  text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingredient_prices_lookup_idx
  ON public.ingredient_prices (product_id, branch, valid_from DESC);

-- One row per source record: backfills and triggers can never duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_prices_source_ref_key
  ON public.ingredient_prices (source, source_ref)
  WHERE source_ref IS NOT NULL;

ALTER TABLE public.ingredient_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ingredient_prices_staff_select ON public.ingredient_prices;
CREATE POLICY ingredient_prices_staff_select ON public.ingredient_prices
  FOR SELECT TO authenticated USING (public.is_active_staff());

-- Latest price of one product at one branch on a date (NULL if none yet).
-- Ties on the same date: the most recently recorded row wins.
CREATE OR REPLACE FUNCTION public.price_on(p_product text, p_branch text, p_date date)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT ip.unit_price
  FROM public.ingredient_prices ip
  WHERE ip.product_id = p_product
    AND ip.branch = p_branch
    AND ip.valid_from <= p_date
  ORDER BY ip.valid_from DESC, ip.id DESC
  LIMIT 1;
$$;

-- Latest price of every product at one branch on a date, in one call.
CREATE OR REPLACE FUNCTION public.prices_on(p_branch text, p_date date)
RETURNS TABLE (product_id text, unit_price numeric, unit text, valid_from date)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (ip.product_id)
         ip.product_id, ip.unit_price, ip.unit, ip.valid_from
  FROM public.ingredient_prices ip
  WHERE ip.branch = p_branch
    AND ip.valid_from <= p_date
  ORDER BY ip.product_id, ip.valid_from DESC, ip.id DESC;
$$;

CREATE OR REPLACE FUNCTION public.capture_stock_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'Stock In' AND NEW.actual_unit_price > 0
     AND NEW.branch IN ('Dar es Salaam', 'Arusha', 'Dodoma') THEN
    INSERT INTO public.ingredient_prices (product_id, branch, unit, unit_price, valid_from, source, source_ref)
    SELECT p.id, NEW.branch, coalesce(nullif(trim(p.base_unit), ''), nullif(trim(p.unit), '')),
           NEW.actual_unit_price, coalesce(NEW.date, (NEW."createdAt" AT TIME ZONE 'Africa/Dar_es_Salaam')::date, current_date),
           'stock_in', NEW.id
    FROM public.products p
    WHERE p.id = NEW."productId"
      AND coalesce(nullif(trim(p.base_unit), ''), nullif(trim(p.unit), '')) IS NOT NULL
    ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_stock_price() FROM PUBLIC;

DROP TRIGGER IF EXISTS capture_stock_price ON public.stock_logs;
CREATE TRIGGER capture_stock_price
  AFTER INSERT ON public.stock_logs
  FOR EACH ROW EXECUTE FUNCTION public.capture_stock_price();
