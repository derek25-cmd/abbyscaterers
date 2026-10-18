-- ============================================================================
-- 30_ml_stock_movements.sql: one row per stock movement (costing dataset)
-- ============================================================================
--
-- READ-ONLY: a single SELECT. Run it in the Supabase SQL Editor, export the
-- result as CSV and save it as  ml-data/ml_stock_movements.csv  (gitignored).
--
-- Source: stock_logs (Stock In = purchases received, Stock Out = issued to
-- the kitchen). What the audit found (docs/data-readiness/02-…md):
--   * Stock Out is the dependable record: logged every month since Oct 2025,
--     always priced. Stock In has gaps (Jul and Sep 2026 almost empty).
--   * branch is only trustworthy from 2026-09-01. Before that, usage at
--     Arusha and Dodoma was filed under the default 'Dar es Salaam'
--     (flag_branch_unreliable).
--   * The same product is sometimes priced per pack and sometimes per unit
--     (e.g. cooking oil 4,500 vs 102,000). flag_price_outlier marks prices
--     more than 5x away from that product's median in the same branch and
--     type; it does not correct them.
--   * stock_logs.price is the line total; actual_unit_price is the unit price.
--
-- If the editor cuts the export off, narrow the date range in "params".
-- ============================================================================
WITH params AS (
  SELECT DATE '2000-01-01' AS from_date,   -- edit to export in parts
         DATE '2100-12-31' AS to_date,
         DATE '2026-09-01' AS branch_reliable_from,
         5::numeric        AS outlier_factor
),
s AS (
  SELECT
    st.id                                                    AS stock_log_id,
    st.date,
    st.type,
    coalesce(nullif(to_jsonb(st) ->> 'branch', ''), '(none)') AS branch,
    nullif(trim(st."productId"), '')                         AS product_id,
    st."productName"                                         AS product_name,
    trim(regexp_replace(lower(coalesce(st."productName", '')), '\s+', ' ', 'g')) AS product_key,
    CASE WHEN to_jsonb(st) ->> 'quantity' ~ '^-?\d+(\.\d+)?$'
         THEN (to_jsonb(st) ->> 'quantity')::numeric END     AS quantity,
    CASE WHEN to_jsonb(st) ->> 'actual_quantity' ~ '^-?\d+(\.\d+)?$'
         THEN (to_jsonb(st) ->> 'actual_quantity')::numeric END AS actual_quantity,
    CASE WHEN to_jsonb(st) ->> 'actual_unit_price' ~ '^-?\d+(\.\d+)?$'
         THEN nullif((to_jsonb(st) ->> 'actual_unit_price')::numeric, 0) END AS unit_price,
    CASE WHEN to_jsonb(st) ->> 'price' ~ '^-?\d+(\.\d+)?$'
         THEN (to_jsonb(st) ->> 'price')::numeric END        AS line_value,
    st.reason,
    st.status,
    coalesce(st.reason, '') ILIKE 'Branch Transfer%'         AS is_transfer
  FROM public.stock_logs st
  CROSS JOIN params prm
  WHERE st.date BETWEEN prm.from_date AND prm.to_date
),
medians AS (
  SELECT product_key, branch, type,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY unit_price) AS median_unit_price
  FROM s
  WHERE unit_price IS NOT NULL
  GROUP BY product_key, branch, type
)
SELECT
  s.stock_log_id,
  s.date,
  extract(isodow FROM s.date)::int                           AS weekday_iso,
  to_char(s.date, 'YYYY-MM')                                 AS month,
  s.type,
  s.branch,
  s.product_id,
  s.product_name,
  s.product_key,
  nullif(to_jsonb(p) ->> 'category', '')                     AS product_category,
  nullif(to_jsonb(p) ->> 'unit', '')                         AS product_unit,
  s.quantity,
  s.actual_quantity,
  s.unit_price,
  s.line_value,
  round(m.median_unit_price::numeric, 2)                     AS median_unit_price_same_product,
  s.reason,
  s.status,
  s.is_transfer,
  (s.date < prm.branch_reliable_from)                        AS flag_branch_unreliable,
  (s.product_id IS NULL)                                     AS flag_no_product_id,
  (p.id IS NULL AND s.product_id IS NOT NULL)                AS flag_product_not_in_catalogue,
  (s.unit_price IS NULL)                                     AS flag_no_unit_price,
  coalesce(s.unit_price > m.median_unit_price * prm.outlier_factor
        OR s.unit_price < m.median_unit_price / prm.outlier_factor, false) AS flag_price_outlier
FROM s
CROSS JOIN params prm
LEFT JOIN public.products p ON p.id = s.product_id
LEFT JOIN medians m ON m.product_key = s.product_key AND m.branch = s.branch AND m.type = s.type
ORDER BY s.date, s.type, s.branch, s.product_key;
