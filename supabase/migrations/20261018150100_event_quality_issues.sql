-- Data readiness Phase 3, Step 7: one row per event that needs fixing, with
-- the list of its problems. Read by the admin Data Quality page.
--
-- Issues (text values in issues[]):
--   'no date'                   date missing or not a real date
--   'pax <= 0'                  numberOfPeople missing, not a number, or <= 0
--   'unit price = 0'            unitPrice missing, not a number, or 0
--   'no menu'                   a past event with no daily menu (with at least
--                               one dish) posted for it
--   'no meal type'              mealType empty
--   'date outside order dates'  event date before the order's start_date or
--                               after its end_date
--   'duplicate event id'        the same EVT id on more than one event
--   'recipe id not found'       a dish on the event's menu (or a recipe on the
--                               event) whose recipeId is not in recipes
--
-- 'no menu' replaces the brief's "no recipes": events never carry recipes
-- (clientEvents[].recipes is empty on all 2,713 events, baseline check A), the
-- dishes served are recorded per event in daily_menus. A menu counts for an
-- event when daily_menus.event_id is the event's id, or (mistyped id) when
-- the menu's order has only that event on the menu date — the same rule as
-- supabase/exports/40_ml_event_menus.sql. Events after today are not flagged.
--
-- Leaves out test orders (orders.is_test) and cancelled orders.
-- Security definer, so it sees every order and menu whatever the caller's
-- RLS; only callers who may edit orders (can_manage_ops(), the same check as
-- the 'ops.manage' permission in src/lib/permissions.ts) get rows.
--
-- Rollback: DROP FUNCTION IF EXISTS public.event_quality_issues();

