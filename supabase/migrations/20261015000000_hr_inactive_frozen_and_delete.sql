-- Inactive employees are frozen; employees can be deleted when they have no history.
--
-- 1. Someone whose employment has ended (status Inactive) cannot be changed or
--    acted on until they are reactivated (re-hired): no edits to their record,
--    no leave, attendance, leave balances, letters, contracts, training or new
--    payslips. Reactivating (status back to Active) and deleting stay possible.
--    The system's own end-of-employment steps (contract, leave and attendance
--    clean-up inside hr_end_employment) and voiding letters still work: they
--    run with their transaction-local flags.
-- 2. delete_employee(id): HR roles can delete an employee who has no history
--    (no attendance, payslips, leave, letters, contracts, warnings, rewards or
--    training). Otherwise it refuses and says what is attached; such people are
--    ended (Inactive) instead, so no employment record is ever lost. Deleting
--    any other way (a direct DELETE) is refused, because attendance would be
--    removed with the employee without anyone noticing.

-- ── 1. The freeze ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.hr_employee_is_inactive(p_employee text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee AND status = 'Inactive');
$$;

-- System paths that must keep working on someone who has just left.
CREATE OR REPLACE FUNCTION public.hr_system_change()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.safe_auth_uid() IS NULL                                   -- SQL editor, migrations, service role
      OR coalesce(current_setting('leave.rpc', true), '') = '1'           -- leave functions, end of employment
      OR coalesce(current_setting('hr_docs.rpc', true), '') = '1'         -- letter lifecycle (e.g. voiding)
      OR coalesce(current_setting('app.hr_ending_employment', true), '') = 'on'
      OR coalesce(current_setting('app.uat_cleanup', true), '') = 'on';
$$;

-- The employee record itself. Same rules as 20261014001700 plus the freeze; the
-- trigger now fires on every update, not only on status changes.
CREATE OR REPLACE FUNCTION public.employees_status_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ending boolean := coalesce(current_setting('app.hr_ending_employment', true), '') = 'on';
  noise constant text[] := ARRAY['updated_by', 'updatedAt', 'updated_at'];
BEGIN
  -- No signed-in user: maintenance or migrations, not an end user.
  IF public.safe_auth_uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Inactive' AND NOT ending THEN
      RAISE EXCEPTION 'A new employee is always added as Active.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'Active' AND NEW.status = 'Inactive' AND NOT ending THEN
    RAISE EXCEPTION 'Employment is ended with a termination letter, or with "End employment without a letter". It cannot be switched off here.';
  END IF;
  IF OLD.status = 'Inactive' AND NEW.status = 'Active' THEN
    -- Reactivation (re-hire): the only change allowed on someone who has left.
    NEW."employmentEndDate" := NULL;
    NEW."employmentEndReason" := NULL;
    RETURN NEW;
  END IF;
  IF OLD.status = 'Inactive' AND NEW.status = 'Inactive' AND NOT ending
     AND (to_jsonb(NEW) - noise) IS DISTINCT FROM (to_jsonb(OLD) - noise) THEN
    RAISE EXCEPTION '% has left and their record is closed. Reactivate them (re-hire) to make changes.',
      trim(concat_ws(' ', OLD."firstName", OLD."lastName"));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_status_guard ON public.employees;
CREATE TRIGGER employees_status_guard
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_status_guard();

-- Everything that hangs off an employee: refused for someone who has left.
-- TG_ARGV[0] is the column holding the employee id.
CREATE OR REPLACE FUNCTION public.hr_refuse_if_employee_inactive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp_id text := to_jsonb(NEW) ->> TG_ARGV[0];
BEGIN
  IF emp_id IS NULL OR public.hr_system_change() OR NOT public.hr_employee_is_inactive(emp_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% has left and their record is closed. Reactivate them (re-hire) first.',
    coalesce(public.hr_employee_name(emp_id), emp_id)
    USING ERRCODE = 'P0001', HINT = 'EMPLOYEE_INACTIVE';
END;
$$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    -- table, employee column, events
    ('leave_requests',       'employee_id', 'INSERT'),
    ('leave_balances',       'employee_id', 'INSERT OR UPDATE'),
    ('attendance',           'employee_id', 'INSERT OR UPDATE'),
    ('hr_documents',         'employee_id', 'INSERT OR UPDATE'),
    ('employment_contracts', 'employee_id', 'INSERT'),
    ('training_participants','employee_id', 'INSERT OR UPDATE'),
    ('payroll',              'employeeId',  'INSERT')
  ) AS v(tbl, col, ev)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NULL THEN
      RAISE NOTICE 'Skipping the inactive-employee guard on % (table does not exist here)', t.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS hr_refuse_if_employee_inactive ON public.%I', t.tbl);
    EXECUTE format(
      'CREATE TRIGGER hr_refuse_if_employee_inactive BEFORE %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hr_refuse_if_employee_inactive(%L)',
      t.ev, t.tbl, t.col);
  END LOOP;
