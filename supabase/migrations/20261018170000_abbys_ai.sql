-- Abby's AI (beta): the ML baseline (ml/) inside the catering system.
--
--   abby_ai_quote_check()   is a quote in line with what this client usually
--                           pays for this meal? (the "price book": the
--                           client's last price for the same meal, else
--                           their usual ratio to the market, else the market
--                           median). Live from orders. Back-tested on 2,675
--                           events: price band exact 87%, error ~9%, vs 41%
--                           / 28% for the market median alone.
--   abby_ai_menu_ideas()    the dishes most served for this meal, weighted
--                           toward events at the same price band. Live from
--                           daily_menus.
--   ai_dish_costs           estimated ingredient cost per plate, per dish,
--                           published from a trained model run
--                           (scripts/db/publish-ai-model.sh). Admin, general
--                           manager and finance only.
--   ai_model_runs           which model run is published, with its scores.
--   ai_feedback             testers' thumbs up / down and comments.
--
-- Same definitions as ml/abby_ml: events from orders that are not test and
-- not cancelled, with a price of at least 1,000 and a readable date; meal =
-- the meals named in the event's meal type; price bands as in
-- ml/abby_ml/data.py.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.abby_ai_menu_ideas(text, numeric, integer);
--   DROP FUNCTION IF EXISTS public.abby_ai_quote_check(text, text, numeric, date);
--   DROP FUNCTION IF EXISTS public.abby_ai_events();
--   DROP FUNCTION IF EXISTS public.abby_ai_price_band(numeric);
--   DROP FUNCTION IF EXISTS public.abby_ai_meal_key(text);
--   DROP TABLE IF EXISTS public.ai_feedback, public.ai_dish_costs, public.ai_model_runs;

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- "Breakfast and lunch" -> 'breakfast+lunch'; "Lunch only" -> 'lunch'.
CREATE OR REPLACE FUNCTION public.abby_ai_meal_key(p_meal_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(nullif(concat_ws('+',
    CASE WHEN lower(p_meal_type) LIKE '%breakfast%' THEN 'breakfast' END,
    CASE WHEN lower(p_meal_type) LIKE '%brunch%' THEN 'brunch' END,
    CASE WHEN lower(p_meal_type) LIKE '%lunch%' THEN 'lunch' END,
    CASE WHEN lower(p_meal_type) LIKE '%tea%' THEN 'evening tea' END,
    CASE WHEN lower(p_meal_type) ~ '(dinner|supper)' THEN 'dinner' END,
    CASE WHEN lower(p_meal_type) LIKE '%cocktail%' THEN 'cocktail' END
  ), ''), 'other');
$$;

CREATE OR REPLACE FUNCTION public.abby_ai_price_band(p_price numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_price IS NULL      THEN NULL
    WHEN p_price < 6000       THEN 'A <6k'
    WHEN p_price < 11000      THEN 'B 6-11k'
    WHEN p_price < 15000      THEN 'C 11-15k'
    WHEN p_price < 22000      THEN 'D 15-22k'
    WHEN p_price < 30000      THEN 'E 22-30k'
    ELSE 'F 30k+'
  END;
$$;

-- Priced, real events (one row per event). Internal: used by the functions
-- below, not granted to users.
CREATE OR REPLACE FUNCTION public.abby_ai_events()
RETURNS TABLE (event_id text, order_id text, client_id text, event_date date, meal_type text,
               meal text, pax numeric, unit_price numeric, region text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH raw AS (
    SELECT o.id AS order_id, nullif(trim(o.client_id), '') AS client_id, o.region AS order_region, e.item
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o."clientEvents") = 'array' THEN o."clientEvents" ELSE '[]'::jsonb END
    ) AS e(item)
    WHERE NOT o.is_test
      AND coalesce(o.status, '') <> 'cancelled'
      AND jsonb_typeof(e.item) = 'object'
  ),
  parsed AS (
    SELECT
      nullif(trim(item ->> 'id'), '') AS event_id, order_id, client_id,
      CASE WHEN nullif(item ->> 'date', '') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])' THEN
        CASE WHEN extract(month FROM (substr(item ->> 'date', 1, 8) || '01')::date
                                     + (substr(item ->> 'date', 9, 2)::int - 1))
                  = substr(item ->> 'date', 6, 2)::int
             THEN (substr(item ->> 'date', 1, 8) || '01')::date + (substr(item ->> 'date', 9, 2)::int - 1)
        END
      END AS event_date,
      nullif(trim(item ->> 'mealType'), '') AS meal_type,
      CASE jsonb_typeof(item -> 'numberOfPeople')
        WHEN 'number' THEN (item ->> 'numberOfPeople')::numeric
        WHEN 'string' THEN CASE WHEN trim(item ->> 'numberOfPeople') ~ '^\d+(\.\d+)?$'
                                THEN trim(item ->> 'numberOfPeople')::numeric END
      END AS pax,
      CASE jsonb_typeof(item -> 'unitPrice')
        WHEN 'number' THEN (item ->> 'unitPrice')::numeric
        WHEN 'string' THEN CASE WHEN trim(item ->> 'unitPrice') ~ '^\d+(\.\d+)?$'
                                THEN trim(item ->> 'unitPrice')::numeric END
      END AS unit_price,
      coalesce(nullif(trim(item ->> 'region'), ''), order_region) AS region
    FROM raw
  )
  SELECT event_id, order_id, client_id, event_date, meal_type, public.abby_ai_meal_key(meal_type),
         pax, unit_price, region
  FROM parsed
  WHERE event_date IS NOT NULL AND unit_price >= 1000 AND coalesce(pax, 0) > 0;
