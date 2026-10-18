-- ============================================================================
-- export-dish-names.sql: dish names on daily menus with no recipe picked,
-- for the kitchen to map to a recipe
-- ============================================================================
--
-- READ-ONLY. Needs migration 20261018160000_dish_name_map.sql. Run with psql
-- against STAGING (later production), writing CSV:
--
--   mkdir -p docs/data-readiness/mappings
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 --csv \
--        -f scripts/db/export-dish-names.sql \
--        -o docs/data-readiness/mappings/dish_name_mapping.csv
--
-- One row per distinct unlinked dish name (raw_name = lower-cased, trimmed),
-- leaving out names already in dish_name_map. "Unlinked" = the dish on
-- daily_menus.recipes[] has no recipeId (missing or empty), the only dishes
-- scripts/db/apply-dish-mapping.sh will change.
--   times_served, first_menu_date, last_menu_date  how often and when
--   example_name                                   the most common spelling
--   suggestion_{1,2,3}_number / _name              closest recipes: by
--       pg_trgm similarity when that extension is installed, otherwise by
--       how many of the name's words (3+ letters) the recipe name contains
--       (ILIKE), closest length first (suggestion_method says which)
--   chosen_recipe_number                           EMPTY: the kitchen writes
--       the recipeNumber here (one of the suggestions or any other), or
--       leaves it blank to skip the name
-- Business data only: dish and recipe names, dates and counts.
-- ============================================================================
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS has_trgm \gset
\if :has_trgm
  \set rank_score 'similarity(lower(r."recipeName"), u.raw_name)'
  \set rank_method 'pg_trgm'
\else
  \set rank_score '(SELECT count(*) FROM name_tokens nt WHERE nt.raw_name = u.raw_name AND r."recipeName" ILIKE concat(chr(37), nt.token, chr(37)))'
  \set rank_method 'token'
\endif

WITH dishes AS (
  SELECT dm.menu_date, nullif(trim(d.item ->> 'name'), '') AS dish_name
  FROM public.daily_menus dm
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dm.recipes) = 'array' THEN dm.recipes ELSE '[]'::jsonb END
  ) AS d(item)
  WHERE jsonb_typeof(d.item) = 'object'
    AND (jsonb_typeof(d.item -> 'recipeId') IS DISTINCT FROM 'string'
         OR trim(d.item ->> 'recipeId') = '')
),
unlinked AS (
  SELECT lower(trim(x.dish_name))            AS raw_name,
         mode() WITHIN GROUP (ORDER BY x.dish_name) AS example_name,
         count(*)                            AS times_served,
         min(x.menu_date)                    AS first_menu_date,
         max(x.menu_date)                    AS last_menu_date
  FROM dishes x
  WHERE x.dish_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.dish_name_map m WHERE m.raw_name = lower(trim(x.dish_name)))
  GROUP BY 1
),
name_tokens AS (
  SELECT u.raw_name, t.token
  FROM unlinked u
  CROSS JOIN LATERAL regexp_split_to_table(u.raw_name, '[^a-z0-9]+') AS t(token)
  WHERE length(t.token) >= 3
),
ranked AS (
  SELECT u.raw_name, r."recipeNumber" AS recipe_number, r."recipeName" AS recipe_name,
         row_number() OVER (
           PARTITION BY u.raw_name
           ORDER BY :rank_score DESC,
                    abs(length(r."recipeName") - length(u.raw_name)),
                    r."recipeNumber"
         ) AS rn,
         :rank_score AS score
  FROM unlinked u
  CROSS JOIN public.recipes r
  WHERE r."recipeName" IS NOT NULL
)
SELECT
  u.raw_name,
  u.example_name,
  u.times_served,
  u.first_menu_date,
  u.last_menu_date,
  max(k.recipe_number) FILTER (WHERE k.rn = 1) AS suggestion_1_number,
  max(k.recipe_name)   FILTER (WHERE k.rn = 1) AS suggestion_1_name,
  max(k.recipe_number) FILTER (WHERE k.rn = 2) AS suggestion_2_number,
  max(k.recipe_name)   FILTER (WHERE k.rn = 2) AS suggestion_2_name,
  max(k.recipe_number) FILTER (WHERE k.rn = 3) AS suggestion_3_number,
  max(k.recipe_name)   FILTER (WHERE k.rn = 3) AS suggestion_3_name,
  :'rank_method'                               AS suggestion_method,
  ''::text                                     AS chosen_recipe_number
FROM unlinked u
LEFT JOIN ranked k ON k.raw_name = u.raw_name AND k.rn <= 3 AND k.score > 0
GROUP BY u.raw_name, u.example_name, u.times_served, u.first_menu_date, u.last_menu_date
ORDER BY u.times_served DESC, u.raw_name;
