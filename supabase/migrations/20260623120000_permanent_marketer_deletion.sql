-- ============================================================
-- Permanent Marketer Deletion ("Purge")
-- Abby's Legendary Caterers — Marketing & CRM Module
--
-- The existing delete_marketer() function only anonymises a marketer's
-- PII and blocks access — it deliberately preserves visit/performance
-- history. This migration adds a second, stronger action that a
-- manager/admin can take AFTER an account has already been soft-deleted:
-- a true hard delete that removes the marketing_users row and every
-- piece of data tied to it, so nothing about the marketer remains.
--
-- Scope is intentionally limited to role = 'MARKETER'. MANAGER/ADMIN
-- accounts can themselves be `performed_by`/`reverted_by` on other
-- marketers' marketer_account_actions rows (NOT NULL FK, no cascade),
-- so hard-deleting one could silently destroy unrelated audit trails.
-- ============================================================

-- Audit trail for purges. Not FK'd to marketing_users(id) for the
-- purged marketer, since that row will no longer exist after this runs.
CREATE TABLE IF NOT EXISTS public.marketer_deletion_log (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id              UUID NOT NULL,
  marketer_email_at_delete TEXT,
  marketer_role            marketing_user_role,
  performed_by             UUID NOT NULL REFERENCES public.marketing_users(id),
  reason                   TEXT NOT NULL,
  visits_deleted           INTEGER DEFAULT 0,
  follow_ups_deleted       INTEGER DEFAULT 0,
  companies_unassigned     INTEGER DEFAULT 0,
  performance_deleted      INTEGER DEFAULT 0,
  notifications_deleted    INTEGER DEFAULT 0,
  account_actions_deleted  INTEGER DEFAULT 0,
  approval_log_deleted     INTEGER DEFAULT 0,
  documents_deleted        INTEGER DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketer_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deletion_log_select" ON public.marketer_deletion_log;
DROP POLICY IF EXISTS "deletion_log_insert" ON public.marketer_deletion_log;

CREATE POLICY "deletion_log_select" ON public.marketer_deletion_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deletion_log_insert" ON public.marketer_deletion_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Hard-delete: removes the marketer row and every record tied to it.
-- Returns the bits the API route needs to finish cleanup outside the
-- database (Supabase Auth user + storage objects).
CREATE OR REPLACE FUNCTION permanently_delete_marketer(
  p_marketer_id UUID,
  p_manager_id  UUID,
  p_reason      TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_email             TEXT;
  v_role              marketing_user_role;
  v_status            TEXT;
  v_auth_user_id       UUID;
  v_profile_photo_path TEXT;
  v_document_paths     TEXT[];
  v_visits_deleted     INTEGER;
  v_followups_deleted  INTEGER;
  v_companies_unassigned INTEGER;
  v_performance_deleted  INTEGER;
  v_notifications_deleted INTEGER;
  v_actions_deleted    INTEGER;
  v_approval_log_deleted INTEGER;
  v_documents_deleted  INTEGER;
BEGIN
  SELECT email, role, approval_status, auth_user_id, profile_photo_path
  INTO v_email, v_role, v_status, v_auth_user_id, v_profile_photo_path
  FROM marketing_users WHERE id = p_marketer_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Marketer not found';
  END IF;

  IF v_role <> 'MARKETER' THEN
    RAISE EXCEPTION 'Only MARKETER accounts can be permanently deleted through this action';
  END IF;

  IF v_status <> 'DELETED' THEN
    RAISE EXCEPTION 'Account must be deleted (soft-deleted) before it can be permanently purged';
  END IF;

  IF EXISTS (
    SELECT 1 FROM marketer_account_actions
    WHERE performed_by = p_marketer_id OR reverted_by = p_marketer_id
  ) THEN
    RAISE EXCEPTION 'Cannot purge: this account performed management actions on other accounts and removing it would destroy that audit trail';
  END IF;

  SELECT COALESCE(array_agg(storage_path), '{}')
  INTO v_document_paths
  FROM marketer_documents WHERE marketer_id = p_marketer_id;

  -- Detach (not delete) follow-ups created from this marketer's visits
  -- but assigned to someone else, before the visits are removed.
  UPDATE follow_ups SET visit_id = NULL
  WHERE visit_id IN (SELECT id FROM visits WHERE marketer_id = p_marketer_id)
    AND assigned_to <> p_marketer_id;

  WITH d AS (DELETE FROM follow_ups WHERE assigned_to = p_marketer_id RETURNING 1)
  SELECT COUNT(*) INTO v_followups_deleted FROM d;

  WITH d AS (DELETE FROM visit_documents
    WHERE visit_id IN (SELECT id FROM visits WHERE marketer_id = p_marketer_id)
    RETURNING 1)
  SELECT COUNT(*) INTO v_documents_deleted FROM d;

  WITH d AS (DELETE FROM visits WHERE marketer_id = p_marketer_id RETURNING 1)
  SELECT COUNT(*) INTO v_visits_deleted FROM d;

  WITH d AS (DELETE FROM marketing_performance WHERE marketer_id = p_marketer_id RETURNING 1)
  SELECT COUNT(*) INTO v_performance_deleted FROM d;

  WITH d AS (DELETE FROM marketing_notifications WHERE marketer_id = p_marketer_id RETURNING 1)
  SELECT COUNT(*) INTO v_notifications_deleted FROM d;

  WITH u AS (UPDATE companies SET assigned_marketer_id = NULL
    WHERE assigned_marketer_id = p_marketer_id RETURNING 1)
  SELECT COUNT(*) INTO v_companies_unassigned FROM u;

  -- Detach this marketer from any self-referencing FKs on other rows
  -- so the row delete below never hits an unrelated constraint.
  UPDATE marketing_users SET supervisor_id = NULL WHERE supervisor_id = p_marketer_id;
  UPDATE marketing_users SET approved_by = NULL WHERE approved_by = p_marketer_id;
  UPDATE marketing_users SET disabled_by = NULL WHERE disabled_by = p_marketer_id;
  UPDATE marketing_users SET suspended_by = NULL WHERE suspended_by = p_marketer_id;
  UPDATE marketing_users SET deleted_by = NULL WHERE deleted_by = p_marketer_id;
  UPDATE marketing_users SET reinstated_by = NULL WHERE reinstated_by = p_marketer_id;
  UPDATE marketer_documents SET verified_by = NULL WHERE verified_by = p_marketer_id;

  WITH d AS (DELETE FROM marketer_account_actions WHERE marketer_id = p_marketer_id RETURNING 1)
  SELECT COUNT(*) INTO v_actions_deleted FROM d;

  WITH d AS (DELETE FROM marketer_approval_log WHERE marketer_id = p_marketer_id RETURNING 1)
  SELECT COUNT(*) INTO v_approval_log_deleted FROM d;

  -- marketer_documents rows cascade automatically (ON DELETE CASCADE),
  -- their storage paths were already captured above.
  DELETE FROM marketing_users WHERE id = p_marketer_id;

  INSERT INTO marketer_deletion_log (
    marketer_id, marketer_email_at_delete, marketer_role, performed_by, reason,
    visits_deleted, follow_ups_deleted, companies_unassigned,
    performance_deleted, notifications_deleted,
    account_actions_deleted, approval_log_deleted, documents_deleted
  ) VALUES (
    p_marketer_id, v_email, v_role, p_manager_id, p_reason,
    v_visits_deleted, v_followups_deleted, v_companies_unassigned,
    v_performance_deleted, v_notifications_deleted,
    v_actions_deleted, v_approval_log_deleted, v_documents_deleted
  );

  RETURN jsonb_build_object(
    'auth_user_id', v_auth_user_id,
    'profile_photo_path', v_profile_photo_path,
    'document_storage_paths', to_jsonb(v_document_paths)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