$$;

REVOKE ALL ON FUNCTION public.abby_ai_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abby_ai_events() FROM anon, authenticated;

-- ── Quote check ─────────────────────────────────────────────────────────────

-- Expected price for a quote, from events BEFORE p_date (default: today).
CREATE OR REPLACE FUNCTION public.abby_ai_quote_check(
  p_client_id text,
  p_meal_type text,
  p_price     numeric DEFAULT NULL,
  p_date      date    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date     date := coalesce(p_date, (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date);
  v_meal     text := public.abby_ai_meal_key(p_meal_type);
  v_market   numeric;
  v_expected numeric;
  v_source   text;
  v_same     jsonb;
  v_client_n int;
  v_ratio    numeric;
  v_recent   jsonb;
  v_diff     numeric;
  v_verdict  text;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  -- Every query reads public.abby_ai_events() up to the day before v_date
  -- (no temp table: the function is STABLE and called read-only).
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY e.unit_price) INTO v_market
  FROM public.abby_ai_events() e WHERE e.event_date < v_date AND e.meal = v_meal;
  IF v_market IS NULL THEN
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY e.unit_price) INTO v_market
    FROM public.abby_ai_events() e WHERE e.event_date < v_date;
  END IF;

  SELECT count(*) INTO v_client_n
  FROM public.abby_ai_events() e WHERE e.event_date < v_date AND e.client_id = p_client_id;

  SELECT jsonb_build_object(
           'events', count(*),
           'last_price', (array_agg(e.unit_price ORDER BY e.event_date DESC, e.event_id DESC))[1],
           'last_date', max(e.event_date),
           'median_price', percentile_cont(0.5) WITHIN GROUP (ORDER BY e.unit_price),
           'min_price', min(e.unit_price),
           'max_price', max(e.unit_price))
    INTO v_same
  FROM public.abby_ai_events() e
  WHERE e.event_date < v_date AND e.client_id = p_client_id AND e.meal = v_meal
  HAVING count(*) > 0;

  IF v_same IS NOT NULL THEN
    v_expected := (v_same ->> 'last_price')::numeric;
    v_source := 'client_same_meal';
  ELSIF v_client_n > 0 THEN
    WITH ev AS (
      SELECT * FROM public.abby_ai_events() e WHERE e.event_date < v_date
    ), mk AS (
      SELECT ev.meal, percentile_cont(0.5) WITHIN GROUP (ORDER BY ev.unit_price) AS med FROM ev GROUP BY ev.meal
    )
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ev.unit_price / mk.med) INTO v_ratio
    FROM ev JOIN mk ON mk.meal = ev.meal
    WHERE ev.client_id = p_client_id AND mk.med > 0;
    v_expected := round(v_market * coalesce(v_ratio, 1));
    v_source := 'client_other_meals';
  ELSE
    v_expected := v_market;
    v_source := 'market';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.event_date DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT e.event_id, e.order_id, e.event_date, e.meal_type, e.pax, e.unit_price
    FROM public.abby_ai_events() e
    WHERE e.event_date < v_date AND e.client_id = p_client_id
    ORDER BY e.event_date DESC, e.event_id DESC LIMIT 8
  ) r;

  IF p_price IS NOT NULL AND v_expected > 0 THEN
    v_diff := round(p_price / v_expected - 1, 3);
    v_verdict := CASE WHEN v_diff <= -0.10 THEN 'low' WHEN v_diff >= 0.10 THEN 'high' ELSE 'ok' END;
  END IF;

  RETURN jsonb_build_object(
    'meal', v_meal,
    'expected_price', round(v_expected),
    'expected_band', public.abby_ai_price_band(v_expected),
    'expected_from', v_source,
    'market_median', round(v_market),
    'same_meal', v_same,
    'client_events', v_client_n,
    'recent', v_recent,
    'price', p_price,
    'price_band', public.abby_ai_price_band(p_price),
    'diff_pct', v_diff,
    'verdict', v_verdict
  );
