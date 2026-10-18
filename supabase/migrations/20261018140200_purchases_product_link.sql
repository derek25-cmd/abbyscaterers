-- Data readiness Phase 3, Step 6: a purchase can name the catalog product it
-- bought, and its unit cost becomes a dated price (ingredient_prices, source
-- 'purchase', source_ref = the purchase id).
--
-- Differences from the Phase 3 brief, to fit the live schema:
--   * product_id is TEXT (products.id is text, not uuid);
--   * the cost column is purchases.unitcost (lower case);
--   * purchases has no branch column: the price is recorded at the branch of
--     the purchase's event (purchases.event_id -> the event's region, same
--     region -> branch map as the ML exports), and at Dar es Salaam when there
--     is no event or region (decision 2026-10-18: Dar es Salaam data is used
--     for all branches).
--
-- One price row per purchase: editing the purchase updates its row, and
-- clearing the product (or a cost of 0) removes it. Stock-in purchases are
-- not linked here; their Stock In logs record the prices already.
-- The trigger never blocks saving a purchase (an unknown product is caught
-- by the foreign key before it runs; nothing else can fail).
--
-- Rollback:
--   DROP TRIGGER IF EXISTS capture_purchase_price ON public.purchases;
--   DROP FUNCTION IF EXISTS public.capture_purchase_price();
--   DELETE FROM public.ingredient_prices WHERE source = 'purchase';
--   ALTER TABLE public.purchases DROP COLUMN IF EXISTS product_id;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS product_id text REFERENCES public.products(id);

CREATE INDEX IF NOT EXISTS purchases_product_id_idx
  ON public.purchases (product_id) WHERE product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.capture_purchase_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_region text;
  v_branch text;
  v_unit   text;
BEGIN
  IF NEW.product_id IS NULL OR NOT (NEW.unitcost > 0) THEN
    DELETE FROM public.ingredient_prices
    WHERE source = 'purchase' AND source_ref = NEW.id::text;
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(trim(e.ev ->> 'region'), ''), nullif(trim(o.region), ''))
    INTO v_region
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(o."clientEvents") = 'array' THEN o."clientEvents" ELSE '[]'::jsonb END
  ) AS e(ev)
  WHERE nullif(trim(NEW.event_id), '') IS NOT NULL
    AND jsonb_typeof(e.ev) = 'object'
    AND e.ev ->> 'id' = trim(NEW.event_id)
  LIMIT 1;

  v_branch := CASE
    WHEN v_region = 'Arusha'                       THEN 'Arusha'
    WHEN v_region IN ('Dodoma', 'Mwanza', 'Mbeya') THEN 'Dodoma'
    ELSE 'Dar es Salaam'
  END;

  SELECT coalesce(nullif(trim(p.base_unit), ''), nullif(trim(p.unit), ''))
    INTO v_unit
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF v_unit IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ingredient_prices (product_id, branch, unit, unit_price, valid_from, source, source_ref)
  VALUES (NEW.product_id, v_branch, v_unit, NEW.unitcost, NEW.date, 'purchase', NEW.id::text)
  ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO UPDATE
    SET product_id = EXCLUDED.product_id,
        branch     = EXCLUDED.branch,
        unit       = EXCLUDED.unit,
        unit_price = EXCLUDED.unit_price,
        valid_from = EXCLUDED.valid_from;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_purchase_price() FROM PUBLIC;

DROP TRIGGER IF EXISTS capture_purchase_price ON public.purchases;
CREATE TRIGGER capture_purchase_price
  AFTER INSERT OR UPDATE OF product_id, unitcost, date, event_id ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.capture_purchase_price();
