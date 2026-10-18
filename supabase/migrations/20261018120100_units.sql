-- Data readiness Phase 2, Step 4: units.
--
-- Menu costing priced a recipe quantity per "normalised" unit without checking
-- the unit the product's price is quoted in, so a price per bunch could be
-- applied to kilograms. This adds the two facts needed to convert properly:
--
--   * products.base_unit: the unit the product's prices are per. One of
--     kg, liters, pcs, bunch. Backfilled from products.unit only where the
--     unit already IS a base unit:
--       kg -> kg     l, liters -> liters     item, pcs -> pcs     bunch -> bunch
--     g / gms / grams / ml are deliberately left NULL: a product with unit
--     'gms' is priced per gram, and labelling it 'kg' would make costing
--     1000x too low. Until the kitchen confirms these (and any other unknown
--     unit) in docs/data-readiness/mappings/unit_gaps.csv, costing falls back
--     to products.unit, which converts correctly.
--   * ingredients.grams_per_item: weight of one piece, used only to convert
--     between pieces and kilograms (e.g. a recipe asks for 3 eggs, the
--     product is priced per kg). NULL until the kitchen enters it.
--
-- Idempotent: columns and constraints are only added if missing, and the
-- backfill only fills NULL base_unit values.
--
-- Note: the backfill UPDATE fires the existing products triggers
-- (audit_row_change, set_updated_by, tr_products_updated_at), so each
-- backfilled product gets an audit_log row and a new "updatedAt".
--
-- Rollback (see docs/data-readiness/PROD-RUNBOOK-phase-2.md):
--   ALTER TABLE public.products    DROP COLUMN IF EXISTS base_unit;
--   ALTER TABLE public.ingredients DROP COLUMN IF EXISTS grams_per_item;

ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS base_unit text;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS grams_per_item numeric(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass AND conname = 'products_base_unit_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_base_unit_check
      CHECK (base_unit IS NULL OR base_unit IN ('kg', 'liters', 'pcs', 'bunch'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ingredients'::regclass AND conname = 'ingredients_grams_per_item_check'
  ) THEN
    ALTER TABLE public.ingredients
      ADD CONSTRAINT ingredients_grams_per_item_check
      CHECK (grams_per_item IS NULL OR grams_per_item > 0);
  END IF;
END $$;

UPDATE public.products
   SET base_unit = CASE lower(trim(unit))
         WHEN 'kg'     THEN 'kg'
         WHEN 'l'      THEN 'liters'
         WHEN 'liters' THEN 'liters'
         WHEN 'item'   THEN 'pcs'
         WHEN 'pcs'    THEN 'pcs'
         WHEN 'bunch'  THEN 'bunch'
       END
 WHERE base_unit IS NULL
   AND lower(trim(unit)) IN ('kg', 'l', 'liters', 'item', 'pcs', 'bunch');