END;
$$;

REVOKE ALL ON FUNCTION public.abby_ai_quote_check(text, text, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abby_ai_quote_check(text, text, numeric, date) TO authenticated;

-- ── Menu ideas ──────────────────────────────────────────────────────────────

-- For each meal section of the meal type: the dishes served most often,
-- weighted toward events at the same price band (0.8 band share + 0.2
-- overall share, when the band has at least 10 events in that section).
CREATE OR REPLACE FUNCTION public.abby_ai_menu_ideas(p_meal_type text, p_price numeric DEFAULT NULL, p_limit integer DEFAULT 8)
RETURNS TABLE (section text, dish_key text, recipe_id text, recipe_name text,
               events integer, share numeric, band_share numeric, score numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_band text := public.abby_ai_price_band(p_price);
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH wanted(section) AS (
    SELECT s FROM unnest(ARRAY['Breakfast', 'Brunch', 'Lunch', 'Evening Tea', 'Dinner', 'Cocktail']) s
    WHERE position(lower(s) IN public.abby_ai_meal_key(p_meal_type)) > 0
  ),
  ev AS (
    SELECT e.event_id, public.abby_ai_price_band(e.unit_price) AS band FROM public.abby_ai_events() e
  ),
  dishes AS (
    SELECT DISTINCT dm.event_id,
      CASE
        WHEN ri BETWEEN 1 AND 10    THEN 'Breakfast'
        WHEN ri BETWEEN 12 AND 26   THEN 'Lunch'
        WHEN ri BETWEEN 100 AND 110 THEN 'Brunch'
        WHEN ri BETWEEN 111 AND 125 THEN 'Evening Tea'
        WHEN ri BETWEEN 126 AND 145 THEN 'Dinner'
        WHEN ri BETWEEN 146 AND 165 THEN 'Cocktail'
      END AS section,
      trim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(r."recipeName", nullif(trim(d.item ->> 'name'), ''))),
           '\s+', ' ', 'g'), '\(\s+', '(', 'g'), '\s+\)', ')', 'g')) AS dish_key,
      r."recipeNumber" AS recipe_id, r."recipeName" AS recipe_name
    FROM public.daily_menus dm
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(dm.recipes) = 'array' THEN dm.recipes ELSE '[]'::jsonb END
    ) AS d(item)
    CROSS JOIN LATERAL (SELECT CASE WHEN trim(d.item ->> 'rowIndex') ~ '^\d+$' THEN trim(d.item ->> 'rowIndex')::int END AS ri) k
    LEFT JOIN public.recipes r
           ON jsonb_typeof(d.item -> 'recipeId') = 'string' AND r."recipeNumber" = trim(d.item ->> 'recipeId')
    WHERE jsonb_typeof(d.item) = 'object'
  ),
  served AS (
    SELECT x.section, x.dish_key, x.event_id, ev.band,
           x.recipe_id, x.recipe_name
    FROM dishes x
    JOIN ev ON ev.event_id = x.event_id
    JOIN wanted w ON w.section = x.section
    WHERE x.dish_key IS NOT NULL AND x.dish_key <> ''
  ),
  totals AS (
    SELECT section, count(DISTINCT event_id) AS n,
           count(DISTINCT event_id) FILTER (WHERE band = v_band) AS n_band
    FROM served GROUP BY section
  ),
  per_dish AS (
    SELECT s.section, s.dish_key,
           mode() WITHIN GROUP (ORDER BY s.recipe_id) AS recipe_id,
           mode() WITHIN GROUP (ORDER BY s.recipe_name) AS recipe_name,
           count(DISTINCT s.event_id) AS n_dish,
           count(DISTINCT s.event_id) FILTER (WHERE s.band = v_band) AS n_dish_band
    FROM served s GROUP BY s.section, s.dish_key
  ),
  scored AS (
    SELECT p.section, p.dish_key, p.recipe_id, p.recipe_name, p.n_dish::int AS events,
           round(p.n_dish::numeric / t.n, 3) AS share,
           CASE WHEN t.n_band >= 10 THEN round(p.n_dish_band::numeric / t.n_band, 3) END AS band_share,
           round(CASE WHEN t.n_band >= 10 THEN 0.8 * p.n_dish_band::numeric / t.n_band + 0.2 * p.n_dish::numeric / t.n
                      ELSE p.n_dish::numeric / t.n END, 3) AS score,
           row_number() OVER (PARTITION BY p.section ORDER BY
             CASE WHEN t.n_band >= 10 THEN 0.8 * p.n_dish_band::numeric / t.n_band + 0.2 * p.n_dish::numeric / t.n
                  ELSE p.n_dish::numeric / t.n END DESC, p.n_dish DESC, p.dish_key) AS rn
    FROM per_dish p JOIN totals t USING (section)
    WHERE p.n_dish >= 3
  )
  SELECT section, dish_key, recipe_id, recipe_name, events, share, band_share, score
  FROM scored
  WHERE rn <= greatest(1, least(coalesce(p_limit, 8), 30))
  ORDER BY array_position(ARRAY['Breakfast', 'Brunch', 'Lunch', 'Evening Tea', 'Dinner', 'Cocktail'], section), rn;
