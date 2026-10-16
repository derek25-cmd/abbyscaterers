-- ============================================================================
-- 02_baseline_quality.sql: baseline data-quality checks (data readiness, Step 1)
-- ============================================================================
--
-- READ-ONLY. Five SELECT statements; nothing is created, changed or deleted.
--
-- HOW TO RUN (you, in the Supabase SQL Editor of the PRODUCTION project):
--   Run one check at a time (select from its "-- Check X" header down to its
--   semicolon, then Run): the editor only shows the last result. Export each
--   result as CSV into docs/data-readiness/audit-output/ (gitignored) with
--   the file name given in the header.
--
-- The output is aggregated (counts per month, branch or product) or lists
-- ids and product / dish / ingredient names. It contains no client names,
-- contacts or amounts per client. Still check before sharing.
--
-- Defensive by design:
--   * JSONB values are read only after jsonb_typeof() says what they are,
--     and text is cast to numbers or dates only after a format check
--     (nullif + regex), so one bad row cannot make a query fail.
--   * Columns the repo is not sure exist in the live database are read via
--     to_jsonb(row) ->> 'column', which returns NULL instead of an error if
--     the column is missing (e.g. orders.status, daily_menus.event_id,
--     products' per-branch prices, stock_logs.branch).
-- ============================================================================


-- Check A  Event quality by month, from orders."clientEvents".
--          One row per event month. "bad_pax" = pax missing, not a number,
--          or <= 0; "zero_price" = unitPrice missing, not a number, or 0;
--          "no_recipes" = recipes missing, not an array, or empty;
--          "cancelled" = the parent order is cancelled. Events whose date
--          cannot be read are grouped under month NULL.
--          Save as: audit-output/A_event_quality_by_month.csv
WITH orders_ok AS (
  SELECT o.id,
         to_jsonb(o) ->> 'status' AS order_status,
         o."clientEvents"         AS events
  FROM public.orders o
),
events AS (
  SELECT
    oo.id AS order_id,
    oo.order_status,
    e
  FROM orders_ok oo
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(oo.events) = 'array' THEN oo.events ELSE '[]'::jsonb END
  ) AS e
  WHERE jsonb_typeof(e) = 'object'
),
parsed AS (
  SELECT
    order_id,
    order_status,
    -- Built as first-of-month + (day - 1) and kept only if the month did not
    -- roll over, so an impossible date like 2025-02-30 becomes NULL instead
    -- of failing the cast.
    -- Nested CASE (not AND) so the casts only run on text that passed the
    -- format check: Postgres does not promise to evaluate AND left to right.
    CASE WHEN nullif(e ->> 'date', '') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])' THEN
      CASE WHEN extract(month FROM (substr(e ->> 'date', 1, 8) || '01')::date
                                   + (substr(e ->> 'date', 9, 2)::int - 1))
                = substr(e ->> 'date', 6, 2)::int
           THEN (substr(e ->> 'date', 1, 8) || '01')::date + (substr(e ->> 'date', 9, 2)::int - 1)
      END
    END                                                                     AS event_date,
    CASE jsonb_typeof(e -> 'numberOfPeople')
      WHEN 'number' THEN (e ->> 'numberOfPeople')::numeric
      WHEN 'string' THEN CASE WHEN trim(e ->> 'numberOfPeople') ~ '^-?\d+(\.\d+)?$'
                              THEN nullif(trim(e ->> 'numberOfPeople'), '')::numeric END
    END                                                                     AS pax,
    CASE jsonb_typeof(e -> 'unitPrice')
      WHEN 'number' THEN (e ->> 'unitPrice')::numeric
      WHEN 'string' THEN CASE WHEN trim(e ->> 'unitPrice') ~ '^-?\d+(\.\d+)?$'
                              THEN nullif(trim(e ->> 'unitPrice'), '')::numeric END
    END                                                                     AS unit_price,
    CASE WHEN jsonb_typeof(e -> 'recipes') = 'array'
         THEN jsonb_array_length(e -> 'recipes') ELSE 0 END                 AS recipe_count
  FROM events
)
SELECT
  date_trunc('month', event_date)::date                         AS event_month,
  count(*)                                                      AS events,
  count(*) FILTER (WHERE pax IS NULL OR pax <= 0)               AS bad_pax,
  count(*) FILTER (WHERE unit_price IS NULL OR unit_price = 0)  AS zero_price,
  count(*) FILTER (WHERE unit_price < 0)                        AS negative_price,
  count(*) FILTER (WHERE recipe_count = 0)                      AS no_recipes,
  count(*) FILTER (WHERE order_status = 'cancelled')            AS cancelled,
  count(*) FILTER (WHERE order_status IS NULL)                  AS order_status_missing,
  round(avg(pax) FILTER (WHERE pax > 0), 1)                     AS avg_pax,
  round(avg(unit_price) FILTER (WHERE unit_price > 0), 0)       AS avg_unit_price
