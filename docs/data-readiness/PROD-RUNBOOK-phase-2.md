# Production runbook: data readiness Phase 2

The exact order for applying Phase 2 (make costing correct) to production.
Do it only after the same steps have worked on staging
(`03-phase-2-results.md`, "Still to do").

Phase 2 has **one migration**. It only **adds** two columns and their CHECK
constraints to `products`, and fills `base_unit` where it is NULL. It never
changes or deletes existing data. The app reads the new columns, so **the
migration must reach production before the app is deployed.** Recipes link to
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

## 2. Migration (SQL Editor, production)

Paste `supabase/migrations/20261018120100_units.sql` whole into the SQL
Editor and run it. It is idempotent: running it twice is harmless.

Check it (read-only):

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN ('base_unit', 'grams_per_item');
-- expect 2 rows: base_unit text, grams_per_item numeric

SELECT base_unit, count(*) FROM public.products GROUP BY base_unit ORDER BY 2 DESC;
```

**Rollback** (only if needed; it removes any units entered since):

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
