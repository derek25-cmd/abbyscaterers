-- ============================================================================
-- 50_ml_daily_dish_plates.sql: plates served per dish, per day and branch
-- (to explain daily Stock Out by the menus served that day)
-- ============================================================================
--
-- READ-ONLY: a single SELECT. Run it in the Supabase SQL Editor (or psql
-- --csv), and save it as  ml-data/ml_daily_dish_plates.csv  (gitignored).
--
-- One row per menu date, branch, meal section and dish: how many events
-- served the dish that day and how many plates (sum of those events' pax).
-- Join it to ml_stock_movements.csv (30_ml_stock_movements.sql, type
-- 'Stock Out') on date + branch: the kitchen issues ingredients on the day of
-- the event (Dar es Salaam, Apr-Oct 2026: daily Stock Out value vs plates
-- served the same day r = 0.73; the day before 0.34, the day after -0.03).
-- Regressing a product's daily quantity on the plates of each dish gives the
-- quantity per plate the kitchen actually uses (an "observed recipe").
--
-- Menus are attached to events as in 40_ml_event_menus.sql (event_id, or
-- order + date for a mistyped id); a dish listed twice on one event's menu
-- counts once. Leaves out cancelled and test orders and events with no pax.
-- Region -> branch as in 10_ml_events.sql; events with no region are kept
-- with branch NULL (decide in the analysis; decision 2026-10-18: Dar es
-- Salaam data may stand for all branches).
-- ============================================================================
WITH params AS (
  SELECT DATE '2000-01-01' AS from_date,   -- edit to export in parts
         DATE '2100-12-31' AS to_date,
         0.18::numeric     AS vat_rate,    -- Tanzania standard VAT
         (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS today_dar
),
raw AS (
  SELECT
    o.id                                                          AS order_id,
    nullif(o.client_id, '')                                       AS client_id,
    to_jsonb(o) ->> 'status'                                      AS order_status,
    nullif(to_jsonb(o) ->> 'region', '')                          AS order_region,
    jsonb_array_length(o.events)                                  AS events_in_order,
    coalesce((to_jsonb(o) ->> 'is_test')::boolean, false)         AS is_test,
    e.ev
  FROM (
    SELECT o0.*, CASE WHEN jsonb_typeof(o0."clientEvents") = 'array'
                      THEN o0."clientEvents" ELSE '[]'::jsonb END AS events
    FROM public.orders o0
  ) o
  CROSS JOIN LATERAL jsonb_array_elements(o.events) AS e(ev)
  WHERE jsonb_typeof(e.ev) = 'object'
),
events AS (
  SELECT
    r.order_id, r.client_id, r.order_status, r.events_in_order, r.is_test,
    nullif(trim(r.ev ->> 'id'), '')                               AS event_id,
    CASE WHEN nullif(r.ev ->> 'date', '') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])' THEN
      CASE WHEN extract(month FROM (substr(r.ev ->> 'date', 1, 8) || '01')::date
                                   + (substr(r.ev ->> 'date', 9, 2)::int - 1))
                = substr(r.ev ->> 'date', 6, 2)::int
           THEN (substr(r.ev ->> 'date', 1, 8) || '01')::date + (substr(r.ev ->> 'date', 9, 2)::int - 1)
      END
    END                                                           AS event_date,
    CASE jsonb_typeof(r.ev -> 'numberOfPeople')
      WHEN 'number' THEN (r.ev ->> 'numberOfPeople')::numeric
      WHEN 'string' THEN CASE WHEN trim(r.ev ->> 'numberOfPeople') ~ '^-?\d+(\.\d+)?$'
                              THEN trim(r.ev ->> 'numberOfPeople')::numeric END
    END                                                           AS pax,
    CASE jsonb_typeof(r.ev -> 'unitPrice')
      WHEN 'number' THEN (r.ev ->> 'unitPrice')::numeric
      WHEN 'string' THEN CASE WHEN trim(r.ev ->> 'unitPrice') ~ '^-?\d+(\.\d+)?$'
                              THEN trim(r.ev ->> 'unitPrice')::numeric END
    END                                                           AS unit_price,
    nullif(trim(r.ev ->> 'vatType'), '')                          AS vat_type,
    nullif(trim(r.ev ->> 'mealType'), '')                         AS meal_type,
    nullif(trim(r.ev ->> 'particularType'), '')                   AS particular_type,
    nullif(trim(coalesce(nullif(r.ev ->> 'customEventType', ''), r.ev ->> 'eventType')), '') AS event_type,
    coalesce(nullif(trim(r.ev ->> 'region'), ''), r.order_region) AS region
  FROM raw r
),
menus AS (
  SELECT dm.id AS daily_menu_id, dm.menu_date, dm.order_id,
         nullif(trim(dm.event_id), '') AS menu_event_id, dm.recipes
  FROM public.daily_menus dm
  CROSS JOIN params prm
  WHERE dm.menu_date BETWEEN prm.from_date AND prm.to_date
),
linked AS (
  -- Direct link, or recovered through the order and the date.
  SELECT m.*,
         coalesce(direct.event_id, rec.event_id) AS event_id,
         (direct.event_id IS NULL)               AS link_recovered
  FROM menus m
  LEFT JOIN events direct ON direct.event_id = m.menu_event_id
  LEFT JOIN LATERAL (
    SELECT min(e.event_id) AS event_id
    FROM events e
    WHERE direct.event_id IS NULL
      AND e.order_id = m.order_id AND e.event_date = m.menu_date
    HAVING count(*) = 1
  ) rec ON true
),
dishes AS (
  SELECT
    l.event_id, l.daily_menu_id, l.menu_date, l.link_recovered,
    CASE
      WHEN ri BETWEEN 1 AND 10    THEN 'Breakfast'
      WHEN ri BETWEEN 12 AND 26   THEN 'Lunch'
      WHEN ri BETWEEN 100 AND 110 THEN 'Brunch'
      WHEN ri BETWEEN 111 AND 125 THEN 'Evening Tea'
      WHEN ri BETWEEN 126 AND 145 THEN 'Dinner'
      WHEN ri BETWEEN 146 AND 165 THEN 'Cocktail'
    END                                                      AS meal_section,
    rid                                                      AS recipe_id,
    trim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(r."recipeName", nullif(trim(d.item ->> 'name'), ''))),
         '\s+', ' ', 'g'), '\(\s+', '(', 'g'), '\s+\)', ')', 'g'))         AS dish_key
  FROM linked l
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(l.recipes) = 'array' THEN l.recipes ELSE '[]'::jsonb END
  ) AS d(item)
  CROSS JOIN LATERAL (SELECT
    CASE WHEN trim(d.item ->> 'rowIndex') ~ '^\d+$' THEN trim(d.item ->> 'rowIndex')::int END AS ri,
    CASE WHEN jsonb_typeof(d.item -> 'recipeId') = 'string'
         THEN nullif(trim(d.item ->> 'recipeId'), '') END    AS rid) k
  LEFT JOIN public.recipes r ON r."recipeNumber" = k.rid
  WHERE l.event_id IS NOT NULL
    AND jsonb_typeof(d.item) = 'object'
),
event_dish AS (
  SELECT DISTINCT d.event_id, d.menu_date, d.meal_section, d.recipe_id, d.dish_key
  FROM dishes d
)
SELECT
  x.menu_date,
  extract(isodow FROM x.menu_date)::int                      AS weekday_iso,
  to_char(x.menu_date, 'YYYY-MM')                            AS month,
  CASE
    WHEN e.region IN ('Dar es Salaam', 'Morogoro', 'Pwani') THEN 'Dar es Salaam'
    WHEN e.region = 'Arusha'                                THEN 'Arusha'
    WHEN e.region IN ('Dodoma', 'Mwanza', 'Mbeya')          THEN 'Dodoma'
  END                                                        AS branch,
  x.meal_section,
  x.dish_key,
  x.recipe_id,
  r."recipeName"                                             AS recipe_name,
  count(DISTINCT x.event_id)                                 AS events,
  sum(e.pax)                                                 AS plates
FROM event_dish x
JOIN events e ON e.event_id = x.event_id
LEFT JOIN public.recipes r ON r."recipeNumber" = x.recipe_id
WHERE coalesce(e.order_status, '') <> 'cancelled'
  AND NOT e.is_test
  AND e.pax > 0
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
ORDER BY x.menu_date, branch NULLS LAST, x.meal_section, plates DESC, x.dish_key;
