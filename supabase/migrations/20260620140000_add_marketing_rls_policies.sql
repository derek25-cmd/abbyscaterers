-- Row Level Security policies for all marketing module tables
-- These policies use Supabase Auth — the auth.uid() function returns the
-- currently authenticated user's UUID.
--
-- IMPORTANT: marketing_users.id is NOT the same as auth.uid().
-- marketing_users links to the platform's auth system. For now, we allow
-- all authenticated users to read and write marketing data — tighten these
-- policies in Phase 5 when role-based access is added.
--
-- This supersedes the broad "Enable all actions for authenticated users on X"
-- policies created in the Phase 1 migration with the same per-action policies
-- below, split out per-action for clarity. Drop the old ones first so each
-- table doesn't end up with two overlapping permissive policies.

DROP POLICY IF EXISTS "Enable all actions for authenticated users on regions" ON regions;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on marketing_users" ON marketing_users;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on companies" ON companies;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on visits" ON visits;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on follow_ups" ON follow_ups;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on company_notes" ON company_notes;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on company_documents" ON company_documents;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on visit_documents" ON visit_documents;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on marketing_performance" ON marketing_performance;

-- Helper: check if the current auth user exists in marketing_users.
-- Not yet wired into any policy below (all tables stay permissive for now),
-- but available for Phase 5 role-based policies.
CREATE OR REPLACE FUNCTION public.is_marketing_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketing_users
    WHERE email = auth.jwt() ->> 'email'
    AND is_active = true
  );
$$;

-- regions: all authenticated users can read, only admins can write
-- (For now allow all authenticated to write — restrict in Phase 5)
DROP POLICY IF EXISTS "regions_select" ON regions;
DROP POLICY IF EXISTS "regions_insert" ON regions;
DROP POLICY IF EXISTS "regions_update" ON regions;
CREATE POLICY "regions_select" ON regions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "regions_insert" ON regions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "regions_update" ON regions
  FOR UPDATE TO authenticated USING (true);

-- marketing_users: all authenticated can read, admins can write
DROP POLICY IF EXISTS "marketing_users_select" ON marketing_users;
DROP POLICY IF EXISTS "marketing_users_insert" ON marketing_users;
DROP POLICY IF EXISTS "marketing_users_update" ON marketing_users;
CREATE POLICY "marketing_users_select" ON marketing_users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "marketing_users_insert" ON marketing_users
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "marketing_users_update" ON marketing_users
  FOR UPDATE TO authenticated USING (true);

-- companies: all authenticated users can read and write
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;
CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON companies
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON companies
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "companies_delete" ON companies
  FOR DELETE TO authenticated USING (true);

-- visits: all authenticated users can read, marketers can insert their own
DROP POLICY IF EXISTS "visits_select" ON visits;
DROP POLICY IF EXISTS "visits_insert" ON visits;
DROP POLICY IF EXISTS "visits_update" ON visits;
CREATE POLICY "visits_select" ON visits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "visits_insert" ON visits
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "visits_update" ON visits
  FOR UPDATE TO authenticated USING (true);

-- follow_ups: all authenticated users can read and write
DROP POLICY IF EXISTS "followups_select" ON follow_ups;
DROP POLICY IF EXISTS "followups_insert" ON follow_ups;
DROP POLICY IF EXISTS "followups_update" ON follow_ups;
CREATE POLICY "followups_select" ON follow_ups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "followups_insert" ON follow_ups
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "followups_update" ON follow_ups
  FOR UPDATE TO authenticated USING (true);

-- company_notes: all authenticated can read, authors can update their own
DROP POLICY IF EXISTS "company_notes_select" ON company_notes;
DROP POLICY IF EXISTS "company_notes_insert" ON company_notes;
DROP POLICY IF EXISTS "company_notes_update" ON company_notes;
CREATE POLICY "company_notes_select" ON company_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_notes_insert" ON company_notes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "company_notes_update" ON company_notes
  FOR UPDATE TO authenticated USING (true);

-- company_documents: all authenticated can read and write
DROP POLICY IF EXISTS "company_documents_select" ON company_documents;
DROP POLICY IF EXISTS "company_documents_insert" ON company_documents;
CREATE POLICY "company_documents_select" ON company_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_documents_insert" ON company_documents
  FOR INSERT TO authenticated WITH CHECK (true);

-- visit_documents: all authenticated can read and write
DROP POLICY IF EXISTS "visit_documents_select" ON visit_documents;
DROP POLICY IF EXISTS "visit_documents_insert" ON visit_documents;
CREATE POLICY "visit_documents_select" ON visit_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "visit_documents_insert" ON visit_documents
  FOR INSERT TO authenticated WITH CHECK (true);

-- marketing_performance: all authenticated can read, system can write
DROP POLICY IF EXISTS "marketing_performance_select" ON marketing_performance;
DROP POLICY IF EXISTS "marketing_performance_insert" ON marketing_performance;
DROP POLICY IF EXISTS "marketing_performance_update" ON marketing_performance;
CREATE POLICY "marketing_performance_select" ON marketing_performance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "marketing_performance_insert" ON marketing_performance
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "marketing_performance_update" ON marketing_performance
  FOR UPDATE TO authenticated USING (true);
