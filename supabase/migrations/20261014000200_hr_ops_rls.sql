-- Phase 1 RLS for the HR tables: anyone active may submit, only
-- can_manage_hr() (admin / hr_manager / general_manager) may edit or delete.
-- Depends on 20261014000000 (helpers) and 20261014000100 (created_by).
--
-- Same discipline as 20260714000100_tighten_finance_rls.sql: drop every
-- existing policy by its real name from pg_policies instead of guessing
-- names, because OR'd permissive policies mean one leftover USING (true)
-- policy silently defeats the new ones. The one deliberate exception is
-- `portal_%`: the admin portal (Clerk sessions) owns portal_read_payroll and
-- portal_read_attendance (20260901190000), and dropping them would break its
-- HR reports. A final check fails the migration if either is missing.
--
-- Ops tables (products, stock_logs, assets, issuance) are NOT locked in
-- Phase 1: addIssuance() decrements assets.quantity from the client. They
-- keep staff-wide write access; only assets/issuance, which have no tracked
-- policy at all, are normalised to the same staff_manage_* shape as
-- products/stock_logs already have.

-- ── Helper: drop all non-portal policies on a table ────────────────────────
CREATE OR REPLACE FUNCTION public._hr_ops_reset_policies(p_table text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pol RECORD;
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
      AND policyname NOT LIKE 'portal\_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, p_table);
  END LOOP;
END;
$$;

DO $$
DECLARE
  t text;
  select_expr text;
  write_expr text;
  update_expr text;
BEGIN
  -- ── HR tables ────────────────────────────────────────────────────────────
  FOREACH t IN ARRAY ARRAY[
    'employees', 'attendance', 'positions', 'training_participants',
    'training_evaluations', 'payroll'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Skipping RLS for % — table does not exist in this database', t;
      CONTINUE;
    END IF;

    PERFORM public._hr_ops_reset_policies(t);

    -- employees holds national ID, TIN, bank account and salary, and RLS is
    -- row-level not column-level, so plain staff get no SELECT at all and use
    -- get_employee_directory() instead. Finance keeps SELECT (payslips need
    -- the salary fields).
    IF t = 'employees' THEN
      select_expr := 'public.can_manage_hr() OR public.has_staff_role(ARRAY[''finance''])';
    ELSE
      select_expr := 'public.is_active_staff()';
    END IF;

    -- payroll edits stay with finance as today, in addition to HR.
    IF t = 'payroll' THEN
      write_expr := 'public.can_manage_hr() OR public.has_staff_role(ARRAY[''finance''])';
    ELSE
      write_expr := 'public.can_manage_hr()';
    END IF;

    -- attendance: the grid upserts, and an upsert over an existing row needs
    -- UPDATE. Let the submitter correct their own row on the same day (e.g.
    -- clock-out) but nothing later. "Same day" is Dar es Salaam time; a UTC
    -- current_date would be a day behind from 00:00-03:00 local.
    IF t = 'attendance' THEN
      update_expr := 'public.can_manage_hr() OR (public.is_active_staff() AND created_by = public.safe_auth_uid() '
        || 'AND date::date = (now() AT TIME ZONE ''Africa/Dar_es_Salaam'')::date)';
    ELSE
      update_expr := write_expr;
    END IF;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', t || '_select', t, select_expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_active_staff())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t || '_update', t, update_expr, update_expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', t || '_delete', t, write_expr);

    RAISE NOTICE 'Applied HR RLS policies to %', t;
  END LOOP;

  -- ── Ops tables with no tracked policy ────────────────────────────────────
  FOREACH t IN ARRAY ARRAY['assets', 'issuance']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Skipping RLS for % — table does not exist in this database', t;
      CONTINUE;
    END IF;
    PERFORM public._hr_ops_reset_policies(t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_manage_ops()) WITH CHECK (public.can_manage_ops())',
      'staff_manage_' || t, t
    );
    RAISE NOTICE 'Applied staff-wide RLS policy to %', t;
  END LOOP;
END $$;

DROP FUNCTION public._hr_ops_reset_policies(text);

-- ── Employee directory for non-HR staff ────────────────────────────────────
-- Dropdowns (attendance, issuance, training, order issuance) only need to put
-- a name to an id. SECURITY DEFINER so it works without SELECT on employees,
-- and it returns no personal or salary columns. Separate from
-- get_employee_directory_for_portal(), which checks Clerk portal roles.
CREATE OR REPLACE FUNCTION public.get_employee_directory()
RETURNS TABLE (id TEXT, "firstName" TEXT, "lastName" TEXT, department TEXT, role TEXT, status TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT e.id, e."firstName", e."lastName", e.department, e.role, e.status
    FROM public.employees e;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_directory() TO authenticated;

-- ── Applicant count maintained server-side ─────────────────────────────────
-- trainingService used to recount and UPDATE positions.applicants from the
-- browser after every participant change. A `staff` user can insert a
-- participant but no longer update `positions`, so that follow-up write would
-- be refused silently. A SECURITY DEFINER trigger keeps the count right
-- regardless of who made the change.
CREATE OR REPLACE FUNCTION public.sync_training_applicants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tid text;
BEGIN
  FOREACH tid IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.training_id::text END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.training_id::text END
  ]
  LOOP
    IF tid IS NOT NULL THEN
      UPDATE public.positions
      SET applicants = (SELECT count(*) FROM public.training_participants WHERE training_id::text = tid)
      WHERE id::text = tid;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.training_participants') IS NULL OR to_regclass('public.positions') IS NULL THEN
    RAISE NOTICE 'Skipping applicants trigger — training_participants or positions does not exist';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS sync_training_applicants ON public.training_participants;
  CREATE TRIGGER sync_training_applicants
    AFTER INSERT OR UPDATE OF training_id OR DELETE ON public.training_participants
    FOR EACH ROW EXECUTE FUNCTION public.sync_training_applicants();
END $$;

-- ── Guard: the portal's HR report policies must have survived ──────────────
DO $$
BEGIN
  IF to_regclass('public.payroll') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payroll' AND policyname = 'portal_read_payroll'
  ) THEN
    RAISE EXCEPTION 'portal_read_payroll is missing — admin portal payroll report would break';
  END IF;
  IF to_regclass('public.attendance') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = 'portal_read_attendance'
  ) THEN
    RAISE EXCEPTION 'portal_read_attendance is missing — admin portal attendance report would break';
  END IF;
END $$;
