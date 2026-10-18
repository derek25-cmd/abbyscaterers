-- ============================================================================
-- 20_ml_dishes_served.sql: one row per dish on a daily menu (menu
-- recommendation dataset)
-- ============================================================================
--
-- READ-ONLY: a single SELECT. Run it in the Supabase SQL Editor, export the
-- result as CSV and save it as  ml-data/ml_dishes_served.csv  (gitignored).
-- Join it to ml_events.csv on event_id for pax, client type, meal type and
-- price.
--
-- Source: daily_menus.recipes = [{rowIndex, recipeId?, name}]. The meal
-- slot comes from rowIndex, which the menu pages assign by section:
--   daily-menu page   (app/reports/daily-menu/page.tsx:37-40)
--      1-10 Breakfast, 12-26 Lunch   (0 and 11 are header rows, never saved)
--   special-menu page (app/reports/special-menu/page.tsx:26-31)
--      100-110 Brunch, 111-125 Evening Tea, 126-145 Dinner, 146-165 Cocktail
-- recipes."recipeType" is NOT used for the slot: it is unreliable (e.g.
-- "Beef roast" typed Breakfast, values outside the app's own list).
--
-- dish_key normalises the name (lower case, spaces collapsed, no spaces
-- inside brackets) so "Juice ( fresh )" and "juice (fresh)" group together.
-- Merging different recipes that are the same dish (e.g. RN-00225, RN-00275,
-- RN-00191 are all fresh juice) is left to the analysis / a mapping file.
--
-- If the editor cuts the export off, narrow the date range in "params".
-- ============================================================================
WITH params AS (
  SELECT DATE '2000-01-01' AS from_date,   -- edit to export in parts
         DATE '2100-12-31' AS to_date
),
dishes AS (
  SELECT
    dm.id                                                    AS daily_menu_id,
    dm.menu_date,
    nullif(to_jsonb(dm) ->> 'event_id', '')                  AS event_id,
    dm.order_id,
    nullif(to_jsonb(dm) ->> 'region', '')                    AS region,
    d.pos                                                    AS position_in_menu,
    CASE jsonb_typeof(d.item -> 'rowIndex')
      WHEN 'number' THEN CASE WHEN (d.item ->> 'rowIndex') ~ '^\d+$' THEN (d.item ->> 'rowIndex')::int END
      WHEN 'string' THEN CASE WHEN trim(d.item ->> 'rowIndex') ~ '^\d+$' THEN trim(d.item ->> 'rowIndex')::int END
    END                                                      AS row_index,
    CASE WHEN jsonb_typeof(d.item -> 'recipeId') = 'string'
         THEN nullif(trim(d.item ->> 'recipeId'), '') END    AS recipe_id,
    nullif(trim(d.item ->> 'name'), '')                      AS dish_name
  FROM public.daily_menus dm
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dm.recipes) = 'array' THEN dm.recipes ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS d(item, pos)
  CROSS JOIN params prm
  WHERE jsonb_typeof(d.item) = 'object'
    AND dm.menu_date BETWEEN prm.from_date AND prm.to_date
)
SELECT
  x.daily_menu_id,
  x.menu_date,
  extract(isodow FROM x.menu_date)::int                      AS weekday_iso,
  to_char(x.menu_date, 'YYYY-MM')                            AS month,
  x.event_id,
  x.order_id,
  x.region,
  CASE
    WHEN x.region IN ('Dar es Salaam', 'Morogoro', 'Pwani') THEN 'Dar es Salaam'
    WHEN x.region = 'Arusha'                                THEN 'Arusha'
    WHEN x.region IN ('Dodoma', 'Mwanza', 'Mbeya')          THEN 'Dodoma'
  END                                                        AS branch,
  x.row_index,
  CASE
    WHEN x.row_index BETWEEN 1 AND 10    THEN 'Breakfast'
    WHEN x.row_index BETWEEN 12 AND 26   THEN 'Lunch'
    WHEN x.row_index BETWEEN 100 AND 110 THEN 'Brunch'
    WHEN x.row_index BETWEEN 111 AND 125 THEN 'Evening Tea'
    WHEN x.row_index BETWEEN 126 AND 145 THEN 'Dinner'
    WHEN x.row_index BETWEEN 146 AND 165 THEN 'Cocktail'
  END                                                        AS meal_section,
  x.position_in_menu,
  x.recipe_id,
  r."recipeName"                                             AS recipe_name,
  r."recipeType"                                             AS recipe_type_as_entered,
  x.dish_name,
  trim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(r."recipeName", x.dish_name)),
       '\s+', ' ', 'g'), '\(\s+', '(', 'g'), '\s+\)', ')', 'g'))           AS dish_key,
  (x.recipe_id IS NULL)                                      AS flag_no_recipe_id,
  (x.recipe_id IS NOT NULL AND r."recipeNumber" IS NULL)     AS flag_recipe_id_unknown,
  (x.event_id IS NULL)                                       AS flag_no_event_id,
  (x.row_index IS NULL OR NOT (x.row_index BETWEEN 1 AND 10 OR x.row_index BETWEEN 12 AND 26
                               OR x.row_index BETWEEN 100 AND 165)) AS flag_unknown_section
FROM dishes x
LEFT JOIN public.recipes r ON r."recipeNumber" = x.recipe_id
ORDER BY x.menu_date, x.event_id, x.row_index;
