-- Phase 1 audit trail: every insert, update and delete on the HR and Ops
-- tables is written to audit_log with the acting user and time, by a trigger
-- rather than by app code. App-level logging only ever covered the four call
-- sites that remembered to call it, and nothing stopped a direct API call
-- from bypassing it; a trigger sees every write regardless of the caller.
-- Depends on 20260726010000_add_audit_log.sql and 20261014000000.

-- ── 1. Row-change trigger ──────────────────────────────────────────────────
-- SECURITY DEFINER because plain staff have no INSERT right on audit_log (see
-- section 3), so the write must happen with the function owner's privileges.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- Recorded as "changed", never as a value: the audit log is readable by
  -- more people than employees is, and must not become a side door to it.
  masked    constant text[] := ARRAY['nationalId', 'tin', 'bankAccountNumber', 'monthlySalary'];
  -- Bookkeeping columns that change on every write; logging them would make
  -- every update look like it changed something.
  noise     constant text[] := ARRAY['updated_by', 'updatedAt', 'updated_at'];
  old_j     jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  new_j     jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  changed   text[];
  op        text := lower(TG_OP);
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(k ORDER BY k) INTO changed FROM jsonb_object_keys(new_j) k WHERE k <> ALL (noise);
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(k ORDER BY k) INTO changed FROM jsonb_object_keys(old_j) k WHERE k <> ALL (noise);
  ELSE
    SELECT array_agg(k ORDER BY k) INTO changed
    FROM jsonb_object_keys(new_j) k
    WHERE k <> ALL (noise) AND new_j -> k IS DISTINCT FROM old_j -> k;

    -- An UPDATE that only touched bookkeeping columns is not worth a row.
    IF changed IS NULL THEN
      RETURN NULL;
    END IF;

    -- Approvals get their own action so they can be filtered on.
    IF old_j ->> 'approved_at' IS NULL AND new_j ->> 'approved_at' IS NOT NULL THEN
      op := 'approve';
    END IF;
  END IF;

  -- Strip masked values from the snapshots (keys stay in changed_fields).
  old_j := old_j - masked;
  new_j := new_j - masked;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (
    public.safe_auth_uid(),
    TG_TABLE_NAME || '.' || op,
    TG_TABLE_NAME,
    COALESCE(new_j ->> 'id', old_j ->> 'id'),
    jsonb_build_object('old', old_j, 'new', new_j, 'changed_fields', COALESCE(to_jsonb(changed), '[]'::jsonb))
  );
  RETURN NULL;
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
      RAISE NOTICE 'Skipping audit trigger for % — table does not exist in this database', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t
    );
  END LOOP;
END $$;

-- ── 2. Role and activation changes on staff_users ──────────────────────────
CREATE OR REPLACE FUNCTION public.audit_staff_user_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
    VALUES (
      public.safe_auth_uid(), 'staff_users.update', 'staff_users', NEW.id::text,
      jsonb_build_object(
        'old', jsonb_build_object('role', OLD.role, 'is_active', OLD.is_active, 'email', OLD.email),
        'new', jsonb_build_object('role', NEW.role, 'is_active', NEW.is_active, 'email', NEW.email),
        'changed_fields', to_jsonb(ARRAY_REMOVE(ARRAY[
          CASE WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'role' END,
          CASE WHEN NEW.is_active IS DISTINCT FROM OLD.is_active THEN 'is_active' END
        ], NULL))
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_staff_user_change ON public.staff_users;
CREATE TRIGGER audit_staff_user_change
  AFTER UPDATE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.audit_staff_user_change();

-- ── 3. audit_log access ────────────────────────────────────────────────────
-- Reads: admin and general_manager see everything; hr_manager sees HR tables
-- only. Writes: direct INSERT is removed. The old audit_log_staff_insert let
-- any staff member insert rows (with their own actor_id), which is fine for
-- honest callers but means anyone could pad the log with fake entries. The
-- existing app call sites (clients, invoices) now go through log_audit_event(),
-- which stamps actor_id itself.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.audit_log', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY audit_log_select_all ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_staff_role(ARRAY['admin', 'general_manager']));

CREATE POLICY audit_log_select_hr ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_staff_role(ARRAY['hr_manager'])
    AND table_name IN (
      'employees', 'attendance', 'positions', 'training_participants',
      'training_evaluations', 'payroll'
    )
  );

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text, p_table text, p_record_id text DEFAULT NULL, p_metadata jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (public.safe_auth_uid(), p_action, p_table, p_record_id, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

-- The audit page shows who acted, by email. HR and GM roles can already see
-- every HR record, so letting them read staff_users (email/role/active only)
-- is no wider than their existing access.
DROP POLICY IF EXISTS "staff_users_hr_select" ON public.staff_users;
CREATE POLICY "staff_users_hr_select" ON public.staff_users
  FOR SELECT TO authenticated USING (public.can_manage_hr());
