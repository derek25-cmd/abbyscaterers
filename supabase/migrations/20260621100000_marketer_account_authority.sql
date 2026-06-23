-- ============================================================
-- Marketer Account Authority System
-- Abby's Legendary Caterers
--
-- Kept byte-identical to the copy in the Flutter app's repo
-- (abbys_marketer/supabase/migrations/20260621100000_marketer_account_authority.sql)
-- since both apps share one Supabase project.
-- ============================================================

ALTER TABLE marketing_users
  DROP CONSTRAINT IF EXISTS marketing_users_approval_status_check;

ALTER TABLE marketing_users
  ADD CONSTRAINT marketing_users_approval_status_check
  CHECK (approval_status IN (
    'INCOMPLETE',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CAUTIONED',
    'RESTRICTED',
    'DISABLED',
    'SUSPENDED',
    'DELETED'
  ));

ALTER TABLE marketing_users
  ADD COLUMN IF NOT EXISTS caution_count        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_caution_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_caution_reason  TEXT,
  ADD COLUMN IF NOT EXISTS restriction_reason   TEXT,
  ADD COLUMN IF NOT EXISTS restricted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_reason      TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_by          UUID REFERENCES marketing_users(id),
  ADD COLUMN IF NOT EXISTS suspended_until      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason    TEXT,
  ADD COLUMN IF NOT EXISTS suspended_by         UUID REFERENCES marketing_users(id),
  ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by           UUID REFERENCES marketing_users(id),
  ADD COLUMN IF NOT EXISTS reinstated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reinstated_by        UUID REFERENCES marketing_users(id);

ALTER TABLE marketer_approval_log
  DROP CONSTRAINT IF EXISTS marketer_approval_log_action_check;

ALTER TABLE marketer_approval_log
  ADD CONSTRAINT marketer_approval_log_action_check
  CHECK (action IN (
    'REGISTERED', 'SUBMITTED', 'APPROVED', 'REJECTED',
    'CAUTIONED', 'RESTRICTED', 'RESTRICTION_LIFTED',
    'DISABLED', 'REINSTATED', 'SUSPENDED', 'SUSPENSION_LIFTED',
    'DELETED', 'PROFILE_UPDATED_BY_MANAGER'
  ));

-- Account actions table — richer than the audit log, stores full context
-- of every management action taken. UUID throughout (not TEXT) since
-- marketing_users.id is UUID and a TEXT-typed FK against a UUID PK fails
-- at migration time.
CREATE TABLE IF NOT EXISTS marketer_account_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id     UUID NOT NULL REFERENCES marketing_users(id),
  action          TEXT NOT NULL,
  performed_by    UUID NOT NULL REFERENCES marketing_users(id),
  reason          TEXT,
  internal_notes  TEXT,
  visible_to_marketer BOOLEAN DEFAULT true,
  effective_from  TIMESTAMPTZ DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  reverted_at     TIMESTAMPTZ,
  reverted_by     UUID REFERENCES marketing_users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_actions_marketer
  ON marketer_account_actions(marketer_id, created_at DESC);

ALTER TABLE marketer_account_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_actions_select" ON marketer_account_actions;
DROP POLICY IF EXISTS "account_actions_insert" ON marketer_account_actions;
DROP POLICY IF EXISTS "account_actions_update" ON marketer_account_actions;

CREATE POLICY "account_actions_select" ON marketer_account_actions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "account_actions_insert" ON marketer_account_actions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "account_actions_update" ON marketer_account_actions
  FOR UPDATE TO authenticated USING (true);

-- ── Account management functions ─────────────────────────────