FROM parsed
GROUP BY 1
ORDER BY 1 NULLS FIRST;


-- Check B  Duplicate event IDs: the same clientEvents[].id in more than one
--          place (across orders, or twice within one order). Event IDs were
--          generated by a race-prone "max + 1" scan before
--          20260702100000_id_counters.sql. Events with no id are counted on
--          the first row (event_id NULL).
--          Save as: audit-output/B_duplicate_event_ids.csv
WITH events AS (
  SELECT
    o.id                                      AS order_id,
    nullif(trim(e ->> 'id'), '')              AS event_id,
    CASE WHEN nullif(e ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}'
         THEN substr(e ->> 'date', 1, 10) END AS event_date
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(o."clientEvents") = 'array' THEN o."clientEvents" ELSE '[]'::jsonb END
  ) AS e
  WHERE jsonb_typeof(e) = 'object'
)
SELECT
  event_id,
  count(*)                                         AS occurrences,
  count(DISTINCT order_id)                         AS distinct_orders,
  (array_agg(DISTINCT order_id))[1:10]             AS order_ids_sample,
  (array_agg(DISTINCT event_date))[1:10]           AS event_dates_sample,
  bool_or(event_id !~ '^EVT-\d{5}$')               AS non_standard_format
FROM events
GROUP BY event_id
HAVING count(*) > 1 OR event_id IS NULL
ORDER BY (event_id IS NULL) DESC, occurrences DESC, event_id;


-- Check C  Recipe ingredients with no matching priced product.
--          Follows menuCostingService.ts: recipes.ingredients[].ingredientId
--          -> ingredients."itemNumber" -> "itemDescription" -> products.name
--          (lower/trim), priced from products."unitPrice". Shows every
--          ingredient used in a recipe where that chain breaks or the price
--          is missing/zero, and whether a branch price would have helped.
--          Save as: audit-output/C_unpriced_recipe_ingredients.csv
WITH recipe_ings AS (
  SELECT
    r."recipeNumber"                         AS recipe_number,
    nullif(trim(i ->> 'ingredientId'), '')   AS ingredient_id
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS i
  WHERE jsonb_typeof(i) = 'object'
),
products_priced AS (
  SELECT
    lower(trim(p.name))                                          AS name_key,
    count(*)                                                     AS products_with_name,
    max(CASE WHEN to_jsonb(p) ->> 'unitPrice' ~ '^-?\d+(\.\d+)?$'
             THEN (to_jsonb(p) ->> 'unitPrice')::numeric END)          AS legacy_price,
    max(CASE WHEN to_jsonb(p) ->> 'unitPrice_dar' ~ '^-?\d+(\.\d+)?$'
             THEN (to_jsonb(p) ->> 'unitPrice_dar')::numeric END)      AS price_dar,
    max(CASE WHEN to_jsonb(p) ->> 'unitPrice_arusha' ~ '^-?\d+(\.\d+)?$'
             THEN (to_jsonb(p) ->> 'unitPrice_arusha')::numeric END)   AS price_arusha,
    max(CASE WHEN to_jsonb(p) ->> 'unitPrice_dodoma' ~ '^-?\d+(\.\d+)?$'
             THEN (to_jsonb(p) ->> 'unitPrice_dodoma')::numeric END)   AS price_dodoma,
    string_agg(DISTINCT p.unit, ', ')                            AS product_units
  FROM public.products p
  WHERE p.name IS NOT NULL
  GROUP BY lower(trim(p.name))
),
chain AS (
  SELECT
    ri.ingredient_id,
    ing."itemDescription"                    AS ingredient_name,
    count(DISTINCT ri.recipe_number)         AS used_in_recipes,
    pp.name_key IS NOT NULL                  AS product_name_matched,
    pp.products_with_name,
    pp.legacy_price,
    pp.price_dar,
    pp.price_arusha,
    pp.price_dodoma,
    pp.product_units
  FROM recipe_ings ri
  LEFT JOIN public.ingredients ing ON ing."itemNumber" = ri.ingredient_id
  LEFT JOIN products_priced pp     ON pp.name_key = lower(trim(ing."itemDescription"))
  GROUP BY ri.ingredient_id, ing."itemDescription", pp.name_key, pp.products_with_name,
           pp.legacy_price, pp.price_dar, pp.price_arusha, pp.price_dodoma, pp.product_units
)
SELECT
  CASE
    WHEN ingredient_id IS NULL        THEN '1 recipe line has no ingredientId'
    WHEN ingredient_name IS NULL      THEN '2 ingredientId not in ingredients'
    WHEN NOT product_name_matched     THEN '3 no product with the same name'
    WHEN products_with_name > 1       THEN '4 several products share the name'
    WHEN coalesce(legacy_price, 0) = 0 THEN '5 product found, legacy unitPrice is 0/NULL'
    ELSE '6 ok'
  END AS problem,
  ingredient_id,
  ingredient_name,
  used_in_recipes,
  legacy_price,
  price_dar,
  price_arusha,
  price_dodoma,
  product_units
