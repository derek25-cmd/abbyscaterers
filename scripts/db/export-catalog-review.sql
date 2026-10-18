-- ============================================================================
-- export-catalog-review.sql: product catalog review sheet for operations
-- ============================================================================
--
-- READ-ONLY. Needs migration 20261018120100_units.sql. Run against STAGING
-- (or production) with psql, writing CSV:
--
--   mkdir -p docs/data-readiness/mappings
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 --csv \
--        -f scripts/db/export-catalog-review.sql \
--        -o docs/data-readiness/mappings/catalog_review.csv
--
-- One row per product, so operations can clean the catalog before the kitchen
-- picks products for recipes. Business data only: product names, units,
-- prices and stock usage counts.
--
-- Flags (true = look at this row):
--   flag_duplicate_name   another product has exactly the same name
--   flag_similar_name     another product has the same name once case,
--                         brackets, numbers and unit words (kg, gms, ltr,
--                         pcs ...) are ignored, e.g. "Cashewnuts" and
--                         "CASHEWNUTS KG"; similar_group lists them all
--   flag_unit_not_base    the unit is not kg / liters / pcs / bunch (e.g.
--                         buckets, packets): say what the price is per
--   flag_price_jumps      its Stock In unit prices vary more than 5x (often
--                         a pack price mixed with a per-unit price)
--   flag_no_branch_price  one or more branch prices are 0
--   flag_unused           never appears in stock logs
--
-- Columns for operations to fill (leave blank if nothing to change):
--   action          keep | rename | do_not_use (a duplicate) | non_food
--   new_name        when renaming
--   use_instead_sku for do_not_use: the SKU of the product to use instead
--   price_is_per    kg | liters | pcs | bunch
--   grams_per_item  weight of one piece, for items bought by the piece but
--                   used by weight (eggs, whole chicken) or the other way round
--   notes
-- ============================================================================
WITH norm AS (
  SELECT
    p.*,
    lower(trim(p.name)) AS exact_key,
    trim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p.name, '')), '[0-9]+([.,][0-9]+)?', ' ', 'g'),
        '\m(kg|kgs|g|gm|gms|gram|grams|ml|l|ltr|ltrs|litre|litres|liter|liters|pcs|pc|pkt|pkts|packet|packets|pack|packs)\M', ' ', 'g'),
      '[^a-z]+', ' ', 'g')) AS similar_key
  FROM public.products p
),
groups AS (
  SELECT
    n.*,
    count(*) OVER (PARTITION BY n.exact_key)   AS exact_group_size,
    count(*) OVER (PARTITION BY n.similar_key) AS similar_group_size
  FROM norm n
),
stock AS (
  SELECT
    s."productId"                                                     AS product_id,
    count(*) FILTER (WHERE s.type = 'Stock In')                       AS stock_in_rows,
    count(*) FILTER (WHERE s.type = 'Stock Out')                      AS stock_out_rows,
    max(s.date) FILTER (WHERE s.type = 'Stock In')                    AS last_stock_in_date,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY nullif(s.actual_unit_price, 0))
      FILTER (WHERE s.type = 'Stock In')                              AS median_stock_in_unit_price,
    max(nullif(s.actual_unit_price, 0)) FILTER (WHERE s.type = 'Stock In')
      / nullif(min(nullif(s.actual_unit_price, 0)) FILTER (WHERE s.type = 'Stock In'), 0) AS stock_in_price_ratio
  FROM public.stock_logs s
  GROUP BY s."productId"
),
last_in AS (
  SELECT DISTINCT ON (s."productId")
    s."productId" AS product_id, s.actual_unit_price AS last_stock_in_unit_price, s.branch AS last_stock_in_branch
  FROM public.stock_logs s
  WHERE s.type = 'Stock In'
  ORDER BY s."productId", s.date DESC NULLS LAST, s.id DESC
)
SELECT
  g.id                                       AS product_id,
  g.sku,
  g.name,
  g.category,
  g.unit,
  g.base_unit,
  g.grams_per_item,
  g."unitPrice_dar"                          AS price_dar,
  g."unitPrice_arusha"                       AS price_arusha,
  g."unitPrice_dodoma"                       AS price_dodoma,
  g."unitPrice"                              AS price_legacy,
  coalesce(st.stock_in_rows, 0)              AS stock_in_rows,
  coalesce(st.stock_out_rows, 0)             AS stock_out_rows,
  st.last_stock_in_date,
  li.last_stock_in_unit_price,
  li.last_stock_in_branch,
  round(st.median_stock_in_unit_price::numeric, 2) AS median_stock_in_unit_price,
  (g.exact_group_size > 1)                   AS flag_duplicate_name,
  (g.similar_group_size > 1 AND g.exact_group_size < g.similar_group_size) AS flag_similar_name,
  CASE WHEN g.similar_group_size > 1 THEN
    (SELECT string_agg(g2.name || coalesce(' [' || g2.sku || ']', ''), ' | ' ORDER BY g2.name)
       FROM groups g2 WHERE g2.similar_key = g.similar_key)
  END                                        AS similar_group,
  (g.base_unit IS NULL)                      AS flag_unit_not_base,
  coalesce(st.stock_in_price_ratio > 5, false) AS flag_price_jumps,
  (coalesce(g."unitPrice_dar", 0) <= 0 OR coalesce(g."unitPrice_arusha", 0) <= 0
     OR coalesce(g."unitPrice_dodoma", 0) <= 0) AS flag_no_branch_price,
  (st.product_id IS NULL)                    AS flag_unused,
  ''::text AS action,
  ''::text AS new_name,
  ''::text AS use_instead_sku,
  ''::text AS price_is_per,
  ''::text AS grams_per_item_fill,
  ''::text AS notes
FROM groups g
LEFT JOIN stock st  ON st.product_id = g.id
LEFT JOIN last_in li ON li.product_id = g.id
ORDER BY g.similar_key, g.name;
