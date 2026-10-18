-- Data readiness Phase 2, Step 3: link every ingredient to the product it is
-- bought as.
--
-- Until now menu costing found an ingredient's price by matching
-- ingredients."itemDescription" to products.name (lower/trim). Any spelling
-- difference, or two products with the same name, silently costed the
-- ingredient at 0. From here an ingredient points at its product by id.
--
--   * ingredients.product_id: NULL means "not linked yet". It is `text`, not
--     `uuid`: the live products.id is text (e.g. 'PROD3f2a91c0'), see
--     supabase/schema/live_schema_2026-10-18.sql. ON DELETE SET NULL, so
--     removing a product unlinks its ingredients instead of deleting them.
--   * Backfill: only an exact lower(trim()) name match, and only where
--     exactly ONE product has that name. Duplicate names are never
--     auto-linked; they go to the manual mapping sheet
--     (scripts/db/export-ingredient-mapping.sql).
--   * Already-linked ingredients are never overwritten, so re-running this
--     file changes nothing.
--
-- Rollback (see docs/data-readiness/PROD-RUNBOOK-phase-2.md):
--   ALTER TABLE public.ingredients DROP COLUMN IF EXISTS product_id;
-- (drops the index and foreign key with it).

ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS product_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ingredients'::regclass AND conname = 'ingredients_product_id_fkey'
  ) THEN
    ALTER TABLE public.ingredients
      ADD CONSTRAINT ingredients_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ingredients_product_id ON public.ingredients (product_id);

-- Backfill: unique exact-name matches only.
WITH unique_names AS (
  SELECT lower(trim(p.name)) AS name_key, min(p.id) AS product_id
  FROM public.products p
  WHERE p.name IS NOT NULL AND trim(p.name) <> ''
  GROUP BY lower(trim(p.name))
  HAVING count(*) = 1
)
UPDATE public.ingredients i
   SET product_id = u.product_id
  FROM unique_names u
 WHERE i.product_id IS NULL
   AND lower(trim(i."itemDescription")) = u.name_key;
