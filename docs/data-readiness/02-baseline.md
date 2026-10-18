# Data readiness 02: Phase 2 baseline

The baseline Phase 2 (make costing correct) is measured against. The
"Before" numbers come from the **read-only audit run on production on
2026-10-18** (`supabase/audit/01_schema_audit.sql`, `02_baseline_quality.sql`
and the follow-up queries). The plan asked for them to be measured on
staging, but no staging project exists yet. Staging would be a copy of the
same data, so the numbers are the same. Checks 3a–3c are new and still need
running (`supabase/audit/03_phase2_checks.sql`). Fill in **After phase 2**
by re-running the same queries once the migrations and mappings are applied.

## Summary

| Check | Before (2026-10-18) | Notes | After phase 2 |
| --- | --- | --- | --- |
| Events (all months) | 2,713 | in 2,051 orders | |
| Events with bad pax (missing, non-numeric or ≤ 0) | **0** | | |
| Events with zero / missing price | **17** | Apr 1, May 7, Jul 2, Oct 7 | |
| Events with no recipes | **2,713 (100%)** | Events never carry recipes; dishes are recorded in `daily_menus` instead. Not a costing input. | |
| Cancelled events | 1 | | |
| Events with an unreadable date | 1 | | |
| Duplicate event IDs | **0** | No missing ids either | |
| Unpriced recipe ingredients (check C) | **0 lines** | Not because costing works: **all 404 recipes have no ingredient lines, and `ingredients` has 0 rows.** There is nothing to price yet. | |
| Daily-menu dishes without a recipe link | **160 of 14,503 (1.1%)** | March 49.6%, then under 1% every month (table below) | |
| Stock In rows (price history) | 650 | Dar 509 rows / 9 months; Arusha 61 / 2; Dodoma 80 / 3. 7 rows without a unit price. Gaps: July 1 row and September 2 rows across all branches. Pack-size outliers up to 143× (e.g. ndizi moshi 350–50,000) | |
| 3a. Duplicate product names | *to run* | `03_phase2_checks.sql` 3a. Duplicates are never auto-linked. | |
| 3b. Recipe lines linked to a catalog product | **0 of 0 lines** | Recipes now link to the product catalog directly (line `productId`), not through `ingredients`. 404 recipes, all without lines. | |
| 3c. Recipe lines whose unit family differs from their product's | **0 of 0 lines** | No recipe lines exist | |

## Events by month (check A)

| Month | Events | Bad pax | Zero price | No recipes | Cancelled | After phase 2 |
| --- | --- | --- | --- | --- | --- | --- |
| unreadable date | 1 | 0 | 0 | 1 | 0 | |
| 2025-01 | 1 | 0 | 0 | 1 | 0 | |
| 2025-09 | 1 | 0 | 0 | 1 | 0 | |
| 2025-10 | 3 | 0 | 0 | 3 | 0 | |
| 2025-11 | 7 | 0 | 0 | 7 | 0 | |
| 2026-01 | 23 | 0 | 0 | 23 | 0 | |
| 2026-02 | 48 | 0 | 0 | 48 | 0 | |
| 2026-03 | 130 | 0 | 0 | 130 | 0 | |
| 2026-04 | 360 | 0 | 1 | 360 | 0 | |
| 2026-05 | 402 | 0 | 7 | 402 | 0 | |
| 2026-06 | 439 | 0 | 0 | 439 | 0 | |
| 2026-07 | 419 | 0 | 2 | 419 | 1 | |
| 2026-08 | 366 | 0 | 0 | 366 | 0 | |
| 2026-09 | 348 | 0 | 0 | 348 | 0 | |
| 2026-10 (to 18th) | 159 | 0 | 7 | 159 | 0 | |
| 2026-11 (bookings) | 6 | 0 | 0 | 6 | 0 | |
| **Total** | **2,713** | **0** | **17** | **2,713** | **1** | |

## Daily-menu dishes without a recipe link (check D)

| Month | Dishes | Without recipeId | Of which name matches a recipe | % | After phase 2 |
| --- | --- | --- | --- | --- | --- |
| 2026-03 | 272 | 135 | 26 | 49.6% | |
| 2026-04 | 1,790 | 15 | 1 | 0.8% | |
| 2026-05 | 2,431 | 7 | 0 | 0.3% | |
| 2026-06 | 1,316 | 0 | 0 | 0.0% | |
| 2026-07 | 2,347 | 2 | 0 | 0.1% | |
| 2026-08 | 2,283 | 0 | 0 | 0.0% | |
| 2026-09 | 2,614 | 0 | 0 | 0.0% | |
| 2026-10 | 1,450 | 1 | 0 | 0.1% | |
| **Total** | **14,503** | **160** | **27** | **1.1%** | |

## Stock In price history per branch (check E)

| Branch | Rows | Months with data | Rows without unit price | After phase 2 |
| --- | --- | --- | --- | --- |
| Dar es Salaam | 509 | 9 (Nov 2025 – Aug 2026; none in Dec, 1 row in Jul, none in Sep) | 2 | |
| Arusha | 61 | 2 (May–Jun 2026) | 2 | |
| Dodoma | 80 | 3 (May, Jun, Sep 2026) | 3 | |

Widest price spreads for one product in one branch (max ÷ min unit price),
almost all pack-size mix-ups: ndizi moshi 143×, sweet potatoes 32×,
nyanya tenga 32×, eggs 27×, charcoal 26×, cooking oil 23×, potatoes 16×,
ndizi bukoba 15×, eggplant 15×, yeast 14×, coriander 13×, yam 13×, lime 10×.

## What this means for Phase 2

Recipes, not code, are the binding constraint. The Phase 2 code (recipe lines
picked from the product catalog, units, branch prices, never pricing at zero)
is in place, but until the kitchen enters ingredients for the most-served
recipes, every menu costs **TZS 0**. With Phase 2 that is now shown as incomplete ("… (no ingredients)")
instead of passing for a real total. The top 40 dishes cover 73% of
servings (`02-findings-and-ml-datasets.md` on branch
`feature/data-readiness-step-2`).

## How to re-measure

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/audit/02_baseline_quality.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/audit/03_phase2_checks.sql
```
