-- Who/when columns for the HR and Ops tables (HR Manager review 2.9: "every
-- entry, edit, delete and approval is recorded with the user and the time").
-- created_at/updatedAt already exist on most of these tables; what was missing
-- is *who*. Row-level columns answer "who last touched this" at a glance; the
-- audit_log trigger (20261014000300) keeps the full history.
--
-- Several of these tables were created outside tracked migrations, so each is
-- guarded with to_regclass rather than assuming it exists.

CREATE OR REPLACE FUNCTION public.set_updated_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Always overwrite: a client must not be able to forge who edited a row.
  NEW.updated_by := public.safe_auth_uid();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employees', 'attendance', 'positions', 'training_participants',
    'training_evaluations', 'payroll',
    'products', 'stock_logs', 'assets', 'issuance'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Skipping audit columns for % — table does not exist in this database', t;
      CONTINUE;
    END IF;

    -- safe_auth_uid() rather than auth.uid(): inserts from a Clerk/portal
    -- session would otherwise fail the uuid cast.
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT public.safe_auth_uid()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_at timestamptz', t);

    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_by ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_by BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_by()', t
    );
  END LOOP;
END $$;
