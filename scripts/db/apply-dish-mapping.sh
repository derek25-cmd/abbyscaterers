#!/usr/bin/env bash
# =============================================================================
# apply-dish-mapping.sh: load the kitchen's dish -> recipe choices and link the
# daily-menu dishes to their recipes (data readiness Phase 3, Step 8)
# =============================================================================
#
# Usage (Git Bash, repo root):
#   read -rsp "Target DB URL: " TARGET_DB_URL; echo; export TARGET_DB_URL
#   scripts/db/apply-dish-mapping.sh [docs/data-readiness/mappings/dish_name_mapping.csv]
#   unset TARGET_DB_URL
#
# Needs migration 20261018160000_dish_name_map.sql on the target. The CSV is
# the one written by scripts/db/export-dish-names.sql, with the kitchen's
# choices in chosen_recipe_number (column order unchanged).
#
# What it does, in one transaction:
#   1. Loads the CSV; rows with a blank chosen_recipe_number are skipped, rows
#      whose chosen_recipe_number is not a recipe are reported and skipped.
#   2. Upserts the valid rows into dish_name_map (raw_name -> recipe_number).
#   3. For every daily_menus row, sets "recipeId" on the dishes that have none
#      (missing or empty) and whose lower-cased, trimmed name is in
#      dish_name_map. Dish order is kept (WITH ORDINALITY) and every other key
#      of every dish is unchanged; dishes that already have a recipeId are
#      never touched.
# It prints counts only. The connection string is never printed.
#
# Before it changes anything it shows the project ref from TARGET_DB_URL and
# asks you to type it back.
# =============================================================================
set -euo pipefail

CSV="${1:-docs/data-readiness/mappings/dish_name_mapping.csv}"
EXPECTED_HEADER='raw_name,example_name,times_served,first_menu_date,last_menu_date,suggestion_1_number,suggestion_1_name,suggestion_2_number,suggestion_2_name,suggestion_3_number,suggestion_3_name,suggestion_method,chosen_recipe_number'

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "TARGET_DB_URL is not set. Export it first (see the header of this script)." >&2
  exit 1
fi
if [[ ! -f "$CSV" ]]; then
  echo "CSV not found: $CSV" >&2
  exit 1
fi
command -v psql >/dev/null || { echo "psql not found on PATH." >&2; exit 1; }

header="$(head -n 1 "$CSV" | tr -d '\r' | sed 's/^\xEF\xBB\xBF//')"
if [[ "$header" != "$EXPECTED_HEADER" ]]; then
  echo "Unexpected CSV header. Keep the columns exactly as exported:" >&2
  echo "  $EXPECTED_HEADER" >&2
  exit 1
fi

# Project ref: pooler user "postgres.<ref>" or direct host "db.<ref>.supabase.co".
ref="$(printf '%s' "$TARGET_DB_URL" | sed -nE 's#^[a-z]+://postgres\.([a-z0-9]+)[:@].*#\1#p')"
if [[ -z "$ref" ]]; then
  ref="$(printf '%s' "$TARGET_DB_URL" | sed -nE 's#.*@db\.([a-z0-9]+)\.supabase\.co.*#\1#p')"
fi
if [[ -z "$ref" ]]; then
  echo "Could not read a Supabase project ref from TARGET_DB_URL." >&2
  exit 1
fi

echo "Target Supabase project: $ref"
read -r -p "Type the project ref to continue: " typed
if [[ "$typed" != "$ref" ]]; then
  echo "Does not match. Nothing was changed." >&2
  exit 1
fi

csv_abs="$(cd "$(dirname "$CSV")" && pwd)/$(basename "$CSV")"
# Native Windows psql needs C:/... rather than Git Bash's /c/...
if command -v cygpath >/dev/null 2>&1; then csv_abs="$(cygpath -m "$csv_abs")"; fi

if [[ "$csv_abs" == *"'"* ]]; then
  echo "The CSV path must not contain a single quote: $csv_abs" >&2
  exit 1
fi

