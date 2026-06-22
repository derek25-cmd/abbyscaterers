-- ============================================================
-- Supabase Auth + Marketer Onboarding Schema
-- All auth is via Supabase. auth.users is the identity table.
-- marketing_users extends auth.users with marketer-specific data.
--
-- This file is kept byte-identical to the migration already shipped in the
-- Flutter app's repo (abbys_marketer/supabase/migrations/
-- 20260621000000_supabase_auth_onboarding.sql) since both apps share one
-- Supabase project. Do not let this drift from that file — the Flutter app
-- is already built against these exact column/function names.
-- ============================================================

ALTER TABLE marketing_users
  ADD COLUMN IF NOT EXISTS auth_user_id      UUID UNIQUE
    REFERENCES auth.users(id) ON DELETE CASCADE,

  ADD COLUMN IF NOT EXISTS google_email      TEXT,
  ADD COLUMN IF NOT EXISTS google_name       TEXT,
  ADD COLUMN IF NOT EXISTS google_avatar_url TEXT,

  ADD COLUMN IF NOT EXISTS first_name        TEXT,
  ADD COLUMN IF NOT EXISTS middle_name       TEXT,
  ADD COLUMN IF NOT EXISTS last_name         TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS gender            TEXT
    CHECK (gender IN ('MALE','FEMALE','OTHER')),
  ADD COLUMN IF NOT EXISTS nationality       TEXT DEFAULT 'Tanzanian',
  ADD COLUMN IF NOT EXISTS physical_address  TEXT,
  ADD COLUMN IF NOT EXISTS district          TEXT,
  ADD COLUMN IF NOT EXISTS city              TEXT DEFAULT 'Dar es Salaam',

  ADD COLUMN IF NOT EXISTS nida_number       TEXT,
  ADD COLUMN IF NOT EXISTS tin_number        TEXT,
  ADD COLUMN IF NOT EXISTS nida_verified     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tin_verified      BOOLEAN DEFAULT false,

  ADD COLUMN IF NOT EXISTS employment_type   TEXT DEFAULT 'FULL_TIME'
    CHECK (employment_type IN ('FULL_TIME','PART_TIME','CONTRACT')),
  ADD COLUMN IF NOT EXISTS start_date        DATE,
  ADD COLUMN IF NOT EXISTS bio               TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_id     UUID REFERENCES marketing_users(id),

  ADD COLUMN IF NOT EXISTS emergency_name    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone   TEXT,
  ADD COLUMN IF NOT EXISTS emergency_relation TEXT,
  ADD COLUMN IF NOT EXISTS emergency_address TEXT,

  ADD COLUMN IF NOT EXISTS profile_photo_path TEXT,

  ADD COLUMN IF NOT EXISTS onboarding_step   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_done   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at      TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS approval_status   TEXT DEFAULT 'INCOMPLETE'
    CHECK (approval_status IN (
      'INCOMPLETE','PENDING','APPROVED','REJECTED','SUSPENDED'
    )),
  ADD COLUMN IF NOT EXISTS approved_by       UUID REFERENCES marketing_users(id),
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS marketer_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id   UUID NOT NULL REFERENCES marketing_users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'NIDA_FRONT','NIDA_BACK','TIN_CERTIFICATE',
    'PROFILE_PHOTO','SUPPORTING_DOCUMENT'
  )),
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  verified      BOOLEAN DEFAULT false,
  verified_by   UUID REFERENCES marketing_users(id),
  verified_at   TIMESTAMPTZ,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_marketer_docs_marketer_id
  ON marketer_documents(marketer_id);

ALTER TABLE marketer_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketer_docs_select" ON marketer_documents;
DROP POLICY IF EXISTS "marketer_docs_insert" ON marketer_documents;
DROP POLICY IF EXISTS "marketer_docs_update" ON marketer_documents;

CREATE POLICY "marketer_docs_select" ON marketer_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "marketer_docs_insert" ON marketer_documents
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "marketer_docs_update" ON marketer_documents
  FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS marketer_approval_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id  UUID NOT NULL REFERENCES marketing_users(id),
  action       TEXT NOT NULL CHECK (action IN (
    'REGISTERED','SUBMITTED','APPROVED',
    'REJECTED','SUSPENDED','REINSTATED'
  )),
  performed_by TEXT NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketer_approval_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approval_log_select" ON marketer_approval_log;
DROP POLICY IF EXISTS "approval_log_insert" ON marketer_approval_log;

CREATE POLICY "approval_log_select" ON marketer_approval_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_log_insert" ON marketer_approval_log
  FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('marketer-documents', 'marketer-documents', false, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('marketer-avatars', 'marketer-avatars', false, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "docs_upload" ON storage.objects;
DROP POLICY IF EXISTS "docs_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;

CREATE POLICY "docs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketer-documents');
CREATE POLICY "docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'marketer-documents');
CREATE POLICY "avatars_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketer-avatars');
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'marketer-avatars');

-- No trigger on auth.users — both apps create the marketing_users row
-- themselves after sign-in succeeds. This avoids breaking the auth
-- transaction if the insert fails.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_auth_user();

CREATE OR REPLACE VIEW pending_marketer_applications AS
SELECT
  mu.id, mu.full_name, mu.first_name, mu.last_name,
  mu.google_email AS email, mu.google_avatar_url, mu.phone,
  mu.nida_number, mu.tin_number, mu.region_id,
  r.name AS region_name, mu.employment_type,
  mu.submitted_at, mu.approval_status, mu.onboarding_step,
  COUNT(md.id) AS document_count
FROM marketing_users mu
LEFT JOIN regions r ON r.id = mu.region_id
LEFT JOIN marketer_documents md ON md.marketer_id = mu.id
WHERE mu.approval_status = 'PENDING' AND mu.submitted_at IS NOT NULL
GROUP BY mu.id, mu.full_name, mu.first_name, mu.last_name,
         mu.google_email, mu.google_avatar_url, mu.phone,
         mu.nida_number, mu.tin_number, mu.region_id,
         r.name, mu.employment_type, mu.submitted_at,
         mu.approval_status, mu.onboarding_step
ORDER BY mu.submitted_at ASC;

CREATE OR REPLACE FUNCTION approve_marketer(
  p_marketer_id UUID, p_manager_id UUID, p_role TEXT DEFAULT 'MARKETER'
) RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    is_active = true, approval_status = 'APPROVED',
    role = p_role::marketing_user_role,
    approved_by = p_manager_id, approved_at = NOW()
  WHERE id = p_marketer_id;
  INSERT INTO marketer_approval_log (marketer_id, action, performed_by)
  VALUES (p_marketer_id, 'APPROVED', p_manager_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_marketer(
  p_marketer_id UUID, p_manager_id UUID, p_reason TEXT
) RETURNS void AS $$
BEGIN
  UPDATE marketing_users SET
    approval_status = 'REJECTED', rejection_reason = p_reason, rejected_at = NOW()
  WHERE id = p_marketer_id;
  INSERT INTO marketer_approval_log (marketer_id, action, performed_by, reason)
  VALUES (p_marketer_id, 'REJECTED', p_manager_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_nida(nida TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN regexp_replace(nida, '[\s\-]', '', 'g') ~ '^[0-9]{20}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION validate_tin(tin TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN regexp_replace(tin, '[\s\-]', '', 'g') ~ '^[0-9]{9}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
