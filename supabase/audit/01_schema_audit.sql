-- ============================================================================
-- 01_schema_audit.sql: live schema inventory (data readiness, Step 1)
-- ============================================================================
--
-- READ-ONLY. Every statement below is a SELECT against information_schema,
-- pg_catalog, pg_stat_user_tables, pg_class or pg_policies. Nothing here
-- creates, changes or deletes anything, and no table rows are read: the
-- output is column names, constraints, row-count estimates and policy text.
--
-- HOW TO RUN (you, in the Supabase SQL Editor of the PRODUCTION project):
--   The editor only shows the result of the LAST statement it runs, so run
--   the queries one at a time: select one query (from its "-- Qn" header
--   down to its semicolon) and press Run. Then export the result as CSV
--   and save it as
--       docs/data-readiness/audit-output/<file name given in the header>
--   That folder is gitignored. Before anything from it is committed, check
--   that it contains no personal data (policy text can contain e-mail
--   addresses if a policy hard-codes one).
--
-- Compare the results with docs/data-readiness/01-schema-inventory.md:
-- every table marked "NOT IN REPO" or "schema file only" there should
-- appear here, and Q7 lists the columns the ML steps depend on.
-- ============================================================================


-- Q1 Columns of every table and view in public.
--    Save as: audit-output/01_columns.csv
SELECT
  c.table_name,
  t.table_type,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;


-- Q2 Primary key, foreign key, unique and check constraints.
--    Save as: audit-output/02_constraints.csv
SELECT
  rel.relname                         AS table_name,
  con.conname                         AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'x' THEN 'EXCLUDE'
    ELSE con.contype::text
  END                                 AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition,
  frel.relname                        AS references_table
FROM pg_constraint con
JOIN pg_class rel      ON rel.oid = con.conrelid
JOIN pg_namespace nsp  ON nsp.oid = rel.relnamespace
LEFT JOIN pg_class frel ON frel.oid = con.confrelid
WHERE nsp.nspname = 'public'
ORDER BY rel.relname, constraint_type, con.conname;


-- Q3 Unique indexes that are not constraints (an upsert's onConflict can
--    rely on these too, e.g. daily_menus (event_id, menu_date)).
--    Save as: audit-output/03_unique_indexes.csv
SELECT
  tablename AS table_name,
  indexname AS index_name,
  indexdef  AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
ORDER BY tablename, indexname;


-- Q4 Estimated row counts and table sizes (statistics, not a full count:
--    cheap to run, and accurate enough to see which tables hold data).
--    Save as: audit-output/04_row_counts.csv
SELECT
  c.relname                                    AS table_name,
  GREATEST(c.reltuples, 0)::bigint             AS estimated_rows_pg_class,
  s.n_live_tup                                 AS live_rows_pg_stat,
  s.n_dead_tup                                 AS dead_rows_pg_stat,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  s.last_analyze,
  s.last_autoanalyze
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY s.n_live_tup DESC NULLS LAST, c.relname;


-- Q5 Row level security: enabled / forced per table, and how many
--    policies each table has.
--    Save as: audit-output/05_rls_status.csv
SELECT
  c.relname              AS table_name,
  c.relrowsecurity       AS rls_enabled,
  c.relforcerowsecurity  AS rls_forced,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relrowsecurity, c.relname;


-- Q6 Every RLS policy, with its roles and expressions.
--    Save as: audit-output/06_policies.csv
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual        AS using_expression,
  with_check  AS with_check_expression
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;


-- Q7 The columns later ML steps depend on: present or missing in the live
--    database? (docs/data-readiness/01-schema-inventory.md, section d.)
--    Both spellings are listed where the repo disagrees with itself, e.g.
--    orders start_date (what the code writes) and "startDate" (what the
--    plan names); expect one of each pair to be missing.
--    Save as: audit-output/07_ml_columns.csv
SELECT
  e.table_name,
  e.column_name,
  e.why,
  (c.column_name IS NOT NULL) AS present,
  c.data_type,
  c.udt_name,
  c.is_nullable
