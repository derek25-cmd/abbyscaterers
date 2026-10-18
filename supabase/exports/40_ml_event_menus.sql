-- ============================================================================
-- 40_ml_event_menus.sql: one row per event that has a posted menu: the price
-- per plate next to the dishes served (price / menu dataset)
-- ============================================================================
--
-- READ-ONLY: a single SELECT. Run it in the Supabase SQL Editor, export the
-- result as CSV and save it as  ml-data/ml_event_menus.csv  (gitignored).
-- Contains ids and business figures only: no client names or contacts.
--
-- Link: daily_menus.event_id = the event's id in orders."clientEvents".
-- A menu whose event_id matches no event (typos such as EVT-00000 or an
-- order number) is recovered when its order has exactly one event on the
-- menu date (flag_link_recovered); otherwise it is left out. Events without
-- a menu are not in this file (they are in ml_events.csv).
--
-- Event parsing and the region -> branch map are the same as
-- 10_ml_events.sql; meal sections are the same as 20_ml_dishes_served.sql.
-- Nothing is dropped for quality: problem rows are flagged (flag_*).
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
    r.order_id, r.client_id, r.order_status, r.events_in_order,
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
per_event AS (
  SELECT
    event_id,
    count(DISTINCT daily_menu_id)                            AS menu_days,
    min(menu_date)                                           AS first_menu_date,
    max(menu_date)                                           AS last_menu_date,
    count(*)                                                 AS dishes_total,
    count(*) FILTER (WHERE meal_section = 'Breakfast')       AS n_breakfast,
    count(*) FILTER (WHERE meal_section = 'Lunch')           AS n_lunch,
    count(*) FILTER (WHERE meal_section = 'Brunch')          AS n_brunch,
    count(*) FILTER (WHERE meal_section = 'Evening Tea')     AS n_evening_tea,
    count(*) FILTER (WHERE meal_section = 'Dinner')          AS n_dinner,
    count(*) FILTER (WHERE meal_section = 'Cocktail')        AS n_cocktail,
    count(*) FILTER (WHERE meal_section IS NULL)             AS n_unknown_section,
    array_agg(DISTINCT meal_section ORDER BY meal_section)
      FILTER (WHERE meal_section IS NOT NULL)                AS sections,
    string_agg(DISTINCT recipe_id, '|' ORDER BY recipe_id)   AS recipe_ids,
    string_agg(DISTINCT dish_key, '|' ORDER BY dish_key)     AS dish_keys,
    count(*) FILTER (WHERE recipe_id IS NULL)                AS n_no_recipe_id,
    bool_or(link_recovered)                                  AS link_recovered
  FROM dishes
  GROUP BY event_id
)
SELECT
  e.event_id,
  e.order_id,
  e.events_in_order,
  e.client_id,
  c."typeOfOrganization"                                     AS client_type,
  e.event_date,
  extract(isodow FROM e.event_date)::int                     AS weekday_iso,       -- 1 = Monday
  to_char(e.event_date, 'YYYY-MM')                           AS month,
  e.region,
  CASE
    WHEN e.region IN ('Dar es Salaam', 'Morogoro', 'Pwani') THEN 'Dar es Salaam'
    WHEN e.region = 'Arusha'                                THEN 'Arusha'
    WHEN e.region IN ('Dodoma', 'Mwanza', 'Mbeya')          THEN 'Dodoma'
  END                                                        AS branch,
  e.meal_type,
  e.particular_type,
  e.event_type,
  e.pax,
  e.unit_price,
  e.vat_type,
  round(CASE e.vat_type
          WHEN 'inclusive' THEN e.unit_price / (1 + prm.vat_rate)
          WHEN 'exclusive' THEN e.unit_price
        END, 2)                                              AS price_per_plate_ex_vat,
  pe.menu_days,
  pe.first_menu_date,
  pe.last_menu_date,
  pe.dishes_total,
  round(pe.dishes_total::numeric / pe.menu_days, 1)          AS dishes_per_day,
  pe.n_breakfast, pe.n_lunch, pe.n_brunch, pe.n_evening_tea, pe.n_dinner, pe.n_cocktail,
  pe.n_unknown_section,
  array_to_string(pe.sections, '+')                          AS meal_sections,
  pe.recipe_ids,
  pe.dish_keys,
  pe.n_no_recipe_id,
  coalesce(e.order_status = 'cancelled', false)              AS flag_cancelled,
  (e.event_date IS NULL)                                     AS flag_date_unreadable,
  coalesce(e.event_date > prm.today_dar, false)              AS flag_future,
  (e.pax IS NULL OR e.pax <= 0)                              AS flag_bad_pax,
  (e.unit_price IS NULL OR e.unit_price <= 0)                AS flag_zero_price,
  (e.vat_type IS NULL OR e.vat_type NOT IN ('inclusive', 'exclusive')) AS flag_vat_unknown,
  (e.region IS NULL)                                         AS flag_region_missing,
  pe.link_recovered                                          AS flag_link_recovered,
  (pe.first_menu_date <> e.event_date OR pe.last_menu_date <> e.event_date) AS flag_menu_date_differs,
  -- The meal type names none of the sections on the menu
  -- (e.g. "Lunch only" with only breakfast dishes).
  (e.meal_type IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM unnest(pe.sections) s
     WHERE lower(e.meal_type) LIKE '%' || lower(s) || '%'))  AS flag_meal_type_mismatch
FROM per_event pe
JOIN events e ON e.event_id = pe.event_id
CROSS JOIN params prm
LEFT JOIN public.clients c ON c.id = e.client_id
ORDER BY e.event_date NULLS FIRST, e.order_id, e.event_id;
