-- Face attendance, Phase 1: audit trail, inactive clean-up, employee history.
--
-- 1. Every new table gets the audit_row_change trigger. Embeddings, the PIN
--    hash and setup-code hashes are masked: audit_log records THAT they
--    changed, never the value. HR managers see the new tables in the audit
--    trail like the other HR tables.
-- 2. When an employee becomes Inactive, their face templates and unused setup
--    codes are deleted and face_status goes back to 'none'. Consents and
--    punches stay: they are the record of what happened.
-- 3. employee_history() (20261015000000) finds history from foreign keys, so
--    punches and consents now count as history (delete_employee refuses).
--    Face templates and setup codes do not: they are not records of work,
--    and they cascade with the employee.

-- ── 1. Audit ───────────────────────────────────────────────────────────────
-- Same body as 20261016000000; the mask map gains employees,
-- face_templates and attendance_setup_codes entries.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- table -> columns recorded as "changed", never as a value. '*' applies to
  -- every audited table (the Phase 1 list); add a table's own entry to extend.
  mask_map  constant jsonb := '{
    "*": ["nationalId", "tin", "bankAccountNumber", "monthlySalary"],
    "employees": ["attendance_pin_hash"],
    "face_templates": ["embedding"],
    "attendance_setup_codes": ["code_hash"],
    "hr_documents": ["data", "preview", "issued_content"],
    "candidates": ["proposed_salary"],
    "employment_contracts": ["salary"],
    "recognition_records": ["amount"]
  }'::jsonb;
  masked    text[] := ARRAY(SELECT jsonb_array_elements_text(mask_map -> '*'))
                      || COALESCE(ARRAY(SELECT jsonb_array_elements_text(mask_map -> TG_TABLE_NAME)), ARRAY[]::text[]);
  -- Bookkeeping columns that change on every write; logging them would make
  -- every update look like it changed something.
  noise     constant text[] := ARRAY['updated_by', 'updatedAt', 'updated_at'];
  old_j     jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  new_j     jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  changed   text[];
  op        text := lower(TG_OP);
  rec_id    text;
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

  -- The record's id; for tables keyed differently, its key ("type", "type/year"
  -- or, for reminder notices, "contract/threshold").
  rec_id := COALESCE(
    new_j ->> 'id', old_j ->> 'id',
    NULLIF(concat_ws('/', COALESCE(new_j ->> 'doc_type', old_j ->> 'doc_type'), COALESCE(new_j ->> 'year', old_j ->> 'year')), ''),
    NULLIF(concat_ws('/', COALESCE(new_j ->> 'contract_id', old_j ->> 'contract_id'), COALESCE(new_j ->> 'threshold_days', old_j ->> 'threshold_days')), '')
  );

  -- Strip masked values from the snapshots (keys stay in changed_fields).
  old_j := old_j - masked;
  new_j := new_j - masked;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, metadata)
  VALUES (
    public.safe_auth_uid(),
    TG_TABLE_NAME || '.' || op,
    TG_TABLE_NAME,
    rec_id,
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
    'attendance_devices', 'biometric_consents', 'face_templates',
    'attendance_setup_codes', 'attendance_events', 'face_attendance_settings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t
    );
  END LOOP;
END $$;

-- Same list as 20261014001600 plus the face attendance tables.
DROP POLICY IF EXISTS audit_log_select_hr ON public.audit_log;
CREATE POLICY audit_log_select_hr ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_staff_role(ARRAY['hr_manager'])
    AND table_name IN (
      'employees', 'attendance', 'positions', 'training_participants',
      'training_evaluations', 'payroll',
      'leave_requests', 'leave_balances', 'leave_types', 'leave_settings', 'public_holidays',
      'hr_document_types', 'hr_document_templates', 'hr_documents', 'hr_document_counters',
      'candidates', 'employment_contracts', 'disciplinary_records', 'recognition_records', 'contract_expiry_notices',
      'attendance_devices', 'biometric_consents', 'face_templates',
      'attendance_setup_codes', 'attendance_events', 'face_attendance_settings'
    )
  );

-- ── 2. Inactive clean-up ───────────────────────────────────────────────────
-- BEFORE so face_status is reset in the same row write. Named to sort before
-- employees_status_guard; if that guard refuses the change, the deletes roll
-- back with it.
CREATE OR REPLACE FUNCTION public.employees_inactive_face_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Inactive' AND OLD.status IS DISTINCT FROM 'Inactive' THEN
    DELETE FROM public.face_templates WHERE employee_id = NEW.id;
    DELETE FROM public.attendance_setup_codes WHERE employee_id = NEW.id AND used_at IS NULL;
    NEW.face_status := 'none';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_inactive_face_cleanup ON public.employees;
CREATE TRIGGER employees_inactive_face_cleanup
  BEFORE UPDATE OF status ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_inactive_face_cleanup();

-- ── 3. Employee history ────────────────────────────────────────────────────
-- Same body as 20261015000000 with face_templates and attendance_setup_codes
-- excluded, and names for the two new history tables.
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
       AND c.conrelid::regclass::text NOT IN ('staff_users', 'candidates', 'face_templates', 'attendance_setup_codes')
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
        WHEN 'attendance_events' THEN 'clock-in/out record(s)'
        WHEN 'biometric_consents' THEN 'biometric consent record(s)'
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

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.employees_inactive_face_cleanup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.employee_history(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_history(text) TO authenticated;
