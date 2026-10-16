-- Face attendance, Phase 1: tables.
--
-- The kiosk app (apps/face-attendance) records clock-in and clock-out by
-- face, with a PIN as fallback. This migration adds the storage only; the
-- functions that use it come in later phases. Nothing here is written by a
-- client directly: RLS (20261016000400) gives HR and the employee read
-- access to their own records and leaves face templates and setup codes
-- with no client access at all.
--
--   attendance_devices       shared kiosk tablets. Each signs in as its own
--                            Supabase Auth user, which is NEVER a staff_users
--                            row (is_active_staff() would open most CMS
--                            tables to a tablet anyone can pick up). A
--                            trigger enforces that both ways.
--   biometric_consents       the employee's consent to face matching, kept
--                            after withdrawal as a record.
--   face_templates           face embeddings. The vector has no fixed
--                            dimension yet: the model is chosen in Phase 0,
--                            and `dims` + `model_version` say what produced
--                            each row. No similarity index until then
--                            (ivfflat / hnsw need a fixed dimension).
--   attendance_setup_codes   one-time codes an employee uses to register
--                            their own face and PIN. Only the hash is kept.
--   attendance_events        every punch as it happened. The day's
--                            `attendance` row is rolled up from these by
--                            apply_attendance_event() (20261016000500).
--   face_attendance_settings a single row of thresholds and timings.
--
-- New employee columns: attendance_pin_hash (bcrypt via pgcrypto), face_status,
-- and the PIN lockout counters. The audit trigger masks the PIN hash
-- (20261016000600).

-- vector lives in `extensions` on Supabase (20261016000100). Reset at the end.
SET search_path TO public, extensions;

DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE EXCEPTION 'public.employees does not exist in this database; face attendance needs it';
  END IF;
END $$;

-- ── 1. Employee columns ────────────────────────────────────────────────────
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS attendance_pin_hash text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS face_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin_failed_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_face_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_face_status_check
  CHECK (face_status IN ('none', 'active', 'suspended'));
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_pin_failed_count_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_pin_failed_count_check
  CHECK (pin_failed_count >= 0);

-- ── 2. Kiosk devices ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL CHECK (length(trim(name)) > 0),
  site                text,
  auth_user_id        uuid UNIQUE,
  assigned_booking_id text,
  active              boolean NOT NULL DEFAULT true,
  created_by          uuid DEFAULT public.safe_auth_uid(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys to tables this repo does not create itself are added only
-- where they exist (auth.users always does on Supabase; bookings has no
-- single tracked CREATE TABLE).
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_devices_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_devices ADD CONSTRAINT attendance_devices_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF to_regclass('public.bookings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_devices_assigned_booking_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_devices ADD CONSTRAINT attendance_devices_assigned_booking_id_fkey
      FOREIGN KEY (assigned_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;
  ELSIF to_regclass('public.bookings') IS NULL THEN
    RAISE NOTICE 'public.bookings does not exist here; attendance_devices.assigned_booking_id has no foreign key';
  END IF;
END $$;

-- A device login must never be a staff login, and the other way round.
CREATE OR REPLACE FUNCTION public.attendance_device_not_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'attendance_devices' THEN
    IF NEW.auth_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.staff_users WHERE id = NEW.auth_user_id) THEN
      RAISE EXCEPTION 'This login belongs to a staff member. A kiosk device needs its own login.';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.attendance_devices WHERE auth_user_id = NEW.id) THEN
    RAISE EXCEPTION 'This login belongs to an attendance kiosk and cannot be a staff user.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_device_not_staff ON public.attendance_devices;
CREATE TRIGGER attendance_device_not_staff
  BEFORE INSERT OR UPDATE OF auth_user_id ON public.attendance_devices
  FOR EACH ROW EXECUTE FUNCTION public.attendance_device_not_staff();

DROP TRIGGER IF EXISTS attendance_device_not_staff ON public.staff_users;
CREATE TRIGGER attendance_device_not_staff
  BEFORE INSERT OR UPDATE OF id ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.attendance_device_not_staff();

-- ── 3. Biometric consent ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.biometric_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  consented_at    timestamptz NOT NULL DEFAULT now(),
  device_id       uuid REFERENCES public.attendance_devices(id) ON DELETE SET NULL,
  consent_version text NOT NULL CHECK (length(trim(consent_version)) > 0),
  withdrawn_at    timestamptz,
  withdrawn_by    uuid,
  CHECK (withdrawn_at IS NULL OR withdrawn_at >= consented_at)
);