END;
$$;

REVOKE ALL ON FUNCTION public.abby_ai_menu_ideas(text, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abby_ai_menu_ideas(text, numeric, integer) TO authenticated;

-- ── Published model: cost per plate ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_model_runs (
  run          text PRIMARY KEY,
  note         text,
  metrics      jsonb,
  published_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_dish_costs (
  dish_key       text PRIMARY KEY,
  meal_section   text,
  cost_per_plate numeric(12,2) NOT NULL CHECK (cost_per_plate >= 0),
  model_run      text NOT NULL REFERENCES public.ai_model_runs(run),
  published_at   timestamptz DEFAULT now()
);

ALTER TABLE public.ai_model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dish_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_model_runs_staff_select ON public.ai_model_runs;
CREATE POLICY ai_model_runs_staff_select ON public.ai_model_runs
  FOR SELECT TO authenticated USING (public.is_active_staff());

-- Ingredient costs and margins: admin, general manager and finance only.
DROP POLICY IF EXISTS ai_dish_costs_managers_select ON public.ai_dish_costs;
CREATE POLICY ai_dish_costs_managers_select ON public.ai_dish_costs
  FOR SELECT TO authenticated USING (public.has_staff_role(ARRAY['admin', 'general_manager', 'finance']));
-- No insert / update / delete policies: rows come from scripts/db/publish-ai-model.sh.

-- ── Testers' feedback ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tool       text NOT NULL CHECK (tool IN ('quote', 'menu', 'cost')),
  input      jsonb,
  output     jsonb,
  rating     smallint NOT NULL CHECK (rating IN (-1, 1)),
  comment    text,
  model_run  text,
  created_by uuid REFERENCES auth.users(id) DEFAULT public.safe_auth_uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_feedback_staff_insert ON public.ai_feedback;
CREATE POLICY ai_feedback_staff_insert ON public.ai_feedback
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND created_by = public.safe_auth_uid());

DROP POLICY IF EXISTS ai_feedback_read ON public.ai_feedback;
CREATE POLICY ai_feedback_read ON public.ai_feedback
  FOR SELECT TO authenticated
  USING (created_by = public.safe_auth_uid() OR public.can_manage_settings());