FROM chain
WHERE ingredient_id IS NULL
   OR ingredient_name IS NULL
   OR NOT product_name_matched
   OR products_with_name > 1
   OR coalesce(legacy_price, 0) = 0
ORDER BY problem, used_in_recipes DESC, ingredient_name;


-- Check D  Daily-menu dishes without a recipeId, by month.
--          daily_menus.recipes is [{rowIndex, recipeId?, name}]. The app
--          sets recipeId only when the typed dish name matches a recipe
--          name exactly (app/reports/daily-menu/page.tsx:195).
--          "name_matches_recipe" = the dish name exactly equals some
--          recipes."recipeName", i.e. the link could be recovered.
--          Save as: audit-output/D_daily_menu_missing_recipe_id.csv
WITH dishes AS (
  SELECT
    dm.menu_date,
    to_jsonb(dm) ->> 'event_id'                           AS event_id,
    nullif(trim(d ->> 'name'), '')                        AS dish_name,
    CASE WHEN jsonb_typeof(d -> 'recipeId') = 'string'
         THEN nullif(trim(d ->> 'recipeId'), '') END      AS recipe_id
  FROM public.daily_menus dm
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dm.recipes) = 'array' THEN dm.recipes ELSE '[]'::jsonb END
  ) AS d
  WHERE jsonb_typeof(d) = 'object'
),
recipe_names AS (
  SELECT DISTINCT "recipeName" AS recipe_name FROM public.recipes
),
recipe_ids AS (
  SELECT "recipeNumber" AS recipe_number FROM public.recipes
)
SELECT
  date_trunc('month', d.menu_date)::date                                   AS menu_month,
  count(*)                                                                 AS dishes,
  count(*) FILTER (WHERE d.recipe_id IS NULL)                              AS missing_recipe_id,
  count(*) FILTER (WHERE d.recipe_id IS NULL AND rn.recipe_name IS NOT NULL) AS missing_but_name_matches_recipe,
  count(*) FILTER (WHERE d.recipe_id IS NOT NULL AND ri.recipe_number IS NULL) AS recipe_id_not_in_recipes,
  count(*) FILTER (WHERE d.event_id IS NULL)                               AS menu_row_without_event_id,
  round(100.0 * count(*) FILTER (WHERE d.recipe_id IS NULL) / nullif(count(*), 0), 1) AS pct_missing
FROM dishes d
LEFT JOIN recipe_names rn ON rn.recipe_name = d.dish_name
LEFT JOIN recipe_ids  ri  ON ri.recipe_number = d.recipe_id
GROUP BY 1
ORDER BY 1;


-- Check E  "Stock In" unit-price history per branch and month.
--          stock_logs.price is the line total; actual_unit_price is the
--          unit price (stock-logs page and add-purchase-dialog.tsx). Branch
--          transfers are also logged as Stock In at the source branch's
--          price, so they are reported separately ("is_transfer") and should
--          be excluded from purchase-price history.
--          Save as: audit-output/E_stock_in_price_history.csv
WITH stock_in AS (
  SELECT
    coalesce(nullif(trim(s."productId"), ''), '(no productId)') AS product_id,
    s."productName"                                              AS product_name,
    coalesce(to_jsonb(s) ->> 'branch', '(no branch column)')     AS branch,
    s.date,
    coalesce(s.reason, '') ILIKE 'Branch Transfer%'              AS is_transfer,
    CASE WHEN to_jsonb(s) ->> 'actual_unit_price' ~ '^-?\d+(\.\d+)?$'
         THEN nullif((to_jsonb(s) ->> 'actual_unit_price')::numeric, 0) END AS unit_price,
    CASE WHEN to_jsonb(s) ->> 'quantity' ~ '^-?\d+(\.\d+)?$'
         THEN (to_jsonb(s) ->> 'quantity')::numeric END          AS quantity
  FROM public.stock_logs s
  WHERE s.type = 'Stock In'
)
SELECT
  product_id,
  product_name,
  branch,
  date_trunc('month', date)::date                            AS month,
  is_transfer,
  count(*)                                                   AS stock_in_rows,
  count(*) FILTER (WHERE unit_price IS NULL)                 AS rows_without_unit_price,
  sum(quantity)                                              AS total_quantity,
  min(unit_price)                                            AS min_unit_price,
  round(avg(unit_price), 2)                                  AS avg_unit_price,
  max(unit_price)                                            AS max_unit_price,
  round(max(unit_price) / nullif(min(unit_price), 0), 2)     AS max_over_min
FROM stock_in
GROUP BY product_id, product_name, branch, date_trunc('month', date), is_transfer
ORDER BY product_name, branch, month, is_transfer;