CREATE OR REPLACE FUNCTION caution_marketer(
  p_marketer_id UUID,
  p_manager_id  UUID,
  p_reason      TEXT,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status      = 'CAUTIONED',
    caution_count        = COALESCE(caution_count, 0) + 1,
    last_caution_at      = NOW(),
    last_caution_reason  = p_reason
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes, visible_to_marketer)
  VALUES
    (p_marketer_id, 'CAUTIONED', p_manager_id, p_reason, p_notes, true);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'CAUTIONED', p_manager_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION restrict_marketer(
  p_marketer_id UUID,
  p_manager_id  UUID,
  p_reason      TEXT,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status    = 'RESTRICTED',
    restriction_reason = p_reason,
    restricted_at      = NOW(),
    is_active          = true
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes)
  VALUES
    (p_marketer_id, 'RESTRICTED', p_manager_id, p_reason, p_notes);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'RESTRICTED', p_manager_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION lift_restriction(
  p_marketer_id UUID,
  p_manager_id  UUID,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status    = 'APPROVED',
    restriction_reason = NULL,
    restricted_at      = NULL
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, internal_notes, visible_to_marketer)
  VALUES
    (p_marketer_id, 'RESTRICTION_LIFTED', p_manager_id, p_notes, true);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by)
  VALUES (p_marketer_id, 'RESTRICTION_LIFTED', p_manager_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION disable_marketer(
  p_marketer_id UUID,
  p_manager_id  UUID,
  p_reason      TEXT,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    is_active       = false,
    approval_status = 'DISABLED',
    disabled_reason = p_reason,
    disabled_at     = NOW(),
    disabled_by     = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes)
  VALUES
    (p_marketer_id, 'DISABLED', p_manager_id, p_reason, p_notes);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'DISABLED', p_manager_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reinstate_marketer(
  p_marketer_id UUID,
  p_manager_id  UUID,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    is_active         = true,
    approval_status   = 'APPROVED',
    disabled_reason   = NULL,
    disabled_at       = NULL,
    disabled_by       = NULL,
    suspended_until   = NULL,
    suspension_reason = NULL,
    suspended_by      = NULL,
    reinstated_at     = NOW(),
    reinstated_by     = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, internal_notes, visible_to_marketer)
  VALUES
    (p_marketer_id, 'REINSTATED', p_manager_id, p_notes, true);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by)
  VALUES (p_marketer_id, 'REINSTATED', p_manager_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION suspend_marketer(
  p_marketer_id  UUID,
  p_manager_id   UUID,
  p_reason       TEXT,
  p_until        TIMESTAMPTZ,
  p_notes        TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF p_until <= NOW() THEN
    RAISE EXCEPTION 'Suspension end date must be in the future';
  END IF;

  UPDATE marketing_users SET
    is_active         = false,
    approval_status   = 'SUSPENDED',
    suspension_reason = p_reason,
    suspended_until   = p_until,
    suspended_by      = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes,
     effective_from, effective_until)
  VALUES
    (p_marketer_id, 'SUSPENDED', p_manager_id, p_reason, p_notes,
     NOW(), p_until);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'SUSPENDED', p_manager_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-reinstate expired suspensions — called by the nightly cron at
-- /api/cron/marketing-performance
CREATE OR REPLACE FUNCTION auto_reinstate_expired_suspensions()
RETURNS INTEGER AS $$
DECLARE
  reinstated_count INTEGER := 0;
BEGIN
  UPDATE marketing_users SET
    is_active         = true,
    approval_status   = 'APPROVED',
    suspended_until   = NULL,
    suspension_reason = NULL,
    suspended_by      = NULL,
    reinstated_at     = NOW()
  WHERE approval_status = 'SUSPENDED'
    AND suspended_until IS NOT NULL
    AND suspended_until <= NOW();

  GET DIAGNOSTICS reinstated_count = ROW_COUNT;
  RETURN reinstated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft-delete: anonymise PII and block access permanently.
-- Column names below match the actual marketing_users schema
-- (google_name / google_avatar_url / profile_photo_path — not
-- google_display_name / profile_photo_url, which don't exist).
CREATE OR REPLACE FUNCTION delete_marketer(
  p_marketer_id UUID,
  p_manager_id  UUID,
  p_reason      TEXT,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM marketing_users WHERE id = p_marketer_id;

  UPDATE marketing_users SET
    is_active           = false,
    approval_status      = 'DELETED',
    full_name            = 'Deleted Account',
    first_name           = NULL,
    middle_name          = NULL,
    last_name            = NULL,
    email                = 'deleted_' || p_marketer_id || '@abbys.internal',
    google_email         = NULL,
    google_name          = NULL,
    google_avatar_url    = NULL,
    phone                = NULL,
    physical_address     = NULL,
    nida_number          = NULL,
    tin_number           = NULL,
    emergency_name        = NULL,
    emergency_phone       = NULL,
    emergency_address     = NULL,
    profile_photo_path    = NULL,
    deleted_at            = NOW(),
    deleted_by            = p_manager_id
  WHERE id = p_marketer_id;

  INSERT INTO marketer_account_actions
    (marketer_id, action, performed_by, reason, internal_notes,
     visible_to_marketer)
  VALUES
    (p_marketer_id, 'DELETED', p_manager_id, p_reason,
     COALESCE(p_notes, '') || ' | Original email: ' || COALESCE(v_email, 'unknown'),
     false);

  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'DELETED', p_manager_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Acknowledge a caution (marketer confirms they have read it)
CREATE OR REPLACE FUNCTION acknowledge_caution(
  p_marketer_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status = 'APPROVED'
  WHERE id = p_marketer_id
    AND approval_status = 'CAUTIONED';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: all marketers with their current account status for the
-- management table
CREATE OR REPLACE VIEW marketer_account_overview AS
SELECT
  mu.id,
  mu.full_name,
  mu.email,
  mu.google_email,
  mu.phone,
  mu.role,
  mu.is_active,
  mu.approval_status,
  mu.caution_count,
  mu.last_caution_at,
  mu.disabled_reason,
  mu.disabled_at,
  mu.suspended_until,
  mu.suspension_reason,
  mu.deleted_at,
  r.name AS region_name,
  mu.region_id,

  mp.total_visits  AS visits_this_month,
  mp.deals_won      AS deals_this_month,
  mp.avg_lead_score,

  mu.last_seen_at,
  mu.last_latitude,
  mu.last_longitude,

  (SELECT COUNT(*) FROM marketer_account_actions a
   WHERE a.marketer_id = mu.id AND a.action = 'CAUTIONED') AS total_cautions,

  (SELECT COUNT(*) FROM marketer_account_actions a
   WHERE a.marketer_id = mu.id AND a.action = 'DISABLED') AS total_disables

FROM marketing_users mu
LEFT JOIN regions r ON r.id = mu.region_id
LEFT JOIN marketing_performance mp
  ON mp.marketer_id = mu.id
  AND mp.month = EXTRACT(MONTH FROM NOW())::INTEGER
  AND mp.year  = EXTRACT(YEAR FROM NOW())::INTEGER
-- Intentionally no status filter — this is the comprehensive roster the
-- web CMS uses to see and monitor every account ever created via the
-- marketer app, regardless of where it is in the onboarding/approval
-- funnel. PENDING applications are still reviewed via the dedicated
-- /marketing/applications flow; they also appear here for visibility.
ORDER BY
  CASE mu.approval_status
    WHEN 'PENDING' THEN 0
    WHEN 'INCOMPLETE' THEN 1
    ELSE 2
  END,
  mu.full_name ASC;
