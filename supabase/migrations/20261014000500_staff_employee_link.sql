-- Phase 2: link a login (staff_users) to the employee record it belongs to.
--
-- Leave needs this twice over: "apply for myself" has to know which employee
-- the signed-in user is, and review_leave_request() must refuse self-approval,
-- which is impossible without knowing whose request belongs to whom. Until
-- now staff_users (a Supabase Auth login) and employees (an HR record) were
-- unrelated, and many staff will never have both.
--
-- Nullable on purpose: not every login is an employee (e.g. an outside
-- accountant) and links are filled in by the admin afterwards. ON DELETE SET
-- NULL so removing an employee never deletes a login.

DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE NOTICE 'Skipping staff_users.employee_id — public.employees does not exist in this database';
    RETURN;
  END IF;

  ALTER TABLE public.staff_users
    ADD COLUMN IF NOT EXISTS employee_id text REFERENCES public.employees(id) ON DELETE SET NULL;

  -- One login per employee, otherwise "my requests" and the self-approval
  -- check become ambiguous. Partial: many logins may stay unlinked.
  CREATE UNIQUE INDEX IF NOT EXISTS staff_users_employee_id_key
    ON public.staff_users (employee_id) WHERE employee_id IS NOT NULL;
END $$;

-- Employee id of the signed-in user, or NULL. SECURITY DEFINER for the same
-- reason as the other role helpers: callers can read only their own
-- staff_users row, and RPCs/policies need this without depending on that.
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT employee_id FROM public.staff_users
  WHERE id = public.safe_auth_uid() AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;

-- Linking a login to an employee decides who may approve what, so it belongs
-- in the audit trail next to role and active changes (Phase 1 trigger only
-- logged those two).
CREATE OR REPLACE FUNCTION public.audit_staff_user_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := ARRAY_REMOVE(ARRAY[
    CASE WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'role' END,
    CASE WHEN NEW.is_active IS DISTINCT FROM OLD.is_active THEN 'is_active' END,
    CASE WHEN to_jsonb(NEW) ->> 'employee_id' IS DISTINCT FROM to_jsonb(OLD) ->> 'employee_id' THEN 'employee_id' END
  ], NULL);
BEGIN
  IF array_length(changed, 1) IS NOT NULL THEN
    INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
    VALUES (
      public.safe_auth_uid(), 'staff_users.update', 'staff_users', NEW.id::text,
      jsonb_build_object(
        'old', jsonb_build_object('role', OLD.role, 'is_active', OLD.is_active, 'email', OLD.email,
                                  'employee_id', to_jsonb(OLD) ->> 'employee_id'),
        'new', jsonb_build_object('role', NEW.role, 'is_active', NEW.is_active, 'email', NEW.email,
                                  'employee_id', to_jsonb(NEW) ->> 'employee_id'),
        'changed_fields', to_jsonb(changed)
      )
    );
  END IF;
  RETURN NULL;
END;
$$;
