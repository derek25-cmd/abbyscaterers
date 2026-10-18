#!/usr/bin/env bash
# =============================================================================
# publish-ai-model.sh: publish a trained model run to Abby's AI
# =============================================================================
#
# Usage (Git Bash, repo root), after ml/train.py:
#   read -rsp "Target DB URL: " TARGET_DB_URL; echo; export TARGET_DB_URL
#   scripts/db/publish-ai-model.sh [ml-data/models/<run>]     (default: latest run)
#   unset TARGET_DB_URL
#
# Needs migration 20261018170000_abbys_ai.sql on the target. In one
# transaction it records the run in ai_model_runs (with metrics.json) and
# replaces ai_dish_costs with the run's dish_cost_per_plate.csv. The quote
# check and menu ideas need no publishing: they read live orders and menus.
# It prints counts only; the connection string is never printed. Before it
# changes anything it shows the project ref and asks you to type it back.
# =============================================================================
set -euo pipefail

RUN_DIR="${1:-}"
if [[ -z "$RUN_DIR" ]]; then
  RUN_DIR="$(ls -d ml-data/models/*/ 2>/dev/null | sort | tail -n 1)"
fi
RUN_DIR="${RUN_DIR%/}"
COSTS="$RUN_DIR/dish_cost_per_plate.csv"
METRICS="$RUN_DIR/metrics.json"

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "TARGET_DB_URL is not set. Export it first (see the header of this script)." >&2
  exit 1
fi
for f in "$COSTS" "$METRICS"; do
  [[ -f "$f" ]] || { echo "Not found: $f (run ml/train.py first)" >&2; exit 1; }
done
command -v psql >/dev/null || { echo "psql not found on PATH." >&2; exit 1; }

header="$(head -n 1 "$COSTS" | tr -d '\r')"
if [[ "$header" != "dish,meal_section,est_cost_per_plate_tzs" ]]; then
  echo "Unexpected header in $COSTS: $header (retrain with the current ml/train.py)" >&2
  exit 1
fi

ref="$(printf '%s' "$TARGET_DB_URL" | sed -nE 's#^[a-z]+://postgres\.([a-z0-9]+)[:@].*#\1#p')"
[[ -n "$ref" ]] || ref="$(printf '%s' "$TARGET_DB_URL" | sed -nE 's#.*@db\.([a-z0-9]+)\.supabase\.co.*#\1#p')"
[[ -n "$ref" ]] || { echo "Could not read a Supabase project ref from TARGET_DB_URL." >&2; exit 1; }

run="$(basename "$RUN_DIR")"
echo "Model run:               $run"
echo "Target Supabase project: $ref"
read -r -p "Type the project ref to continue: " typed
[[ "$typed" == "$ref" ]] || { echo "Does not match. Nothing was changed." >&2; exit 1; }

costs_abs="$(cd "$(dirname "$COSTS")" && pwd)/$(basename "$COSTS")"
if command -v cygpath >/dev/null 2>&1; then costs_abs="$(cygpath -m "$costs_abs")"; fi
[[ "$costs_abs" != *"'"* ]] || { echo "The path must not contain a single quote." >&2; exit 1; }
metrics_json="$(tr -d '\r\n' < "$METRICS")"

# psql does not expand variables inside \copy, so the path goes into the text.
sql="$(cat <<'SQL'
\pset footer off
BEGIN;
CREATE TEMP TABLE costs_in (dish text, meal_section text, est_cost_per_plate_tzs numeric) ON COMMIT DROP;
\copy costs_in FROM '__COSTS_PATH__' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

INSERT INTO public.ai_model_runs (run, note, metrics)
VALUES (:'run', (:'metrics')::jsonb ->> 'note', (:'metrics')::jsonb)
ON CONFLICT (run) DO UPDATE SET note = EXCLUDED.note, metrics = EXCLUDED.metrics, published_at = now();

DELETE FROM public.ai_dish_costs;
INSERT INTO public.ai_dish_costs (dish_key, meal_section, cost_per_plate, model_run)
SELECT DISTINCT ON (lower(trim(dish))) lower(trim(dish)), meal_section, greatest(est_cost_per_plate_tzs, 0), :'run'
FROM costs_in
WHERE nullif(trim(dish), '') IS NOT NULL AND est_cost_per_plate_tzs IS NOT NULL
ORDER BY lower(trim(dish));

SELECT (SELECT count(*) FROM public.ai_dish_costs) AS dish_costs_published,
       (SELECT run FROM public.ai_model_runs ORDER BY published_at DESC LIMIT 1) AS current_run;
COMMIT;
SQL
)"
printf '%s\n' "${sql//__COSTS_PATH__/$costs_abs}" | psql "$TARGET_DB_URL" -X -q -v ON_ERROR_STOP=1 -v run="$run" -v metrics="$metrics_json"
echo "Published $run."
