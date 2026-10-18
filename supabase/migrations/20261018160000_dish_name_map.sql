-- Data readiness Phase 3, Step 8: map dish names typed on daily menus (no
-- recipe picked) to the recipe they are.
--
-- raw_name is the dish name lower-cased and trimmed. The kitchen fills
-- docs/data-readiness/mappings/dish_name_mapping.csv
-- (scripts/db/export-dish-names.sql), and scripts/db/apply-dish-mapping.sh
-- loads it here and writes the recipeId into daily_menus.recipes[].
--
-- Staff may read the map; only admins (can_manage_settings(), the
-- 'settings.manage' permission in src/lib/permissions.ts) may add, change or
-- delete entries.
--
-- Rollback: DROP TABLE IF EXISTS public.dish_name_map;
--   (the recipeIds already written into daily_menus stay; they are correct.)

CREATE TABLE IF NOT EXISTS public.dish_name_map (
  raw_name      text PRIMARY KEY CHECK (raw_name = lower(trim(raw_name)) AND raw_name <> ''),
  recipe_number text NOT NULL REFERENCES public.recipes("recipeNumber") ON UPDATE CASCADE,
  mapped_by     uuid REFERENCES auth.users(id) DEFAULT public.safe_auth_uid(),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.dish_name_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dish_name_map_staff_select ON public.dish_name_map;
DROP POLICY IF EXISTS dish_name_map_admin_insert ON public.dish_name_map;
DROP POLICY IF EXISTS dish_name_map_admin_update ON public.dish_name_map;
DROP POLICY IF EXISTS dish_name_map_admin_delete ON public.dish_name_map;

CREATE POLICY dish_name_map_staff_select ON public.dish_name_map
  FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY dish_name_map_admin_insert ON public.dish_name_map
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_settings());
CREATE POLICY dish_name_map_admin_update ON public.dish_name_map
  FOR UPDATE TO authenticated USING (public.can_manage_settings()) WITH CHECK (public.can_manage_settings());
CREATE POLICY dish_name_map_admin_delete ON public.dish_name_map
  FOR DELETE TO authenticated USING (public.can_manage_settings());
