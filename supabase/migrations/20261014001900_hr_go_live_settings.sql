-- Phase 5: the HR module switch and the go-live marker, on the app_settings row.
--
--   hr_modules     which HR modules the app shows: audit, leave, documents,
--                  letters, candidates. A rollback tool: hiding a module hides
--                  its screens and makes its cron do nothing. Database rules
--                  stay in force whatever it says. NULL means "all on".
--   hr_go_live_at  set once, at go-live. After that the SQL test files in
--                  supabase/tests refuse to run, and opening leave balances
--                  can only be entered for the go-live year.
--
-- Both are Admin-only (can_manage_settings): app_settings_write lets any active
-- staff member update the row, so a trigger guards these two columns, like
-- guard_company_settings does for the company details.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS hr_modules text[],
  ADD COLUMN IF NOT EXISTS hr_go_live_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_hr_modules_known') THEN
    ALTER TABLE public.app_settings
      ADD CONSTRAINT app_settings_hr_modules_known
      CHECK (hr_modules IS NULL OR hr_modules <@ ARRAY['audit', 'leave', 'documents', 'letters', 'candidates']::text[]);
  END IF;
END $$;

-- Start with everything on, so UAT can test every module.
UPDATE public.app_settings
   SET hr_modules = ARRAY['audit', 'leave', 'documents', 'letters', 'candidates']
 WHERE id = true AND hr_modules IS NULL;

CREATE OR REPLACE FUNCTION public.guard_hr_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.hr_modules IS DISTINCT FROM OLD.hr_modules OR NEW.hr_go_live_at IS DISTINCT FROM OLD.hr_go_live_at)
     -- No signed-in user: the SQL editor, migrations or the service role.
     AND public.safe_auth_uid() IS NOT NULL
     AND NOT public.can_manage_settings()
  THEN
    RAISE EXCEPTION 'Only an Admin can change which HR modules are switched on, or the go-live date.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_hr_settings ON public.app_settings;
CREATE TRIGGER guard_hr_settings
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_hr_settings();

-- The Settings page calls this. It records the change in the Audit Trail
-- (app_settings itself is not row-audited).
CREATE OR REPLACE FUNCTION public.set_hr_modules(p_modules text[])
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  before text[];
  after text[];
BEGIN
  IF NOT public.can_manage_settings() THEN
    RAISE EXCEPTION 'Only an Admin can change which HR modules are switched on.' USING ERRCODE = '42501';
  END IF;
  IF p_modules IS NULL OR NOT (p_modules <@ ARRAY['audit', 'leave', 'documents', 'letters', 'candidates']::text[]) THEN
    RAISE EXCEPTION 'Unknown HR module. Use audit, leave, documents, letters and candidates.';
  END IF;
  SELECT hr_modules INTO before FROM public.app_settings WHERE id = true FOR UPDATE;
  after := ARRAY(SELECT DISTINCT m FROM unnest(p_modules) m ORDER BY m);
  UPDATE public.app_settings SET hr_modules = after WHERE id = true;
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), 'app_settings.hr_modules', 'app_settings', 'hr_modules',
          jsonb_build_object('old', to_jsonb(before), 'new', to_jsonb(after)));
  RETURN after;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_hr_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_hr_modules(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_hr_modules(text[]) TO authenticated;
