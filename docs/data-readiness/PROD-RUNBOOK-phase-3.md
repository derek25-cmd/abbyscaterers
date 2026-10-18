# Production runbook: data readiness Phase 3

The order for applying Phase 3 (dated price history, clean event records,
dishes linked to recipes) to production. Do it only after Phase 2 is live
(`PROD-RUNBOOK-phase-2.md`) and the branch `feature/data-readiness-phase-3`
has been reviewed. Everything below was run on staging first
(`02-baseline.md`, "Phase 3 — events" and "After phase 3").

**Merging to `main` deploys the app.** Run steps 1–3 before you merge: the
new screens call `prices_on()` and `event_quality_issues()` and write
`purchases.product_id` and `orders.is_test`.

## 1. Backup

```bash
read -rsp "Production Session pooler URL: " DB_URL; echo; export DB_URL
scripts/db/backup.sh
unset DB_URL
```

Check that it ends with file sizes, a COPY count above 0 and "Checksums
written", then move the folder to `C:\Users\Admin\SecureBackups\`.

## 2. Migrations (SQL Editor, production, in this order)

Paste each file whole and run it. Each one is idempotent: running it twice is
harmless.

| # | File | What it does | Rollback |
| --- | --- | --- | --- |
| 1 | `20261018140000_ingredient_prices.sql` | price history table, `price_on()`, `prices_on()`, Stock In trigger | `DROP TRIGGER IF EXISTS capture_stock_price ON public.stock_logs; DROP FUNCTION IF EXISTS public.capture_stock_price(); DROP FUNCTION IF EXISTS public.prices_on(text, date); DROP FUNCTION IF EXISTS public.price_on(text, text, date); DROP TABLE IF EXISTS public.ingredient_prices;` (drop the purchase trigger, #3, first) |
| 2 | `20261018140100_ingredient_prices_backfill.sql` | past Stock In prices + today's catalog prices | `DELETE FROM public.ingredient_prices WHERE source IN ('backfill', 'manual');` |
| 3 | `20261018140200_purchases_product_link.sql` | `purchases.product_id` + price trigger | `DROP TRIGGER IF EXISTS capture_purchase_price ON public.purchases; DROP FUNCTION IF EXISTS public.capture_purchase_price(); DELETE FROM public.ingredient_prices WHERE source = 'purchase'; ALTER TABLE public.purchases DROP COLUMN IF EXISTS product_id;` |
| 4 | `20261018150000_orders_is_test.sql` | `orders.is_test` (all false) | `ALTER TABLE public.orders DROP COLUMN IF EXISTS is_test;` (drop #6 first) |
| 5 | `20261018150100_event_quality_issues.sql` | `event_quality_issues()` | `DROP FUNCTION IF EXISTS public.event_quality_issues();` |
| 6 | `20261018150200_orders_is_test_admin_only.sql` | only admins may change `is_test` | `DROP TRIGGER IF EXISTS orders_is_test_admin_only ON public.orders; DROP FUNCTION IF EXISTS public.orders_is_test_admin_only();` |
| 7 | `20261018160000_dish_name_map.sql` | `dish_name_map` | `DROP TABLE IF EXISTS public.dish_name_map;` (recipeIds already written into `daily_menus` stay; they are correct) |
| 8 | `20261018160100_ingredient_prices_one_row_per_stock_log.sql` | one price row per stock log, so a re-run backfill never doubles a Stock In the trigger already recorded | `DROP TRIGGER IF EXISTS ingredient_prices_one_row_per_stock_log ON public.ingredient_prices; DROP FUNCTION IF EXISTS public.ingredient_prices_one_row_per_stock_log();` |

Rollbacks run in reverse order (8 → 1). Run #8 straight after #1 and #2 if
you can: a Stock In saved between #1 and #2 would otherwise get two rows, which
#8 also cleans up.

Check it (read-only):

```sql
SELECT source, branch, count(*) FROM public.ingredient_prices GROUP BY 1, 2 ORDER BY 1, 2;
-- staging had: backfill 504 / 58 / 77 (Dar / Arusha / Dodoma), manual 385 / 40 / 97;
-- production will be the same plus any Stock In since 2026-10-18

SELECT count(*) FROM public.orders WHERE is_test;            -- expect 0
SELECT to_regclass('public.dish_name_map');                  -- expect dish_name_map
SELECT tgname FROM pg_trigger
WHERE tgname IN ('capture_stock_price', 'capture_purchase_price', 'orders_is_test_admin_only',
                 'ingredient_prices_one_row_per_stock_log');  -- expect 4 rows
```

Running the backfill (#2) again later is harmless: with #8 in place it adds
nothing for Stock In rows the trigger has already recorded. Its catalog rows
(`seed:<product>:<branch>`) are written once, on the first run.

## 3. Confirm the test orders, then flag them

Read `04-test-orders.md` and decide which orders are tests. The 15 identical
orders ORD-00704 … ORD-00718 look like test data; ORD-00529, ORD-00548 and
ORD-00636 need a decision. Then flag them in the SQL Editor (section 3 of
that doc), or one by one after the deploy in **Orders → edit → "Exclude from
analytics (test order)"**.

Rollback: `UPDATE public.orders SET is_test = false WHERE id IN (…);`

## 4. Deploy the app

Merge the branch to `main` (this deploys `apps/catering-system`). Then check,
signed in as an admin:

- **Settings** shows a "Data Quality" card; **Open Data Quality** lists the
  events with counts at the top (about 1,418, of which "no menu" about
  1,394); a row's order link opens the order edit screen; **Export CSV**
  downloads IDs, dates, issues and suggested values only.
- **Orders → edit**: the "Exclude from analytics (test order)" switch is
  there for admins, and not for other staff.
- **Menu Costing → Cost Calculator**: a "Price Date" field (default today).
  An earlier date costs at that date's prices; the PDF shows "Price Date".
- **Finances → Purchases → Add (General)**: an optional "Product" picker.
- **Reports → Daily Menu**: each cell is a recipe picker with a note under
  it. Old free-text dishes show "no recipe" in amber and save unchanged;
  editing one turns it red until a recipe is picked.

Rollback: redeploy the previous version. The new columns and functions can
stay; the old app ignores them.

## 5. Operations: work through the Data Quality page

Admins fix the events: zero prices and pax from the suggested invoice or
proforma line, the event with no date, the one outside its order's dates,
and dishes whose recipe no longer exists. "No menu" is mostly Dodoma, Arusha
and events with no region: enter the menu for future events at every
branch. Export the CSV to share the list.

## 6. Kitchen: fill in dish_name_mapping.csv

```bash
read -rsp "Production Session pooler URL: " DB_URL; echo; export DB_URL
mkdir -p docs/data-readiness/mappings
psql "$DB_URL" -v ON_ERROR_STOP=1 --csv \
  -f scripts/db/export-dish-names.sql \
  -o docs/data-readiness/mappings/dish_name_mapping.csv
unset DB_URL
```

About 76 names (160 servings on staging). For each, write the recipe number
in `chosen_recipe_number` (one of the three suggestions or any other), or
leave it blank to skip. Keep the columns and their order as they are.
`mappings/` is gitignored.

## 7. Apply the mapping

```bash
read -rsp "Production Session pooler URL: " TARGET_DB_URL; echo; export TARGET_DB_URL
scripts/db/apply-dish-mapping.sh docs/data-readiness/mappings/dish_name_mapping.csv
unset TARGET_DB_URL
```

It shows the project ref and asks you to type it. It prints the rows
skipped (blank), the invalid recipe numbers (fix and re-run), the map rows
added, and the menus and dishes linked. Re-running it is harmless: dishes
that already have a recipe are never touched.

Rollback: there is no automatic undo for the dishes it linked; restore
`daily_menus.recipes` for those rows from the step 1 backup if needed. Map
rows: `DELETE FROM public.dish_name_map WHERE raw_name IN (…);`

## 8. Re-run the baseline (read-only)

Run `supabase/audit/02_baseline_quality.sql` in the SQL Editor, one check at
a time, and read the Data Quality page counts. Fill in the production
numbers next to the staging ones in `02-baseline.md` ("After phase 3"):
check D should drop from 160 dishes without a recipe to the names the kitchen
left blank.
