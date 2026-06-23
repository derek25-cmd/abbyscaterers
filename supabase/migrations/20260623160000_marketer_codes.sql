-- Every marketer gets a short, human-shareable ID once a manager approves
-- their application. Other marketers use this ID (not a name search) to add
-- someone as a collaborator on a company they landed together.

CREATE SEQUENCE IF NOT EXISTS marketer_code_seq;

ALTER TABLE public.marketing_users
  ADD COLUMN IF NOT EXISTS marketer_code TEXT UNIQUE;

-- Backfill anyone already approved before this migration existed.
UPDATE public.marketing_users
SET marketer_code = 'MKT-' || lpad(nextval('marketer_code_seq')::text, 4, '0')
WHERE approval_status = 'APPROVED' AND marketer_code IS NULL;

CREATE OR REPLACE FUNCTION approve_marketer(
  p_marketer_id UUID, p_manager_id UUID, p_role TEXT DEFAULT 'MARKETER'
) RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    is_active = true, approval_status = 'APPROVED',
    role = p_role::marketing_user_role,
    approved_by = p_manager_id, approved_at = NOW(),
    marketer_code = COALESCE(marketer_code, 'MKT-' || lpad(nextval('marketer_code_seq')::text, 4, '0'))
  WHERE id = p_marketer_id;
  INSERT INTO marketer_approval_log (marketer_id, action, performed_by)
  VALUES (p_marketer_id, 'APPROVED', p_manager_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
