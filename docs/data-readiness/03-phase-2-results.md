# Data readiness 03: Phase 2 results (make costing correct)

Status on 2026-10-18: **code done and tested; both migrations applied to
staging only** (project `vpxiyxrnrhiukaazztol`, restored from the 2026-10-18 backup).
Production is untouched. The live recipes still have no ingredient lines, so
costing real menus waits for the kitchen (see "Still to do").

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

## Staging run (2026-10-18)

Restore: the backup's Supabase-internal storage tables (`storage.*`,
`supabase_functions.*`) cannot be written in a new project, so staging was
restored from a filtered copy without them
(`C:/Users/Admin/SecureBackups/staging-restore/`). All 86 public tables and
the auth tables loaded. Counts match production (orders 2,051, products 387,
recipes 404, daily menus 1,555, stock logs 6,360).

| Step | Result |
| --- | --- |
| Baseline checks A–E on staging | identical to the production audit (`02-baseline.md`) |
| Checks 3a–3c before | 3a: 4 duplicate names (8 products); 3b/3c: 0 recipe lines |
| `20261018120100_units.sql` | applied; `base_unit` set for 305 products (kg 222, pcs 76, liters 7), 82 left NULL; second run changed nothing; both CHECKs in place |
| Checks 3a–3c after | unchanged (no recipe lines yet) |
| `unit_gaps.csv` | 82 rows, all "price is per …" for products in pack units |
| `catalog_review.csv` (new: `scripts/db/export-catalog-review.sql`) | 387 rows; 111 to look at: 9 duplicate / near-duplicate groups (23 products), 82 non-base units, 19 with Stock In prices varying > 5×; 125 never in stock logs |
| Cost a real menu per branch | not meaningful yet: all 11 catering menus' recipes are empty, so every branch gives TZS 0 marked "Incomplete", each recipe listed "(no ingredients)" |

Facts the kitchen work depends on:

- **All 11 catering menus are Breakfast menus for 40 people.** Costing scales
  recipe quantities by guests ÷ 40, so recipe quantities must be **for 40
  people**. Lunch and dinner dishes (most of the top 40) are only costed once
  lunch/dinner catering menus exist.
- **Recipe access (resolved, option b, 2026-10-18).** Recipes were owner-only:
  399 of 404 belonged to one admin account, and 5 had no owner, so nobody
  could see those 5. `20261018130000_shared_recipe_access.sql` lets any
  active staff member read, add and edit recipes, catering menus, menu recipes
  and planned ingredients. Deleting needs `can_manage_ops()`. The 5 ownerless
  recipes now record the admin as their creator. On staging, before: admin 404
  / hr_manager 0 recipes. After: both see 404 recipes, 11 menus and 93 menu
  recipes. 16 policies are in place and 0 recipes are ownerless. A second run
  changed nothing. The runbook's rollback SQL was tested in a rolled-back
  transaction: it restores owner-only access (hr_manager back to 0).
- **Branch prices:** Dar es Salaam has a price for 385 of 387 products,
  Arusha 40, Dodoma 97. Costing at Arusha / Dodoma will list most products as
  "no price" until those prices are filled in.

## Still to do

1. **Operations: catalog cleanup** with `docs/data-readiness/mappings/catalog_review.csv`
   (gitignored): merge or retire duplicates, fix pack-size prices, mark
   non-food items. Edits go into **production** through the Products page.
2. ~~Decide recipe access~~: shared by all staff (option b), see above.
3. **Production rollout**: `PROD-RUNBOOK-phase-2.md` (backup, both
   migrations, deploy).
4. **Kitchen**: enter the top 40 recipes for 40 people, in production, picking
   products; fill `unit_gaps.csv`.
5. **Cost one real menu at each branch** and record old vs new totals here.
6. Fill the **After phase 2** column of `02-baseline.md`.

## Open points

- **No way yet to enter `base_unit` / `grams_per_item`**: they are not on the
  product form and there is no loader for `unit_gaps.csv`. The kitchen's
  answers currently need SQL updates. Adding them to the product form is the
  natural next step.
- **Product catalog quality now matters for recipes**: duplicate names
  (check 3a), pack-size prices (e.g. cooking oil per litre vs per 20 L) and
  non-food items in the catalog will show up in the recipe picker.
- **Deleting recipes and menus** uses `can_manage_ops()`, which today is the
  same as any active staff. To limit deletion to managers, tighten that one
  function.
- The planned-ingredients sync uses Dar es Salaam prices; marked
  `TODO(data-readiness Step 9)` for the region-to-branch map.
