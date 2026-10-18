-- Data readiness Phase 2: recipes and catering menus are shared by all staff.
--
-- Until now recipes, catering_menus and their child tables were owner-only
-- (auth.uid() = user_id): 399 of the 404 recipes and all 11 catering menus
-- belong to one admin account, so nobody else could see or edit them, and 5
-- recipes with no owner were invisible to everyone. That blocks the kitchen
-- from entering recipe ingredients, and it also means other staff saw no
-- recipes in the daily-menu planner or delivery notes.
--
-- From here (decision 2026-10-18, "option b"):
--   * any active staff member (is_active_staff()) can read, add and edit
--     recipes, catering menus, the recipes on a menu and planned ingredients;
--   * deleting needs can_manage_ops() (today the same as any active staff;
--     tighten it there, in one place, if deleting should be limited);
--   * user_id stays as "created by". The 5 ownerless recipes get the account
--     that owns the other recipes recorded as their creator.
--
-- Same discipline as 20261014000200_hr_ops_rls.sql: every existing policy is
-- dropped by its real name from pg_policies (one leftover permissive policy
-- would OR the new ones away), except portal_% ones (none exist today).
--
-- Rollback (restores owner-only access exactly as before):
--   see docs/data-readiness/PROD-RUNBOOK-phase-2.md, step 2.

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipes', 'catering_menus', 'catering_menu_recipes', 'menu_planned_ingredients']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Skipping % (table does not exist here)', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname NOT LIKE 'portal\_%'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_staff())',
                   t || '_staff_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_active_staff())',
                   t || '_staff_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())',
                   t || '_staff_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_manage_ops())',
                   t || '_staff_delete', t);
  END LOOP;
END $$;

-- Ownerless recipes: record the account that owns the other recipes as their
-- creator. Only touches rows with no owner, so re-running changes nothing.
UPDATE public.recipes r
   SET user_id = o.user_id
  FROM (
    SELECT user_id
    FROM public.recipes
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    ORDER BY count(*) DESC
    LIMIT 1
  ) o
 WHERE r.user_id IS NULL;
