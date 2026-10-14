-- Phase 3 audit changes.
--
-- 1. audit_row_change() gets a table-aware mask list. Letter contents (hr_documents.data)
--    can hold a salary, or the details of a warning, and must not be copied into
--    audit_log, which more people can read than the letters themselves. As for
--    monthlySalary: the audit records THAT the field changed, not its content.
--    Every Phase 1 mask is kept exactly as it was; later tables are added in the
--    one map below.
--    Deliberately NOT masked: hr_document_templates.body (wording changes should
--    stay visible), and hr_documents subject, status, ref_no and void_reason.
-- 2. Tables without an `id` column (hr_document_types, hr_document_counters) get
--    a usable record_id from their key.
-- 3. The HR Manager's audit view includes the new tables.
--
-- Replaces the function and one policy by name; nothing else changes. The body is
-- the Phase 1 body (20261014000300) with those three differences.

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- table -> columns recorded as "changed", never as a value. '*' applies to
  -- every audited table (the Phase 1 list); add a table's own entry to extend.
  mask_map  constant jsonb := '{
    "*": ["nationalId", "tin", "bankAccountNumber", "monthlySalary"],
    "hr_documents": ["data"]
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

  -- The record's id; for tables keyed differently, its key ("type" or "type/year").
  rec_id := COALESCE(
    new_j ->> 'id', old_j ->> 'id',
    NULLIF(concat_ws('/', COALESCE(new_j ->> 'doc_type', old_j ->> 'doc_type'), COALESCE(new_j ->> 'year', old_j ->> 'year')), '')
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

-- HR Manager's audit view: Phase 1 tables, the leave tables (20261020000500) and
-- the new HR document tables.
DROP POLICY IF EXISTS audit_log_select_hr ON public.audit_log;

CREATE POLICY audit_log_select_hr ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_staff_role(ARRAY['hr_manager'])
    AND table_name IN (
      'employees', 'attendance', 'positions', 'training_participants',
      'training_evaluations', 'payroll',
      'leave_requests', 'leave_balances', 'leave_types', 'leave_settings', 'public_holidays',
      'hr_document_types', 'hr_document_templates', 'hr_documents', 'hr_document_counters'
    )
  );
