# Production runbook: data readiness Phase 2

The exact order for applying Phase 2 (make costing correct) to production.
Do it only after the same steps have worked on staging
(`03-phase-2-results.md`, "Still to do").

The two migrations only **add** columns, constraints and an index, and fill
NULL values. They never change or delete existing data. The app change needs
the new columns, so **the migrations must reach production before the app is
deployed.**

## 0. Before you start

- Branch `feature/data-readiness-phase-2` reviewed and merged.
- Staging run completed, with no errors.
- Git Bash at the repo root, Docker running, `psql` installed.
- A quiet time: the backfills fire the `products` audit triggers (one
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

Paste each file whole into the SQL Editor and run it. Both are idempotent,
so running one twice is harmless.

1. `supabase/migrations/20261018120000_ingredient_product_link.sql`
2. `supabase/migrations/20261018120100_units.sql`

Check them (read-only):

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'ingredients' AND column_name IN ('product_id', 'grams_per_item'))
    OR (table_name = 'products' AND column_name = 'base_unit'));
-- expect 3 rows: product_id text, grams_per_item numeric, base_unit text

SELECT base_unit, count(*) FROM public.products GROUP BY base_unit ORDER BY 2 DESC;
```

**Rollback** (only if needed; it removes the links and units entered since):

| Migration | Rollback |
| --- | --- |
| `20261018120100_units.sql` | `ALTER TABLE public.products DROP COLUMN IF EXISTS base_unit; ALTER TABLE public.ingredients DROP COLUMN IF EXISTS grams_per_item;` |
| `20261018120000_ingredient_product_link.sql` | `ALTER TABLE public.ingredients DROP COLUMN IF EXISTS product_id;` (drops its index and foreign key with it) |

Roll back in reverse order (units first). **If the new app is already
deployed, redeploy the previous app version before rolling back
`product_id`**: the new ingredient form writes that column, and saving would
fail without it.

## 3. Ingredient mapping (once operations have filled the sheet)

This can happen any time after step 2, before or after the deploy.

```bash
read -rsp "Production Session pooler URL: " TARGET_DB_URL; echo; export TARGET_DB_URL
mkdir -p docs/data-readiness/mappings
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 --csv \
  -f scripts/db/export-ingredient-mapping.sql \
  -o docs/data-readiness/mappings/ingredient_product_mapping.csv
# ... operations fill chosen_sku ...
DRY_RUN=1 scripts/db/apply-ingredient-mapping.sh docs/data-readiness/mappings/ingredient_product_mapping.csv
scripts/db/apply-ingredient-mapping.sh docs/data-readiness/mappings/ingredient_product_mapping.csv
unset TARGET_DB_URL
```

Run the dry run first and read its "Invalid rows". Each run asks you to type
the project ref (`enpcjcesyvjqugnxdslp`).
**Rollback:** the script prints the rows it applied, with their previous
`product_id` (normally empty). To undo a run, set those rows back:
`UPDATE public.ingredients SET product_id = NULL WHERE "itemNumber" IN (…);`

Units: export `scripts/db/export-unit-gaps.sql` the same way for the
kitchen. There is no loader for its answers yet (`03-phase-2-results.md`).

## 4. Deploy the app

Deploy `apps/catering-system` from the merged `main`. Then check:

- **Ingredients → Edit**: the "Product (optional)" picker lists products, and
  saving keeps the choice.
- **Menu Costing → Cost Calculator**: the "Branch Prices" selector is there,
  and calculating a menu whose recipes have no ingredients shows the amber
  "Incomplete — N …" banner, not a silent TZS 0.
- **Export** the costing PDF: it shows "Branch Prices" and the "Not included
  in the estimate" table.

**Rollback:** redeploy the previous version. The database changes can stay;
the old app ignores the new columns.

## 5. Re-run the baseline (read-only)

Run `supabase/audit/02_baseline_quality.sql` (checks A–E) and
`supabase/audit/03_phase2_checks.sql` (3a–3c) in the SQL Editor, one query
at a time. Fill the "After phase 2" column in `docs/data-readiness/02-baseline.md`.
