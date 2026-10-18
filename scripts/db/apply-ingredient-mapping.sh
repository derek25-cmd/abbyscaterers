#!/usr/bin/env bash
# Apply a filled-in ingredient -> product mapping sheet.
#
#   TARGET_DB_URL='postgresql://...' scripts/db/apply-ingredient-mapping.sh \
#     docs/data-readiness/mappings/ingredient_product_mapping.csv
#
# The CSV is the one produced by scripts/db/export-ingredient-mapping.sql, with
# the chosen_sku column filled in by operations staff (columns unchanged).
# For each row:
#   applied    chosen_sku matches exactly one product -> ingredients.product_id set
#   skipped    chosen_sku blank (not decided yet)
#   invalid    chosen_sku matches no product, or more than one (SKUs are not
#              unique in products), or the ingredient no longer exists
# Everything runs in one transaction. DRY_RUN=1 runs it all, prints the counts
# and the rows that would change, then rolls back.
#
# WARNING: this WRITES to whatever database TARGET_DB_URL points at. It shows
# the target project ref and asks you to type it before changing anything.
# The connection string is read from the environment and never printed.
# Needs psql and migration 20261018120000_ingredient_product_link.sql.

set -euo pipefail

usage() {
  echo "Usage: TARGET_DB_URL=... [DRY_RUN=1] $0 <filled-mapping.csv>" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage
csv="$1"

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "TARGET_DB_URL is not set." >&2
  exit 1
fi
if [[ ! -s "$csv" ]]; then
  echo "$csv is missing or empty." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed (PostgreSQL client tools)." >&2
  exit 1
fi

expected_header='itemNumber,itemDescription,itemClassification,times_used_in_recipes,suggestion_1_sku,suggestion_1_name,suggestion_2_sku,suggestion_2_name,suggestion_3_sku,suggestion_3_name,chosen_sku'
actual_header="$(head -1 "$csv" | tr -d '\r\357\273\277')"
if [[ "$actual_header" != "$expected_header" ]]; then
  echo "Unexpected columns in $csv." >&2
  echo "Expected: $expected_header" >&2
  echo "Found:    $actual_header" >&2
  exit 1
fi

url_lc="$(printf '%s' "$TARGET_DB_URL" | tr '[:upper:]' '[:lower:]')"
target_ref=""
if [[ "$url_lc" =~ postgres\.([a-z0-9]{20})[:@] ]]; then
  target_ref="${BASH_REMATCH[1]}"
elif [[ "$url_lc" =~ @db\.([a-z0-9]{20})\.supabase\.co ]]; then
  target_ref="${BASH_REMATCH[1]}"
fi
if [[ -z "$target_ref" ]]; then
  echo "REFUSED: cannot tell which Supabase project TARGET_DB_URL points at." >&2
  exit 1
fi

mode="APPLY"
end_tx="COMMIT;"
if [[ "${DRY_RUN:-}" == "1" ]]; then
  mode="DRY RUN (rolled back)"
  end_tx="ROLLBACK;"
fi

echo "Mapping file: $csv"
echo "Target Supabase project: $target_ref"
echo "Mode: $mode"
read -r -p "Type the target project ref to continue: " typed
if [[ "$(printf '%s' "$typed" | tr '[:upper:]' '[:lower:]')" != "$target_ref" ]]; then
  echo "Confirmation did not match. Nothing was changed." >&2
  exit 1
fi

sql="$(mktemp)"
trap 'rm -f "$sql"' EXIT
cat > "$sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE mapping_in (
  "itemNumber" text, "itemDescription" text, "itemClassification" text,
  times_used_in_recipes text,
  suggestion_1_sku text, suggestion_1_name text,
  suggestion_2_sku text, suggestion_2_name text,
  suggestion_3_sku text, suggestion_3_name text,
  chosen_sku text
) ON COMMIT DROP;
\copy mapping_in FROM pstdin WITH (FORMAT csv, HEADER true)
CREATE TEMP TABLE mapping_eval ON COMMIT DROP AS
SELECT
  m."itemNumber",
  nullif(trim(m.chosen_sku), '') AS sku,
  (SELECT count(*) FROM public.products p WHERE p.sku = trim(m.chosen_sku)) AS products_with_sku,
  (SELECT min(p.id) FROM public.products p WHERE p.sku = trim(m.chosen_sku)) AS product_id,
  EXISTS (SELECT 1 FROM public.ingredients i WHERE i."itemNumber" = m."itemNumber") AS ingredient_exists
FROM mapping_in m;
\echo
\echo Rows that will be applied:
SELECT e."itemNumber", e.sku AS chosen_sku, e.product_id,
       i.product_id AS current_product_id
FROM mapping_eval e
JOIN public.ingredients i ON i."itemNumber" = e."itemNumber"
WHERE e.sku IS NOT NULL AND e.products_with_sku = 1
ORDER BY e."itemNumber";
UPDATE public.ingredients i
   SET product_id = e.product_id
  FROM mapping_eval e
 WHERE e."itemNumber" = i."itemNumber"
   AND e.sku IS NOT NULL
   AND e.products_with_sku = 1;
\echo
\echo Invalid rows:
SELECT "itemNumber", sku AS chosen_sku,
       CASE WHEN NOT ingredient_exists THEN 'ingredient not found'
            WHEN products_with_sku = 0 THEN 'SKU not found'
            ELSE 'SKU matches ' || products_with_sku || ' products' END AS problem
FROM mapping_eval
WHERE sku IS NOT NULL AND (products_with_sku <> 1 OR NOT ingredient_exists)
ORDER BY "itemNumber";
\echo
\echo Summary:
SELECT
  count(*) FILTER (WHERE sku IS NOT NULL AND products_with_sku = 1 AND ingredient_exists) AS applied,
  count(*) FILTER (WHERE sku IS NULL)                                                      AS skipped_blank,
  count(*) FILTER (WHERE sku IS NOT NULL AND (products_with_sku <> 1 OR NOT ingredient_exists)) AS invalid
FROM mapping_eval;
$end_tx
SQL

psql --dbname "$TARGET_DB_URL" --no-psqlrc -f "$sql" < "$csv"
echo "Done ($mode)."
