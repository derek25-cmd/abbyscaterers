-- ============================================================
-- Fixes function_search_path_mutable (WARN) linter findings.
--
-- None of the flagged functions pin search_path, so an unqualified
-- reference inside them (e.g. a bare table/function name) resolves
-- against whatever schema comes first on the caller's search_path —
-- not necessarily `public`. For SECURITY DEFINER functions especially
-- (caution_marketer, disable_marketer, delete_marketer, is_marketing_user,
-- is_marketing_manager, etc.) that's a real privilege-escalation vector:
-- a caller who can create objects in a schema ahead of `public` on their
-- search_path could shadow a name the function relies on and have it
-- execute with the function owner's privileges instead.
--
-- Several flagged functions (reset_user_password, is_admin,
-- is_active_staff, validate_nida, validate_tin, reject_marketer) don't
-- appear in any tracked migration — like training_participants and
-- service_feedback earlier, they were created directly against the
-- remote database and never made it into git. That means their bodies
-- can't be reviewed here; this migration fixes the search_path gap for
-- all of them regardless (by name, not by redefining them), but the
-- source drift itself is worth pulling into version control separately.
--
-- Applied generically via pg_proc introspection rather than one
-- ALTER FUNCTION per signature, since several signatures aren't visible
-- from the tracked migration history.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END $$;