CREATE OR REPLACE FUNCTION public.event_quality_issues()
RETURNS TABLE (
  order_id     text,
  client_id    text,
  order_status text,
  event_id     text,
  event_date   date,
  issues       text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_manage_ops() THEN
    RAISE EXCEPTION 'Not allowed: only staff who can edit orders can list event issues'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH ord AS (
    SELECT o.id, nullif(o.client_id, '') AS client_id, o.status,
           CASE WHEN o.start_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
             CASE WHEN to_char(to_date(o.start_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') = o.start_date
                  THEN to_date(o.start_date, 'YYYY-MM-DD') END END AS start_d,
           CASE WHEN o.end_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
             CASE WHEN to_char(to_date(o.end_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') = o.end_date
                  THEN to_date(o.end_date, 'YYYY-MM-DD') END END AS end_d,
           CASE WHEN jsonb_typeof(o."clientEvents") = 'array' THEN o."clientEvents" ELSE '[]'::jsonb END AS events
    FROM public.orders o
    WHERE NOT o.is_test
      AND coalesce(o.status, '') <> 'cancelled'
  ),
  ev AS (
    SELECT
      ord.id AS order_id, ord.client_id, ord.status, ord.start_d, ord.end_d,
      e.item,
      nullif(trim(e.item ->> 'id'), '') AS event_id,
      CASE WHEN nullif(e.item ->> 'date', '') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])' THEN
        CASE WHEN extract(month FROM (substr(e.item ->> 'date', 1, 8) || '01')::date
                                     + (substr(e.item ->> 'date', 9, 2)::int - 1))
                  = substr(e.item ->> 'date', 6, 2)::int
             THEN (substr(e.item ->> 'date', 1, 8) || '01')::date + (substr(e.item ->> 'date', 9, 2)::int - 1)
        END
      END AS ev_date,
      CASE jsonb_typeof(e.item -> 'numberOfPeople')
        WHEN 'number' THEN (e.item ->> 'numberOfPeople')::numeric
        WHEN 'string' THEN CASE WHEN trim(e.item ->> 'numberOfPeople') ~ '^-?\d+(\.\d+)?$'
                                THEN nullif(trim(e.item ->> 'numberOfPeople'), '')::numeric END
      END AS pax,
      CASE jsonb_typeof(e.item -> 'unitPrice')
        WHEN 'number' THEN (e.item ->> 'unitPrice')::numeric
        WHEN 'string' THEN CASE WHEN trim(e.item ->> 'unitPrice') ~ '^-?\d+(\.\d+)?$'
                                THEN nullif(trim(e.item ->> 'unitPrice'), '')::numeric END
      END AS unit_price,
      nullif(trim(e.item ->> 'mealType'), '') AS meal_type
    FROM ord
    CROSS JOIN LATERAL jsonb_array_elements(ord.events) AS e(item)
    WHERE jsonb_typeof(e.item) = 'object'
  ),
  -- Duplicates are counted over every order, test and cancelled included:
  -- a cancelled order still holds the id.
  all_ids AS (
    SELECT nullif(trim(e.item ->> 'id'), '') AS event_id, count(*) AS n
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o."clientEvents") = 'array' THEN o."clientEvents" ELSE '[]'::jsonb END
    ) AS e(item)
    WHERE jsonb_typeof(e.item) = 'object'
    GROUP BY 1
  ),
  menu_link AS (
    -- Each daily menu, attached to its event directly or through order + date.
    SELECT dm.id AS menu_id, dm.recipes,
           coalesce(direct.event_id, rec.event_id) AS event_id
    FROM public.daily_menus dm
    LEFT JOIN LATERAL (
      SELECT x.event_id FROM ev x WHERE x.event_id = nullif(trim(dm.event_id), '') LIMIT 1
    ) direct ON true
    LEFT JOIN LATERAL (
      SELECT min(x.event_id) AS event_id
      FROM ev x
      WHERE direct.event_id IS NULL
        AND x.order_id = dm.order_id AND x.ev_date = dm.menu_date
      HAVING count(*) = 1
    ) rec ON true
  ),
  menus AS (
    -- A menu saved with no dishes does not count as posted.
    SELECT ml.event_id, count(*) AS n_menus
    FROM menu_link ml
    WHERE ml.event_id IS NOT NULL
      AND jsonb_typeof(ml.recipes) = 'array'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(ml.recipes) d(item) WHERE jsonb_typeof(d.item) = 'object')
    GROUP BY 1
  ),
  -- recipeIds on the event's menus, and on the event itself (normally none).
  used_recipe_ids AS (
    SELECT ml.event_id, nullif(trim(d.item ->> 'recipeId'), '') AS recipe_id
    FROM menu_link ml
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(ml.recipes) = 'array' THEN ml.recipes ELSE '[]'::jsonb END
    ) AS d(item)
    WHERE ml.event_id IS NOT NULL
      AND jsonb_typeof(d.item) = 'object'
      AND jsonb_typeof(d.item -> 'recipeId') = 'string'
    UNION ALL
    SELECT ev.event_id,
           CASE jsonb_typeof(r.item)
             WHEN 'string' THEN nullif(trim(r.item #>> '{}'), '')
             WHEN 'object' THEN nullif(trim(coalesce(r.item ->> 'recipeId', r.item ->> 'recipeNumber', r.item ->> 'id')), '')
           END
    FROM ev
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(ev.item -> 'recipes') = 'array' THEN ev.item -> 'recipes' ELSE '[]'::jsonb END
    ) AS r(item)
  ),
  bad_recipes AS (
    SELECT u.event_id
    FROM used_recipe_ids u
    WHERE u.recipe_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r."recipeNumber" = u.recipe_id)
    GROUP BY 1
  ),
  flagged AS (
    SELECT
      ev.order_id, ev.client_id, ev.status, ev.event_id, ev.ev_date,
      array_remove(ARRAY[
        CASE WHEN ev.ev_date IS NULL THEN 'no date' END,
        CASE WHEN ev.pax IS NULL OR ev.pax <= 0 THEN 'pax <= 0' END,
        CASE WHEN ev.unit_price IS NULL OR ev.unit_price = 0 THEN 'unit price = 0' END,
        CASE WHEN m.event_id IS NULL
                  AND coalesce(ev.ev_date <= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date, true)
             THEN 'no menu' END,
        CASE WHEN ev.meal_type IS NULL THEN 'no meal type' END,
        CASE WHEN ev.ev_date IS NOT NULL
                  AND ((ev.start_d IS NOT NULL AND ev.ev_date < ev.start_d)
                    OR (ev.end_d IS NOT NULL AND ev.ev_date > ev.end_d))
             THEN 'date outside order dates' END,
        CASE WHEN a.n > 1 THEN 'duplicate event id' END,
        CASE WHEN b.event_id IS NOT NULL THEN 'recipe id not found' END
      ], NULL) AS issues
    FROM ev
    LEFT JOIN menus m ON m.event_id = ev.event_id
    LEFT JOIN all_ids a ON a.event_id = ev.event_id
    LEFT JOIN bad_recipes b ON b.event_id = ev.event_id
  )
  SELECT f.order_id, f.client_id, f.status, f.event_id, f.ev_date, f.issues
  FROM flagged f
  WHERE cardinality(f.issues) > 0
  ORDER BY f.ev_date NULLS FIRST, f.order_id, f.event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.event_quality_issues() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_quality_issues() FROM anon;
GRANT EXECUTE ON FUNCTION public.event_quality_issues() TO authenticated;
