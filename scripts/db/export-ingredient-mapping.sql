-- ============================================================================
-- export-ingredient-mapping.sql: unlinked ingredients, with product
-- suggestions, for Abby's operations staff to map by hand
-- ============================================================================
--
-- READ-ONLY. Needs migration 20261018120000_ingredient_product_link.sql.
-- Run against STAGING (or, later, production) with psql, writing CSV:
--
--   mkdir -p docs/data-readiness/mappings
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 --csv \
--        -f scripts/db/export-ingredient-mapping.sql \
--        -o docs/data-readiness/mappings/ingredient_product_mapping.csv
--
-- docs/data-readiness/mappings/ is gitignored. The file holds ingredient and
-- product names and SKUs only.
--
-- Operations staff fill in chosen_sku (the SKU of the product the ingredient
-- is bought as) and leave everything else unchanged. Blank = not decided yet.
-- Then load it with scripts/db/apply-ingredient-mapping.sh.
--
-- Suggestions: pg_trgm is not installed on this project (checked in
-- supabase/schema/live_schema_2026-10-18.sql), so they are ranked by token
-- matching: the number of words (3+ letters) of the ingredient name found in
-- the product name, then the shorter product name first. Only products with
-- a SKU are suggested, because the mapping is by SKU.
-- ============================================================================
WITH unlinked AS (
  SELECT i."itemNumber", i."itemDescription", i."itemClassification"
  FROM public.ingredients i
  WHERE i.product_id IS NULL
),
usage AS (
  SELECT nullif(trim(x ->> 'ingredientId'), '') AS ingredient_id, count(*) AS times_used
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS x
  WHERE jsonb_typeof(x) = 'object'
  GROUP BY 1
),
tokens AS (
  SELECT u."itemNumber", t AS token
  FROM unlinked u
  CROSS JOIN LATERAL regexp_split_to_table(lower(u."itemDescription"), '[^a-z0-9]+') AS t
  WHERE length(t) >= 3
),
scored AS (
  SELECT
    tk."itemNumber",
    p.sku,
    p.name,
    count(*) AS hits,
    row_number() OVER (PARTITION BY tk."itemNumber"
                       ORDER BY count(*) DESC, length(p.name), p.name) AS rnk
  FROM tokens tk
  JOIN public.products p
    ON p.sku IS NOT NULL AND trim(p.sku) <> ''
   AND p.name ILIKE '%' || tk.token || '%'
  GROUP BY tk."itemNumber", p.sku, p.name
)
SELECT
  u."itemNumber"                                         AS "itemNumber",
  u."itemDescription"                                    AS "itemDescription",
  u."itemClassification"                                 AS "itemClassification",
  coalesce(us.times_used, 0)                             AS times_used_in_recipes,
  max(s.sku)  FILTER (WHERE s.rnk = 1)                   AS suggestion_1_sku,
  max(s.name) FILTER (WHERE s.rnk = 1)                   AS suggestion_1_name,
  max(s.sku)  FILTER (WHERE s.rnk = 2)                   AS suggestion_2_sku,
  max(s.name) FILTER (WHERE s.rnk = 2)                   AS suggestion_2_name,
  max(s.sku)  FILTER (WHERE s.rnk = 3)                   AS suggestion_3_sku,
  max(s.name) FILTER (WHERE s.rnk = 3)                   AS suggestion_3_name,
  ''::text                                               AS chosen_sku
FROM unlinked u
LEFT JOIN usage us ON us.ingredient_id = u."itemNumber"
LEFT JOIN scored s ON s."itemNumber" = u."itemNumber" AND s.rnk <= 3
GROUP BY u."itemNumber", u."itemDescription", u."itemClassification", us.times_used
ORDER BY times_used_in_recipes DESC, u."itemDescription";