END $$;

-- ── 2. Deleting an employee ────────────────────────────────────────────────

-- What is attached to an employee, in words. Every table that points at
-- employees (found from the foreign keys, so new tables are included), plus
-- training_participants, which has no foreign key. Logins and candidate links
-- are not history: they are simply unlinked.
CREATE OR REPLACE FUNCTION public.employee_history(p_employee text)
RETURNS TABLE (what text, records bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fk record;
  n bigint;
BEGIN
  IF NOT public.can_manage_hr() AND public.safe_auth_uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can see what is recorded for an employee.' USING ERRCODE = '42501';
  END IF;
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND array_length(c.conkey, 1) = 1
       AND c.conrelid::regclass::text NOT IN ('staff_users', 'candidates')
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', fk.tbl, fk.col) INTO n USING p_employee;
    IF n > 0 THEN
      what := CASE fk.tbl::text
        WHEN 'attendance' THEN 'attendance day(s)'
        WHEN 'payroll' THEN 'payslip(s)'
        WHEN 'leave_requests' THEN 'leave request(s)'
        WHEN 'leave_balances' THEN 'leave balance(s)'
        WHEN 'hr_documents' THEN 'HR letter(s)'
        WHEN 'employment_contracts' THEN 'contract(s)'
        WHEN 'disciplinary_records' THEN 'warning(s)'
        WHEN 'recognition_records' THEN 'recognition record(s)'
        ELSE fk.tbl::text || ' row(s)' END;
      records := n;
      RETURN NEXT;
    END IF;
  END LOOP;
  IF to_regclass('public.training_participants') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.training_participants WHERE employee_id = $1' INTO n USING p_employee;
    IF n > 0 THEN what := 'training record(s)'; records := n; RETURN NEXT; END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_employee(p_employee text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp public.employees%ROWTYPE;
  attached text;
BEGIN
  IF NOT public.can_manage_hr() THEN
    RAISE EXCEPTION 'Only an Admin, HR Manager or General Manager can delete employees.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO emp FROM public.employees WHERE id = p_employee FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found.'; END IF;

  SELECT string_agg(h.records || ' ' || h.what, ', ' ORDER BY h.what) INTO attached FROM public.employee_history(p_employee) h;
  IF attached IS NOT NULL THEN
    RAISE EXCEPTION '% cannot be deleted: they have %. Employment records must be kept; end their employment instead (they become Inactive).',
      trim(concat_ws(' ', emp."firstName", emp."lastName")), attached
      USING HINT = 'HAS_HISTORY';
  END IF;

  PERFORM set_config('app.hr_deleting_employee', 'on', true);
  DELETE FROM public.employees WHERE id = p_employee;   -- audited by audit_row_change
  PERFORM set_config('app.hr_deleting_employee', '', true);
END;
$$;

-- Direct deletes are refused: they would silently take attendance with them.
CREATE OR REPLACE FUNCTION public.employees_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.safe_auth_uid() IS NULL
     OR coalesce(current_setting('app.hr_deleting_employee', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Employees are deleted with "Delete employee", which first checks that they have no records.';
END;
$$;

DROP TRIGGER IF EXISTS employees_delete_guard ON public.employees;
CREATE TRIGGER employees_delete_guard
  BEFORE DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_delete_guard();

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.hr_refuse_if_employee_inactive() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.employees_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_system_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_employee_is_inactive(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_employee_is_inactive(text) TO authenticated;
REVOKE ALL ON FUNCTION public.employee_history(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_history(text) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_employee(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_employee(text) TO authenticated;
