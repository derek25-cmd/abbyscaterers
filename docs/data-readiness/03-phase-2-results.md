# Data readiness 03: Phase 2 results (make costing correct)

Status on 2026-10-18: **code done and tested; nothing applied to any database
yet.** No staging project exists, and the live recipes have no ingredient
lines, so the parts of the plan that need either are listed under "Still to
do" with the exact commands.

## Design change: recipes use the product catalog

The plan linked recipes → `ingredients` → `products`. The `ingredients` table
is empty, while the product catalog (387 products, with branch prices) holds
almost everything a recipe needs. So, on 2026-10-18, **recipe lines link to
products directly**:

- each line of `recipes.ingredients` is `{ productId, quantity, unit }`, where
  `productId` = `products.id`. The old `ingredientId` field is kept as
  optional, so a legacy line is not lost on edit;
- the kitchen picks products in the recipe form (search by name or SKU, with
  the unit the product is priced per shown);
- piece weight (`grams_per_item`) belongs to the product.

This removed, from the plan: the `ingredients.product_id` migration, the
ingredient mapping sheet and its loader, and the product picker on the
ingredient form. None of these was ever applied anywhere. The `ingredients`
table and its screens are unchanged and simply no longer used by costing.

## What was built

| Step | Delivered | Where |
| --- | --- | --- |
| 2 Baseline | Baseline from the production audit; checks 3a–3c as a reusable read-only file | `02-baseline.md`, `supabase/audit/03_phase2_checks.sql` |
| 3 Link recipes to products | Recipe lines carry `productId`; product picker in the recipe form; product names in the recipe view; units gain `liters` and `ml` | `components/recipes/recipe-form.tsx`, `recipe-details-view.tsx`, `types/index.ts`, `lib/schemas.ts` |
| 4 Units | `products.base_unit` (kg / liters / pcs / bunch, backfilled only where `unit` already is one) and `products.grams_per_item`, with CHECKs | `supabase/migrations/20261018120100_units.sql` |
| 4 | Gap list for the kitchen | `scripts/db/export-unit-gaps.sql` |
| 4 | `toPriceUnit` / `UnitError` / `TO_BASE`, 11 tests | `lib/costing/units.ts`, `lib/__tests__/units.test.ts` |
| 5 Branch prices, never zero | `calculateMenuCost(…, branch)`: each line priced through its product at the branch, unit-converted, one line per product, with `missingPrices`; "sync planned ingredients" uses products too; 10 tests | `services/menuCostingService.ts`, `services/__tests__/menuCostingService.test.ts` |
| 5 | Branch selector, missing-price banner, "Incomplete — N ingredients have no price", PDF | `components/menu-costing/CostCalculatorPanel.tsx`, `MenuCostingDashboard.tsx`, `hooks/use-menu-costing-storage.ts`, `lib/menuCostingPdf.ts`, `lib/costing/missing.ts` |

What `missingPrices` lists: a product with no price at the branch (its name);
`<name> (unit)` when the recipe unit cannot be converted; `<id> (no product)` /
`<id> (product not found)` for lines without a usable product;
`<recipe> (no ingredients)` and `<recipe number> (recipe not found)` for
recipes that add nothing.

Checks run: `npm run typecheck` ✅, `npm run lint` ✅ (no new warnings),
`npm run test` ✅ 296 tests, `npm run build` ✅. The SQL was run in PGlite
(Postgres 17) on tables shaped like the live schema: the migration applied
twice without change, the CHECKs held, and checks 3a–3c and the gap list
found the planted problems (a duplicate product name, a line with a deleted
product, a legacy line, eggs in pieces against a per-kg price, a per-gram
product).

## Old vs new menu cost

**On the live data the comparison is trivial, and it is the main finding of
Phase 2.** All 404 recipes have an empty ingredient list, so:

| | Old logic (main) | New logic (this branch) |
| --- | --- | --- |
| Any of the 11 catering menus, any branch | TZS 0, shown as a complete total | TZS 0, marked **"Incomplete"**, with every recipe listed as "… (no ingredients)" |

A meaningful comparison needs ingredients for at least one menu. Until then,
the tests show the behaviour on a realistic menu (rice in kg, oil in liters,
salt in grams, eggs in pieces, one product with no price):

| Branch | New total | missingPrices | What the old logic did |
| --- | --- | --- | --- |
| Dar es Salaam | 12,000 | Eggs (unit), Mystery spice | priced by product **name** at the single legacy price; the unpriced spice and the eggs at **0**; "6 item" of eggs multiplied by a per-kg price as if 6 kg |
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
3. **Apply the migration to staging**: `psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261018120100_units.sql`,
   then re-run 3a–3c.
4. **Export the gap list**: `export-unit-gaps.sql` → `mappings/unit_gaps.csv`.
   Expect one `product_base_unit` row for every product whose `unit` is not
   exactly kg, l, liters, item, pcs or bunch.
5. **Clean the catalog before the kitchen starts** (3a): merge or rename
   duplicate product names, so the recipe picker has one obvious choice per
   item.
6. **Kitchen**: enter the top 40 recipes by picking products in the recipe
   form, and fill `unit_gaps.csv`.
7. **Cost one real menu at each branch** in the app against staging, and
   record old vs new totals here.
8. Fill the **After phase 2** column of `02-baseline.md`.

## Open points

- **No way yet to enter `base_unit` / `grams_per_item`**: they are not on the
  product form and there is no loader for `unit_gaps.csv`. The kitchen's
  answers currently need SQL updates. Adding them to the product form is the
  natural next step.
- **Product catalog quality now matters for recipes**: duplicate names
  (check 3a), pack-size prices (e.g. cooking oil per litre vs per 20 L) and
  non-food items in the catalog will show up in the recipe picker.
- **Recipes and catering menus are owner-only** under RLS
  (`auth.uid() = user_id`). A menu costed by a user who did not create its
  recipes shows "… (recipe not found)" instead of a silent zero. Products are
  readable by all staff, so pricing is not affected. Who should see whose
  recipes is a separate decision.
- The planned-ingredients sync uses Dar es Salaam prices; marked
  `TODO(data-readiness Step 9)` for the region-to-branch map.
