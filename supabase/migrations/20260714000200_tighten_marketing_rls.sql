-- Wires public.is_marketing_user() into every marketing-module table.
--
-- Does NOT rely on hardcoded old policy names — same reasoning as
-- 20260714000100_tighten_finance_rls.sql: this database has already shown
-- drift from git history (is_marketing_user() itself was missing here even
-- though 20260620140000_add_marketing_rls_policies.sql supposedly created
-- it). For every target table that exists, drop ALL of its current
-- policies via pg_policies (by their real names, not guessed ones) before
-- adding the new is_marketing_user()-scoped policies, so no old permissive
-- policy can be left behind to silently OR itself into the result.

DO $$
BEGIN
  IF to_regclass('public.marketing_users') IS NULL THEN
    RAISE NOTICE 'Skipping marketing RLS tightening entirely — public.marketing_users does not exist in this database';
  ELSE
    CREATE OR REPLACE FUNCTION public.is_marketing_user()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    AS $body$
      SELECT EXISTS (
        SELECT 1 FROM marketing_users
        WHERE email = auth.jwt() ->> 'email'
        AND is_active = true
      );
    $body$;
  END IF;
END $$;

-- Drops every existing policy on p_table, then creates one is_marketing_user()
-- policy per action in p_actions (e.g. ARRAY['SELECT','INSERT','UPDATE']).
CREATE OR REPLACE FUNCTION pg_temp.apply_marketing_policy(p_table TEXT, p_actions TEXT[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  pol RECORD;
  action TEXT;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RAISE NOTICE 'Skipping % — table does not exist in this database', p_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, p_table);
  END LOOP;

  FOREACH action IN ARRAY p_actions LOOP
    IF action = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_marketing_user())',
        lower(p_table) || '_insert', p_table
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (public.is_marketing_user())',
        lower(p_table) || '_' || lower(action), p_table, action
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Applied is_marketing_user() policies to % (removed any prior policies)', p_table;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.marketing_users') IS NOT NULL THEN
    PERFORM pg_temp.apply_marketing_policy('regions', ARRAY['SELECT','INSERT','UPDATE']);
    PERFORM pg_temp.apply_marketing_policy('marketing_users', ARRAY['SELECT','INSERT','UPDATE']);
    PERFORM pg_temp.apply_marketing_policy('companies', ARRAY['SELECT','INSERT','UPDATE','DELETE']);
    PERFORM pg_temp.apply_marketing_policy('visits', ARRAY['SELECT','INSERT','UPDATE']);
    PERFORM pg_temp.apply_marketing_policy('follow_ups', ARRAY['SELECT','INSERT','UPDATE']);
    PERFORM pg_temp.apply_marketing_policy('company_notes', ARRAY['SELECT','INSERT','UPDATE']);
    PERFORM pg_temp.apply_marketing_policy('company_documents', ARRAY['SELECT','INSERT']);
    PERFORM pg_temp.apply_marketing_policy('visit_documents', ARRAY['SELECT','INSERT']);
    PERFORM pg_temp.apply_marketing_policy('marketing_performance', ARRAY['SELECT','INSERT','UPDATE']);
  END IF;
END $$;

DROP FUNCTION IF EXISTS pg_temp.apply_marketing_policy(TEXT, TEXT[]);

-- NOTE: tables added by later marketing migrations (company collaborators,
-- marketer codes, notifications, onboarding requests, etc. — see
-- supabase/migrations/20260623*.sql) were not audited as part of this pass
-- and may still carry permissive policies. Review them separately.