FROM (VALUES
  ('orders', 'id', 'order key'),
  ('orders', 'status', 'cancelled / pending filter'),
  ('orders', 'region', 'location feature'),
  ('orders', 'client_id', 'client key, as written by orderService.ts'),
  ('orders', 'clientId', 'client key, as named in the plan'),
  ('orders', 'start_date', 'order start, as written by orderService.ts'),
  ('orders', 'startDate', 'order start, as named in the plan'),
  ('orders', 'end_date', 'order end, as written by orderService.ts'),
  ('orders', 'endDate', 'order end, as named in the plan'),
  ('orders', 'clientEvents', 'events JSONB: date, pax, price, recipes'),
  ('orders', 'proforma_id', 'proforma link, as written by orderService.ts'),
  ('orders', 'proformaId', 'proforma link, as in db/schema.sql'),
  ('orders', 'booking_id', 'booking link'),
  ('stock_logs', 'productId', 'product key'),
  ('stock_logs', 'productName', 'product name (free text)'),
  ('stock_logs', 'date', 'transaction date'),
  ('stock_logs', 'type', 'Stock In / Stock Out'),
  ('stock_logs', 'quantity', 'quantity'),
  ('stock_logs', 'actual_quantity', 'quantity actually received (types/index.ts)'),
  ('stock_logs', 'price', 'line total (qty x unit price)'),
  ('stock_logs', 'actual_unit_price', 'unit price paid'),
  ('stock_logs', 'reason', 'separates purchases from branch transfers'),
  ('stock_logs', 'status', 'status'),
  ('stock_logs', 'branch', 'branch'),
  ('products', 'id', 'product key'),
  ('products', 'name', 'joined to ingredients by name in menu costing'),
  ('products', 'unit', 'unit the price is quoted in'),
  ('products', 'unitPrice', 'legacy single price used by menu costing'),
  ('products', 'unitPrice_dar', 'branch price'),
  ('products', 'unitPrice_arusha', 'branch price'),
  ('products', 'unitPrice_dodoma', 'branch price'),
  ('products', 'quantity', 'legacy total quantity'),
  ('products', 'quantity_dar', 'branch quantity'),
  ('products', 'quantity_arusha', 'branch quantity'),
  ('products', 'quantity_dodoma', 'branch quantity'),
  ('ingredients', 'itemNumber', 'ingredient key used in recipes.ingredients'),
  ('ingredients', 'itemDescription', 'name matched to products.name'),
  ('ingredients', 'units', 'JSONB of {unit, price}'),
  ('recipes', 'recipeNumber', 'recipe key'),
  ('recipes', 'recipeType', 'meal category'),
  ('recipes', 'ingredients', 'JSONB of {ingredientId, quantity, unit}'),
  ('daily_menus', 'recipes', 'JSONB of {rowIndex, recipeId, name}'),
  ('daily_menus', 'menu_date', 'menu date'),
  ('daily_menus', 'event_id', 'event key (upsert conflict target)'),
  ('daily_menus', 'order_id', 'order key'),
  ('daily_menus', 'region', 'region'),
  ('purchases', 'event_id', 'cost linked to an event'),
  ('purchases', 'unitCost', 'unit cost, as named in the plan'),
  ('purchases', 'unitcost', 'unit cost, as written by purchaseService.ts'),
  ('purchases', 'totalcost', 'line total, as written by purchaseService.ts'),
  ('purchases', 'date', 'purchase date'),
  ('invoices', 'items', 'invoice lines JSONB'),
  ('invoices', 'invoiceDate', 'invoice date'),
  ('invoices', 'status', 'paid / outstanding'),
  ('proforma_invoices', 'items', 'proforma lines JSONB'),
  ('proforma_invoices', 'isVoided', 'voided proformas to exclude')
) AS e(table_name, column_name, why)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name
ORDER BY e.table_name, e.column_name;


-- Q8 Views and functions in public (to compare with the repo's migrations).
--    Save as: audit-output/08_views_functions.csv
SELECT 'view' AS kind, table_name AS name, NULL::text AS arguments, NULL::text AS security
FROM information_schema.views
WHERE table_schema = 'public'
UNION ALL
SELECT 'function',
       p.proname,
       pg_get_function_identity_arguments(p.oid),
       CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY kind, name;
