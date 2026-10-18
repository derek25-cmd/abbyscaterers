-- ============================================================================
-- export-unit-gaps.sql: what the kitchen must fill in for unit conversion
-- ============================================================================
--
-- READ-ONLY. Needs migrations 20261018120000_ingredient_product_link.sql and
-- 20261018120100_units.sql. Run against STAGING with psql, writing CSV:
--
--   mkdir -p docs/data-readiness/mappings
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 --csv \
--        -f scripts/db/export-unit-gaps.sql \
--        -o docs/data-readiness/mappings/unit_gaps.csv
--
-- Two kinds of row (column gap_type):
--   product_base_unit   products with no base_unit. Fill "fill_in" with the
--                       unit the product's price is per: kg, liters, pcs or
--                       bunch. Products whose unit is g/gms/grams/ml are
--                       listed on purpose: confirm whether the price is per
--                       gram (then convert the price to per kg) or per kg.
--   unit_mismatch       recipe lines whose unit family differs from their
--                       product's (e.g. recipe in pieces, product priced per
--                       kg) and whose ingredient has no grams_per_item.
--                       fix_hint says what to fill in: for pieces <-> weight,
--                       the weight of one piece in grams (grams_per_item);
--                       for other pairs (e.g. bunch vs kg, kg vs liters) the
--                       recipe line's unit or the product's unit must change.
-- Business data only: product and ingredient names.
-- ============================================================================
WITH fam(unit, family) AS (
  VALUES ('kg','kg'), ('gms','kg'), ('g','kg'), ('grams','kg'),
         ('ml','liters'), ('l','liters'), ('liters','liters'),
         ('item','pcs'), ('pcs','pcs'), ('bunch','bunch')
),
lines AS (
  SELECT
    r."recipeNumber"                         AS recipe_number,
    r."recipeName"                           AS recipe_name,
    nullif(trim(x ->> 'ingredientId'), '')   AS ingredient_id,
    lower(trim(x ->> 'unit'))                AS recipe_unit
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS x
  WHERE jsonb_typeof(x) = 'object'
),
weight_gaps AS (
  SELECT
    i."itemNumber"                           AS ingredient_id,
    i."itemDescription"                      AS ingredient_name,
    p.sku, p.name                            AS product_name,
    coalesce(p.base_unit, p.unit)            AS product_unit,
    string_agg(DISTINCT l.recipe_unit, ', ') AS recipe_units,
    count(*)                                 AS recipe_lines,
    string_agg(DISTINCT l.recipe_name, '; ') AS recipes,
    bool_or('pcs' IN (rf.family, pf.family) AND rf.family IN ('pcs', 'kg') AND pf.family IN ('pcs', 'kg')) AS weight_vs_pieces
  FROM lines l
  JOIN public.ingredients i ON i."itemNumber" = l.ingredient_id
  JOIN public.products p    ON p.id = i.product_id
  JOIN fam rf ON rf.unit = l.recipe_unit
  JOIN fam pf ON pf.unit = lower(trim(coalesce(p.base_unit, p.unit)))
  WHERE rf.family <> pf.family
    AND i.grams_per_item IS NULL
  GROUP BY i."itemNumber", i."itemDescription", p.sku, p.name, coalesce(p.base_unit, p.unit)
)
SELECT
  'product_base_unit'::text  AS gap_type,
  p.id                       AS product_id,
  p.sku,
  p.name                     AS product_name,
  NULL::text                 AS ingredient_id,
  NULL::text                 AS ingredient_name,
  p.unit                     AS current_unit,
  NULL::text                 AS recipe_units,
  NULL::bigint               AS recipe_lines,
  NULL::text                 AS used_in_recipes,
  'unit the price is per: kg, liters, pcs or bunch'::text AS fix_hint,
  ''::text                   AS fill_in
FROM public.products p
WHERE p.base_unit IS NULL
UNION ALL
SELECT
  'unit_mismatch', NULL, w.sku, w.product_name, w.ingredient_id, w.ingredient_name,
  w.product_unit, w.recipe_units, w.recipe_lines, w.recipes,
  CASE WHEN w.weight_vs_pieces THEN 'grams per piece (grams_per_item)'
       ELSE 'change the recipe line unit or the product unit' END,
  ''
FROM weight_gaps w
ORDER BY 1, 4;
