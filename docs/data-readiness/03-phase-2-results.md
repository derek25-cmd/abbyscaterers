# Data readiness 03: Phase 2 results (make costing correct)

Status on 2026-10-18: **code done and tested; nothing applied to any database
yet.** No staging project exists, and the live data has no recipe
ingredients, so the parts of the plan that need either are listed under
"Still to do" with the exact commands.

## What was built

| Step | Delivered | Where |
| --- | --- | --- |
| 2 Baseline | Baseline from the production audit; checks 3a–3c as a reusable read-only file | `02-baseline.md`, `supabase/audit/03_phase2_checks.sql` |
| 3 Link ingredients to products | `ingredients.product_id` (text) with FK, index, unique-name backfill | `supabase/migrations/20261018120000_ingredient_product_link.sql` |
| 3 | Mapping sheet export (token-match suggestions) and loader (applied / skipped / invalid, typed confirmation, `DRY_RUN=1`) | `scripts/db/export-ingredient-mapping.sql`, `scripts/db/apply-ingredient-mapping.sh` |
| 3 | Optional product picker on the ingredient form | `components/ingredients/ingredient-form.tsx`, `ingredientService.ts`, `types/index.ts`, `lib/schemas.ts` |
| 4 Units | `products.base_unit`, `ingredients.grams_per_item` with CHECKs and backfill | `supabase/migrations/20261018120100_units.sql` |
| 4 | Gap list for the kitchen | `scripts/db/export-unit-gaps.sql` |
| 4 | `toPriceUnit` / `UnitError` / `TO_BASE`, 11 tests | `lib/costing/units.ts`, `lib/__tests__/units.test.ts` |
| 5 Branch prices, never zero | `calculateMenuCost(…, branch)` priced via product id at the branch, unit-converted, with `missingPrices`; 8 tests | `services/menuCostingService.ts`, `services/__tests__/menuCostingService.test.ts` |
| 5 | Branch selector, missing-price banner, "Incomplete — N ingredients have no price", PDF | `components/menu-costing/CostCalculatorPanel.tsx`, `MenuCostingDashboard.tsx`, `hooks/use-menu-costing-storage.ts`, `lib/menuCostingPdf.ts`, `lib/costing/missing.ts` |

Checks run: `npm run typecheck` ✅, `npm run lint` ✅ (no new warnings),
`npm run test` ✅ 294 tests, `npm run build` ✅. All SQL was run in PGlite
(Postgres 17) on tables shaped like the live schema: both migrations applied
twice without change, duplicate names were not auto-linked, the CHECKs held,
and the loader logic reported applied / skipped / invalid correctly.

## Old vs new menu cost

**On the live data the comparison is trivial, and it is the main finding of
Phase 2.** All 404 recipes have an empty ingredient list, so:

| | Old logic (main) | New logic (this branch) |
| --- | --- | --- |
| Any of the 11 catering menus, any branch | TZS 0, shown as a complete total | TZS 0, marked **"Incomplete"**, with every recipe listed as "… (no ingredients)" |

A meaningful old-vs-new comparison needs ingredients for at least one menu.
Until then, the tests show the behaviour on a realistic menu (rice in kg,
oil in liters, salt in grams, eggs in pieces, one unlinked spice):

| Branch | New total | missingPrices | What the old logic did |
| --- | --- | --- | --- |
| Dar es Salaam | 12,000 | Eggs (unit), Mystery spice | priced by product **name** at the single legacy price; unlinked spice and eggs at **0**; eggs "6 item" multiplied by a per-kg price as if 6 kg |
| Arusha | 8,000 | Cooking oil, Eggs (unit), Mystery spice | the same Dar price, whatever the branch |

## Still to do (needs staging, then the kitchen)

1. **Create staging and set the environment**: a free Supabase project,
   restored with `scripts/db/restore-to-staging.sh`. Install the PostgreSQL
   client, then `export STAGING_DB_URL=…` and
   `export PROD_PROJECT_REF=enpcjcesyvjqugnxdslp`.
2. **Measure on staging** (Part A):
   `psql "$STAGING_DB_URL" -f supabase/audit/02_baseline_quality.sql` and
   `-f supabase/audit/03_phase2_checks.sql`, then fill the 3a row in
   `02-baseline.md`.
3. **Apply the migrations to staging**: `psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f`
   each of the two migration files, then re-run 3a–3c.
4. **Export the sheets**: `export-ingredient-mapping.sql` → `mappings/ingredient_product_mapping.csv`,
   `export-unit-gaps.sql` → `mappings/unit_gaps.csv`. Expected now: **0**
   ingredients to map (the table is empty), and one `product_base_unit` row
   for every product whose `unit` is not exactly kg, l, liters, item, pcs or
   bunch.
5. **Test the loader** with a 3-row sample:
   `DRY_RUN=1 TARGET_DB_URL="$STAGING_DB_URL" scripts/db/apply-ingredient-mapping.sh sample.csv`,
   then for real, then revert those rows (`UPDATE public.ingredients SET product_id = NULL WHERE "itemNumber" IN (…)`).
   This needs at least 3 ingredients on staging, which do not exist yet.
6. **Kitchen**: enter ingredients (linked to products) for the top 40
   recipes; fill `unit_gaps.csv`.
7. **Cost one real menu at each branch** in the app against staging and
   record old vs new totals here.
8. Fill the **After phase 2** column of `02-baseline.md`.

## Open points

- **Recipes, ingredients and catering menus are owner-only** under RLS
  (`auth.uid() = user_id`). A menu costed by a user who did not create its
  recipes now shows "… (recipe not found)" instead of a silent zero. Who
  should see whose recipes is a separate decision.
- **No loader for `unit_gaps.csv` yet**: `products.base_unit` and
  `ingredients.grams_per_item` have no UI or import. The kitchen's answers
  currently need SQL updates. A small loader like the ingredient one, or
  fields on the product and ingredient forms, belongs in the next step.
- `syncPlannedIngredientsFromRecipes` (the "sync planned ingredients" button)
  still matches products by name at the legacy price. It was outside this
  step's scope.