# psql does not expand variables inside \copy, so the path is put into the
# script text (__CSV_PATH__) before it is run.
sql="$(cat <<'SQL'
\pset footer off
BEGIN;

CREATE TEMP TABLE dish_mapping_in (
  raw_name text, example_name text, times_served text, first_menu_date text, last_menu_date text,
  suggestion_1_number text, suggestion_1_name text, suggestion_2_number text, suggestion_2_name text,
  suggestion_3_number text, suggestion_3_name text, suggestion_method text, chosen_recipe_number text
) ON COMMIT DROP;

\copy dish_mapping_in FROM '__CSV_PATH__' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

CREATE TEMP TABLE dish_mapping_ok ON COMMIT DROP AS
  SELECT DISTINCT ON (lower(trim(i.raw_name)))
         lower(trim(i.raw_name)) AS raw_name, trim(i.chosen_recipe_number) AS recipe_number
  FROM dish_mapping_in i
  JOIN public.recipes r ON r."recipeNumber" = trim(i.chosen_recipe_number)
  WHERE nullif(trim(i.raw_name), '') IS NOT NULL
    AND nullif(trim(i.chosen_recipe_number), '') IS NOT NULL
  ORDER BY lower(trim(i.raw_name));

\echo '--- CSV rows'
SELECT count(*)                                                                   AS rows_in_csv,
       count(*) FILTER (WHERE nullif(trim(chosen_recipe_number), '') IS NULL)     AS skipped_blank,
       (SELECT count(*) FROM dish_mapping_ok)                                     AS valid
FROM dish_mapping_in;

\echo '--- Invalid recipe numbers (skipped)'
SELECT i.raw_name, i.chosen_recipe_number
FROM dish_mapping_in i
WHERE nullif(trim(i.chosen_recipe_number), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r."recipeNumber" = trim(i.chosen_recipe_number))
ORDER BY 1;

WITH up AS (
  INSERT INTO public.dish_name_map (raw_name, recipe_number)
  SELECT raw_name, recipe_number FROM dish_mapping_ok
  ON CONFLICT (raw_name) DO UPDATE SET recipe_number = EXCLUDED.recipe_number
  WHERE public.dish_name_map.recipe_number IS DISTINCT FROM EXCLUDED.recipe_number
  RETURNING 1
)
SELECT count(*) AS dish_name_map_rows_added_or_changed FROM up;

-- Link dishes: only dishes with no recipeId, order kept, other keys unchanged.
WITH expanded AS (
  SELECT dm.id, d.pos, d.item,
         (jsonb_typeof(d.item) = 'object'
          AND (jsonb_typeof(d.item -> 'recipeId') IS DISTINCT FROM 'string' OR trim(d.item ->> 'recipeId') = '')
          AND m.recipe_number IS NOT NULL) AS link,
         m.recipe_number
  FROM public.daily_menus dm
  CROSS JOIN LATERAL jsonb_array_elements(dm.recipes) WITH ORDINALITY AS d(item, pos)
  LEFT JOIN public.dish_name_map m
         ON jsonb_typeof(d.item) = 'object' AND m.raw_name = lower(trim(d.item ->> 'name'))
  WHERE jsonb_typeof(dm.recipes) = 'array'
),
rebuilt AS (
  SELECT id,
         jsonb_agg(CASE WHEN link THEN item || jsonb_build_object('recipeId', recipe_number) ELSE item END
                   ORDER BY pos) AS recipes,
         count(*) FILTER (WHERE link) AS linked
  FROM expanded
  GROUP BY id
  HAVING count(*) FILTER (WHERE link) > 0
),
upd AS (
  UPDATE public.daily_menus t
     SET recipes = r.recipes
    FROM rebuilt r
   WHERE t.id = r.id
  RETURNING r.linked
)
SELECT count(*) AS daily_menus_updated, coalesce(sum(linked), 0) AS dishes_linked FROM upd;

COMMIT;
\echo 'Done.'
SQL
)"
printf '%s\n' "${sql//__CSV_PATH__/$csv_abs}" | psql "$TARGET_DB_URL" -X -q -v ON_ERROR_STOP=1