-- At most one consent in force per employee; withdrawn ones stay on record.
CREATE UNIQUE INDEX IF NOT EXISTS biometric_consents_one_active
  ON public.biometric_consents (employee_id) WHERE withdrawn_at IS NULL;

-- ── 4. Face templates ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.face_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  embedding     vector NOT NULL,
  dims          integer NOT NULL CHECK (dims > 0),
  model_version text NOT NULL CHECK (length(trim(model_version)) > 0),
  quality_score real,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT face_templates_dims_match CHECK (vector_dims(embedding) = dims)
);

CREATE INDEX IF NOT EXISTS idx_face_templates_employee ON public.face_templates (employee_id);

-- ── 5. One-time setup codes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_setup_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  code_hash       text NOT NULL,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  created_by      uuid DEFAULT public.safe_auth_uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_setup_codes_unused
  ON public.attendance_setup_codes (employee_id) WHERE used_at IS NULL;

-- ── 6. Punches ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  device_id      uuid REFERENCES public.attendance_devices(id) ON DELETE SET NULL,
  kind           text NOT NULL CHECK (kind IN ('in', 'out')),
  occurred_at    timestamptz NOT NULL,
  method         text NOT NULL CHECK (method IN ('face', 'pin', 'manual')),
  match_score    real,
  liveness_score real,
  booking_id     text,
  lat            double precision CHECK (lat BETWEEN -90 AND 90),
  lng            double precision CHECK (lng BETWEEN -180 AND 180),
  needs_review   boolean NOT NULL DEFAULT false,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  review_note    text,
  -- Set by apply_attendance_event() once this punch is in the day's
  -- attendance row; NULL means not (yet) rolled up.
  applied_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_events_booking_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_events_employee_time ON public.attendance_events (employee_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_attendance_events_review ON public.attendance_events (occurred_at) WHERE needs_review;

-- ── 7. Settings (one row) ──────────────────────────────────────────────────
-- Same single-row shape as app_settings (id boolean = true).
CREATE TABLE IF NOT EXISTS public.face_attendance_settings (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- PLACEHOLDER. The right value depends on the face model (Phase 0) and is
  -- set from real matches in the Phase 6 pilot. Do not tune it before then.
  match_threshold     real NOT NULL DEFAULT 0.6 CHECK (match_threshold > 0 AND match_threshold <= 1),
  -- Local time (Africa/Dar_es_Salaam). A first clock-in after
  -- shift_start + late_grace_minutes is Late.
  shift_start         time NOT NULL DEFAULT '08:00',
  late_grace_minutes  integer NOT NULL DEFAULT 15 CHECK (late_grace_minutes BETWEEN 0 AND 240),
  max_pin_attempts    integer NOT NULL DEFAULT 5 CHECK (max_pin_attempts BETWEEN 1 AND 20),
  pin_lock_minutes    integer NOT NULL DEFAULT 15 CHECK (pin_lock_minutes BETWEEN 1 AND 1440),
  setup_code_ttl_days integer NOT NULL DEFAULT 7 CHECK (setup_code_ttl_days BETWEEN 1 AND 90),
  -- A second punch by the same person within this many seconds is a repeat
  -- tap, not a clock-out.
  double_tap_seconds  integer NOT NULL DEFAULT 60 CHECK (double_tap_seconds BETWEEN 0 AND 3600),
  -- Who changed it last; when, and from what, is in audit_log.
  updated_by          uuid
);

INSERT INTO public.face_attendance_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_updated_by ON public.face_attendance_settings;
CREATE TRIGGER set_updated_by
  BEFORE UPDATE ON public.face_attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

-- ── Who may call what ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.attendance_device_not_staff() FROM PUBLIC, anon, authenticated;

RESET search_path;
