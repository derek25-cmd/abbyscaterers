# Data readiness 02: Phase 2 baseline

The baseline Phase 2 (make costing correct) is measured against. The
"Before" numbers come from the **read-only audit run on production on
2026-10-18**, and were **re-measured on staging** (project
`vpxiyxrnrhiukaazztol`, restored from the 2026-10-18 backup) with
`supabase/audit/02_baseline_quality.sql` and `03_phase2_checks.sql`. Every
number matched. Fill in **After phase 2** by re-running the same queries once
the kitchen has entered recipes.

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
| 3a. Duplicate product names | **4 names, 8 products** | Exact (case/space-insensitive): ndizi mbivu, nyanya chungu, prawns, raha cocoa. Counting near-duplicates as well (`catalog_review.csv`): 9 groups, 23 products, e.g. Cashewnuts / CASHEWNUTS KG, six chicken weight classes, Maize flour / MAIZE FLOUR 25 KG | |
| Products with a price, by branch | **Dar 385, Arusha 40, Dodoma 97 of 387** | Costing outside Dar is mostly "no price" until branch prices are filled | |
| Products whose unit is not a base unit | **82 of 387** | buckets, packs, packets, bottles, bags, cartons, tins, gallons, drum, piece; listed in `unit_gaps.csv` | |
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

## Phase 3 — events

`event_quality_issues()` (migration `20261018150100`) run on staging on
2026-10-18, as an admin. It leaves out test orders (none flagged yet) and
cancelled orders. **1,418 events** have at least one issue:

| Issue | Events | Notes |
| --- | --- | --- |
| no menu | 1,394 | past events with no daily menu with dishes (by `event_id`, or order + date for mistyped ids) |
| unit price = 0 | 17 | Apr 1, May 7, Jul 2, Oct 7 |
| recipe id not found | 9 | Mar 2, Apr 7: dishes whose recipeId is not a recipe |
| no date | 1 | EVT-01287 |
| date outside order dates | 1 | EVT-03105 (2026-10-05) |
| pax <= 0 | 0 | |
| no meal type | 0 | |
| duplicate event id | 0 | see `05-duplicate-events.md` |

**Against baseline check A** (2,713 events):

- *zero price* 17 = 17, *bad pax* 0 = 0, *unreadable date* 1 = 1. They agree:
  the one cancelled event (July) has a price, pax and date, so excluding it
  changes nothing.
- *no recipes* (A) 2,713 vs *no menu* 1,394. Check A counts
  `clientEvents[].recipes`, which is empty on every event (the dishes are
  recorded in `daily_menus`), so the function checks the menu instead:
  2,713 events − 1,301 with a menu (as in `ml_event_menus.csv`) − 1 cancelled
  − 17 still in the future = 1,394. Menus saved with no dishes (193 rows)
  do not count as a menu.

## After phase 3 (staging, 2026-10-18)

| Check | Before | After phase 3 | Notes |
| --- | --- | --- | --- |
| Dated price history (`ingredient_prices`) | none | **1,161 rows**: Dar es Salaam 889 (504 Stock In, 385 catalog), Dodoma 174 (77 / 97), Arusha 98 (58 / 40) | Stock In history Nov 2025 – Sep 2026; catalog prices dated 2026-10-18. 386 of 387 products have a price at some branch; 140 have Stock In history |
| Stock In rows (check E) | 650 | 650 (unchanged) | 639 of the 643 priced Stock In rows went into the history; the rest point to products no longer in the catalog |
| Recipe products without price history | n/a | **0 of 0** | no recipe has ingredient lines yet |
| Events with an issue | not measured | **1,418** (table above) | |
| Daily-menu dishes without a recipe (check D) | 160 of 14,503 (1.1%) | 160 (unchanged) | **76 distinct dish names**, in `mappings/dish_name_mapping.csv` for the kitchen. Unchanged until `apply-dish-mapping.sh` runs with their choices |
| Dishes whose recipeId is not a recipe (check D) | 9 | 9 | the 9 "recipe id not found" events |

## How to re-measure

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/audit/02_baseline_quality.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/audit/03_phase2_checks.sql
```

`event_quality_issues()` needs a signed-in staff user: open the Data
Quality page (Settings → Data Quality) and read the counts at the top.
