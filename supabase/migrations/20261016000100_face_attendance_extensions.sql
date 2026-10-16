-- Face attendance, Phase 1: extensions.
--
-- vector (pgvector) stores face embeddings; pgcrypto provides crypt() /
-- gen_salt('bf') for hashing attendance PINs and one-time setup codes.
--
-- On Supabase, extensions live in the `extensions` schema, not `public`.
-- Functions that use them must therefore have `extensions` on their
-- search_path (e.g. SET search_path = public, extensions). IF NOT EXISTS
-- leaves an extension where it is if it was already installed elsewhere;
-- the check at the end says where each one actually is.

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  ext record;
BEGIN
  FOR ext IN
    SELECT e.extname, n.nspname
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname IN ('vector', 'pgcrypto')
  LOOP
    IF ext.nspname NOT IN ('extensions', 'public') THEN
      RAISE EXCEPTION 'Extension % is installed in schema %; the face attendance functions expect extensions or public.', ext.extname, ext.nspname;
    END IF;
    RAISE NOTICE 'Extension % is in schema %', ext.extname, ext.nspname;
  END LOOP;
END $$;
