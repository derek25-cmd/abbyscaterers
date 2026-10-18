-- ============================================================================
-- export-unit-gaps.sql: what the kitchen must fill in for unit conversion
-- ============================================================================
--
-- READ-ONLY. Needs migration 20261018120100_units.sql. Run against STAGING
-- (later production) with psql, writing CSV:
--
--   mkdir -p docs/data-readiness/mappings
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 --csv \
--        -f scripts/db/export-unit-gaps.sql \
--        -o docs/data-readiness/mappings/unit_gaps.csv
--
-- Recipes link to products directly (recipe line productId), so every gap is
-- about a product. Two kinds of row (column gap_type):
--   product_base_unit   products with no base_unit. Fill "fill_in" with the
--                       unit the product's price is per: kg, liters, pcs or
--                       bunch. Products whose unit is g/gms/grams/ml are
--                       listed on purpose: confirm whether the price is per
--                       gram (then convert the price to per kg) or per kg.
--   unit_mismatch       products used in recipe lines whose unit family
--                       differs from the product's (e.g. recipe in pieces,
--                       product priced per kg) and that cannot be costed yet.
--                       fix_hint says what to fill in: for pieces <-> weight,
--                       the weight of one piece in grams (grams_per_item);
--                       for other pairs (e.g. bunch vs kg, kg vs liters) the
--                       recipe line's unit or the product's unit must change.
-- Business data only: product and recipe names.
-- ============================================================================
WITH fam(unit, family) AS (
  VALUES ('kg','kg'), ('gms','kg'), ('g','kg'), ('grams','kg'),
         ('ml','liters'), ('l','liters'), ('liters','liters'),
         ('item','pcs'), ('pcs','pcs'), ('bunch','bunch')
),
lines AS (
  SELECT
    r."recipeName"                          AS recipe_name,
    nullif(trim(x ->> 'productId'), '')     AS product_id,
    lower(trim(x ->> 'unit'))               AS recipe_unit
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS x
  WHERE jsonb_typeof(x) = 'object'
),
mismatches AS (
  SELECT
    p.id                                     AS product_id,
    p.sku,
    p.name                                   AS product_name,
    coalesce(p.base_unit, p.unit)            AS product_unit,
    string_agg(DISTINCT l.recipe_unit, ', ') AS recipe_units,
    count(*)                                 AS recipe_lines,
    string_agg(DISTINCT l.recipe_name, '; ') AS recipes,
    bool_or(rf.family IN ('pcs', 'kg') AND pf.family IN ('pcs', 'kg')) AS weight_vs_pieces
  FROM lines l
  JOIN public.products p ON p.id = l.product_id
  JOIN fam rf ON rf.unit = l.recipe_unit
  JOIN fam pf ON pf.unit = lower(trim(coalesce(p.base_unit, p.unit)))
  WHERE rf.family <> pf.family
    AND NOT (rf.family IN ('pcs', 'kg') AND pf.family IN ('pcs', 'kg') AND p.grams_per_item IS NOT NULL)
  GROUP BY p.id, p.sku, p.name, coalesce(p.base_unit, p.unit)
)
SELECT
  'product_base_unit'::text  AS gap_type,
  p.id                       AS product_id,
  p.sku,
  p.name                     AS product_name,
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
  'unit_mismatch', m.product_id, m.sku, m.product_name, m.product_unit,
  m.recipe_units, m.recipe_lines, m.recipes,
  CASE WHEN m.weight_vs_pieces THEN 'grams per piece (products.grams_per_item)'
       ELSE 'change the recipe line unit or the product unit' END,
  ''
FROM mismatches m
ORDER BY 1, 4;
