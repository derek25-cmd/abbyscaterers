-- ============================================================================
-- 03_phase2_checks.sql: Phase 2 baseline checks 3a-3c (read-only)
-- ============================================================================
--
-- READ-ONLY: three SELECTs. Run against STAGING with psql:
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/audit/03_phase2_checks.sql
-- or one at a time in a SQL Editor. Run before the Phase 2 migration and again
-- after it. Columns the migration adds (products.base_unit,
-- products.grams_per_item) are read through to_jsonb(), so the same file works
-- on both sides. Output is product names, SKUs and counts only.
--
-- Recipes link to the product catalog directly: each line of
-- recipes.ingredients carries productId (= products.id). Older lines may carry
-- only ingredientId (the ingredients table, which is empty live).
--
-- Unit families: kg, gms, g, grams -> kg | ml, l, liters -> liters |
--                item, pcs -> pcs | bunch -> bunch | anything else -> unknown
-- ============================================================================


-- 3a  Duplicate product names (lower/trim), with their SKUs and ids. The
--     recipe form lists products by name, so duplicates make the kitchen
--     guess which one to pick.
SELECT
  lower(trim(p.name))             AS name_key,
  count(*)                        AS products,
  array_agg(p.sku ORDER BY p.sku) AS skus,
  array_agg(p.id ORDER BY p.id)   AS product_ids
FROM public.products p
WHERE p.name IS NOT NULL AND trim(p.name) <> ''
GROUP BY lower(trim(p.name))
HAVING count(*) > 1
ORDER BY products DESC, name_key;


-- 3b  Recipe lines and their link to the product catalog.
WITH lines AS (
  SELECT
    r."recipeNumber"                         AS recipe_number,
    nullif(trim(x ->> 'productId'), '')      AS product_id,
    nullif(trim(x ->> 'ingredientId'), '')   AS ingredient_id
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS x
  WHERE jsonb_typeof(x) = 'object'
)
SELECT
  (SELECT count(*) FROM public.recipes)                                        AS recipes,
  (SELECT count(*) FROM public.recipes r
    WHERE CASE WHEN jsonb_typeof(r.ingredients) = 'array'
               THEN jsonb_array_length(r.ingredients) = 0 ELSE true END)       AS recipes_without_lines,
  count(*)                                                                     AS recipe_lines,
  count(*) FILTER (WHERE l.product_id IS NOT NULL AND p.id IS NOT NULL)        AS linked_to_product,
  count(*) FILTER (WHERE l.product_id IS NOT NULL AND p.id IS NULL)            AS product_not_found,
  count(*) FILTER (WHERE l.product_id IS NULL)                                 AS no_product_id,
  count(*) FILTER (WHERE l.product_id IS NULL AND l.ingredient_id IS NOT NULL) AS legacy_ingredient_only
FROM lines l
LEFT JOIN public.products p ON p.id = l.product_id;


-- 3c  Recipe lines whose unit family differs from their product's unit
--     family, and those that cannot be costed because of it.
WITH fam(unit, family) AS (
  VALUES ('kg','kg'), ('gms','kg'), ('g','kg'), ('grams','kg'),
         ('ml','liters'), ('l','liters'), ('liters','liters'),
         ('item','pcs'), ('pcs','pcs'), ('bunch','bunch')
),
lines AS (
  SELECT
    nullif(trim(x ->> 'productId'), '')   AS product_id,
    lower(trim(x ->> 'unit'))             AS recipe_unit
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS x
  WHERE jsonb_typeof(x) = 'object'
)
SELECT
  count(*)                                                                  AS linked_lines,
  count(*) FILTER (WHERE rf.family IS NULL)                                 AS recipe_unit_unknown,
  count(*) FILTER (WHERE pf.family IS NULL)                                 AS product_unit_unknown,
  count(*) FILTER (WHERE rf.family <> pf.family)                            AS family_mismatch,
  count(*) FILTER (WHERE rf.family <> pf.family
                     AND NOT (rf.family IN ('pcs', 'kg') AND pf.family IN ('pcs', 'kg')
                              AND to_jsonb(p) ->> 'grams_per_item' IS NOT NULL)) AS mismatch_not_costable
FROM lines l
JOIN public.products p ON p.id = l.product_id
LEFT JOIN fam rf ON rf.unit = l.recipe_unit
LEFT JOIN fam pf ON pf.unit = lower(trim(coalesce(to_jsonb(p) ->> 'base_unit', p.unit)));
