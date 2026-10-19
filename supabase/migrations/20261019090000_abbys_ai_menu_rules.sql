-- Abby's AI: the company's menu rules, and a wider pool of dishes.
--
-- Rules (decision 2026-10-19), enforced on every menu Abby's AI builds:
--   * Lunch and Dinner: a salad, fruits and peri-peri sauce;
--   * Lunch and Dinner above TZS 10,000 per plate: mineral drinking water;
--   * Breakfast: tea masala (the "black tea masala", RN-00175).
-- A rule is met by any dish of its kind (match_pattern, a JavaScript regular
-- expression on the dish name), e.g. "Mixed salad" meets the salad rule;
-- otherwise the rule's recipe is added. The menu history rarely has some of
-- them (peri-peri sauce on 1% of lunches, water on 3%), so they are rules,
-- not something the AI could learn.
--
-- Variety: abby_ai_menu_ideas() now returns up to 150 dishes per section
-- (dishes served at least twice; Lunch 156, Breakfast 115), so menus are
-- built from a pool of more than 70 dishes. Menu size and the mix of food
-- types grow with the price (src/lib/abbys-ai-menu.ts).
--
-- Staff read the rules; admins change them.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.ai_menu_rules;
--   and re-run the abby_ai_menu_ideas() definition from 20261018170000_abbys_ai.sql.

CREATE TABLE IF NOT EXISTS public.ai_menu_rules (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section       text NOT NULL CHECK (section IN ('Breakfast', 'Brunch', 'Lunch', 'Evening Tea', 'Dinner', 'Cocktail')),
  label         text NOT NULL,
  recipe_number text NOT NULL REFERENCES public.recipes("recipeNumber") ON UPDATE CASCADE,
  match_pattern text NOT NULL,
  min_price_exclusive numeric(12,2),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (section, label)
);

ALTER TABLE public.ai_menu_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_menu_rules_staff_select ON public.ai_menu_rules;
DROP POLICY IF EXISTS ai_menu_rules_admin_insert ON public.ai_menu_rules;
DROP POLICY IF EXISTS ai_menu_rules_admin_update ON public.ai_menu_rules;
DROP POLICY IF EXISTS ai_menu_rules_admin_delete ON public.ai_menu_rules;
CREATE POLICY ai_menu_rules_staff_select ON public.ai_menu_rules
  FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY ai_menu_rules_admin_insert ON public.ai_menu_rules
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_settings());
CREATE POLICY ai_menu_rules_admin_update ON public.ai_menu_rules
  FOR UPDATE TO authenticated USING (public.can_manage_settings()) WITH CHECK (public.can_manage_settings());
CREATE POLICY ai_menu_rules_admin_delete ON public.ai_menu_rules
  FOR DELETE TO authenticated USING (public.can_manage_settings());

-- Seed the rules. Only recipes that exist are used, and existing rules
-- (same section and label) are left as they are.
INSERT INTO public.ai_menu_rules (section, label, recipe_number, match_pattern, min_price_exclusive)
SELECT v.section, v.label, v.recipe_number, v.match_pattern, v.min_price
FROM (VALUES
  ('Lunch',     'Salad',                  'RN-00344', '^(?!.*fruit).*\bsalad\b', NULL::numeric),
  ('Lunch',     'Fruits',                 'RN-00266', '\bfruits?\b|\bpa(pai|paya)\b|\bwatermelon\b', NULL),
  ('Lunch',     'Peri-peri sauce',        'RN-00229', '\bperi[- ]?peri\b|\bpiri[- ]?piri\b', NULL),
  ('Lunch',     'Mineral drinking water', 'RN-00227', '\bmineral\b.*\bwater\b', 10000),
  ('Dinner',    'Salad',                  'RN-00344', '^(?!.*fruit).*\bsalad\b', NULL),
  ('Dinner',    'Fruits',                 'RN-00266', '\bfruits?\b|\bpa(pai|paya)\b|\bwatermelon\b', NULL),
  ('Dinner',    'Peri-peri sauce',        'RN-00229', '\bperi[- ]?peri\b|\bpiri[- ]?piri\b', NULL),
  ('Dinner',    'Mineral drinking water', 'RN-00227', '\bmineral\b.*\bwater\b', 10000),
  ('Breakfast', 'Tea masala',             'RN-00175', '^(black )?tea masala$', NULL)
) AS v(section, label, recipe_number, match_pattern, min_price)
WHERE EXISTS (SELECT 1 FROM public.recipes r WHERE r."recipeNumber" = v.recipe_number)
ON CONFLICT (section, label) DO NOTHING;

-- A wider pool: up to 150 dishes per section, served at least twice.
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
    SELECT x.section, x.dish_key, x.event_id, ev.band, x.recipe_id, x.recipe_name
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
                      ELSE p.n_dish::numeric / t.n END, 4) AS score,
           row_number() OVER (PARTITION BY p.section ORDER BY
             CASE WHEN t.n_band >= 10 THEN 0.8 * p.n_dish_band::numeric / t.n_band + 0.2 * p.n_dish::numeric / t.n
                  ELSE p.n_dish::numeric / t.n END DESC, p.n_dish DESC, p.dish_key) AS rn
    FROM per_dish p JOIN totals t USING (section)
    WHERE p.n_dish >= 2
  )
  SELECT section, dish_key, recipe_id, recipe_name, events, share, band_share, score
  FROM scored
  WHERE rn <= greatest(1, least(coalesce(p_limit, 8), 150))
  ORDER BY array_position(ARRAY['Breakfast', 'Brunch', 'Lunch', 'Evening Tea', 'Dinner', 'Cocktail'], section), rn;
END;
$$;

REVOKE ALL ON FUNCTION public.abby_ai_menu_ideas(text, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abby_ai_menu_ideas(text, numeric, integer) TO authenticated;
