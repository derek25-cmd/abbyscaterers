# Production runbook: data readiness Phase 2

The exact order for applying Phase 2 (make costing correct) to production.
Do it only after the same steps have worked on staging
(`03-phase-2-results.md`, "Still to do").

Phase 2 has **two migrations**. The first only **adds** two columns and their
CHECK constraints to `products`, and fills `base_unit` where it is NULL. The
second replaces the owner-only access policies on recipes and catering menus
with "any active staff member", and records a creator for the 5 recipes that
have none. Neither changes or deletes any recipe, menu or product data. The
app reads the new columns, so **the
migrations must reach production before the app is deployed.** Recipes link to
the product catalog directly, so there is no mapping sheet to load.

## 0. Before you start

- Branch `feature/data-readiness-phase-2` reviewed and merged.
- Staging run completed, with no errors.
- Git Bash at the repo root, Docker running, `psql` installed.
- A quiet time: the backfill fires the `products` audit triggers (one
  `audit_log` row per backfilled product, and their `"updatedAt"` changes).

## 1. Backup

```bash
read -rsp "Production Session pooler URL: " DB_URL; echo; export DB_URL
scripts/db/backup.sh
unset DB_URL
```

Check that it ends with file sizes, a COPY count above 0 and "Checksums
written", then move the folder to `C:\Users\Admin\SecureBackups\`.

## 2. Migrations (SQL Editor, production, in this order)

Paste each file whole into the SQL Editor and run it. Both are idempotent:
running one twice is harmless.

1. `supabase/migrations/20261018120100_units.sql`
2. `supabase/migrations/20261018130000_shared_recipe_access.sql`

Check it (read-only):

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN ('base_unit', 'grams_per_item');
-- expect 2 rows: base_unit text, grams_per_item numeric

SELECT base_unit, count(*) FROM public.products GROUP BY base_unit ORDER BY 2 DESC;

SELECT tablename, count(*) AS policies FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('recipes', 'catering_menus', 'catering_menu_recipes', 'menu_planned_ingredients')
GROUP BY tablename;
-- expect 4 policies on each of the 4 tables
```

Then sign in to the catering system with a staff account that is **not** the
admin who created the recipes: Recipes should list all 404 recipes, and Menu
Costing all 11 menus.

**Rollback, `20261018130000_shared_recipe_access.sql`** (restores owner-only
access exactly as it was; the creator recorded for the 5 ownerless recipes is
kept, which is harmless):

```sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipes', 'catering_menus', 'catering_menu_recipes', 'menu_planned_ingredients'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_delete', t);
  END LOOP;
END $$;
CREATE POLICY "Authenticated users can perform all operations on their own rec" ON public.recipes
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner access to recipes" ON public.recipes TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow all access for authenticated users" ON public.catering_menus
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow all access for authenticated users" ON public.catering_menu_recipes
  TO authenticated USING (EXISTS (SELECT 1 FROM public.catering_menus
    WHERE catering_menus.id = catering_menu_recipes.menu_id AND catering_menus.user_id = auth.uid()));
CREATE POLICY "Allow all access for authenticated users" ON public.menu_planned_ingredients
  TO authenticated USING (EXISTS (SELECT 1 FROM public.catering_menus
    WHERE catering_menus.id = menu_planned_ingredients.menu_id AND catering_menus.user_id = auth.uid()));
```

**Rollback, `20261018120100_units.sql`** (only if needed; it removes any units
entered since):

```sql
ALTER TABLE public.products DROP COLUMN IF EXISTS base_unit;
ALTER TABLE public.products DROP COLUMN IF EXISTS grams_per_item;
```

**If the new app is already deployed, redeploy the previous app version
first**: the new costing code selects these columns, and the query would
fail without them.

## 3. Unit gaps for the kitchen (any time after step 2)

```bash
read -rsp "Production Session pooler URL: " DB_URL; echo; export DB_URL
mkdir -p docs/data-readiness/mappings
psql "$DB_URL" -v ON_ERROR_STOP=1 --csv \
  -f scripts/db/export-unit-gaps.sql \
  -o docs/data-readiness/mappings/unit_gaps.csv
unset DB_URL
```

`docs/data-readiness/mappings/` is gitignored. There is no loader for the
kitchen's answers yet (`03-phase-2-results.md`, open points).

## 4. Deploy the app

Deploy `apps/catering-system` from the merged `main`. Then check:

- **Recipes → Edit → Add Ingredient**: the picker lists **products** (name,
  SKU, price unit), and shows "Priced per …" once one is chosen; saving keeps
  it, and the recipe page shows the product names.
- **Menu Costing → Cost Calculator**: the "Branch Prices" selector is there.
  Calculating a menu whose recipes have no ingredients shows the amber
  "Incomplete — N …" banner, not a silent TZS 0.
- **Export** the costing PDF: it shows "Branch Prices" and the "Not included
  in the estimate" table.

**Rollback:** redeploy the previous version. The new columns can stay; the old
app ignores them. Recipe lines saved with the new form carry `productId`
(and no `ingredientId`). The old app would show them as unknown ingredients
until the new version is back.

## 5. Re-run the baseline (read-only)

Run `supabase/audit/02_baseline_quality.sql` (checks A–E) and
`supabase/audit/03_phase2_checks.sql` (3a–3c) in the SQL Editor, one query
at a time. Fill in the "After phase 2" column in `docs/data-readiness/02-baseline.md`.
