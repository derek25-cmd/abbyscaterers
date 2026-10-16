-- Face attendance, Phase 1: who may read what, and who the signed-in user is.
--
--   face_templates, attendance_setup_codes
--       RLS on, NO client policies, and table privileges revoked from the
--       API roles. Only SECURITY DEFINER functions (later phases) touch them:
--       not even HR can read a face embedding or a code hash.
--   attendance_events, biometric_consents
--       HR reads all; an employee reads their own. No client writes.
--   attendance_devices
--       admins (can_manage_settings()) manage; HR reads.
--   face_attendance_settings
--       HR reads; admins update. The single row is never inserted or
--       deleted from the client.
--
-- Kiosk devices are not staff (see 20261016000300), so none of the
-- is_active_staff() policies elsewhere apply to them. current_device_id()
-- is how a function recognises a kiosk; face_whoami() is what the app calls
-- after sign-in to decide where to send the user.

-- ── 1. Reset policies on the new tables ────────────────────────────────────
DO $$
DECLARE
  t text;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'face_templates', 'attendance_setup_codes', 'attendance_events',
    'biometric_consents', 'attendance_devices', 'face_attendance_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- Nothing here is for signed-out callers.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
  END LOOP;
END $$;

-- ── 2. Biometric data and codes: no client access at all ───────────────────
REVOKE ALL ON TABLE public.face_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.attendance_setup_codes FROM PUBLIC, anon, authenticated;

-- ── 3. Punches and consents: HR all, employee own, no client writes ────────
CREATE POLICY attendance_events_select ON public.attendance_events
  FOR SELECT TO authenticated
  USING (public.can_manage_hr()
         OR (public.current_employee_id() IS NOT NULL AND employee_id = public.current_employee_id()));

CREATE POLICY biometric_consents_select ON public.biometric_consents
  FOR SELECT TO authenticated
  USING (public.can_manage_hr()
         OR (public.current_employee_id() IS NOT NULL AND employee_id = public.current_employee_id()));

-- ── 4. Devices: admins manage, HR reads ────────────────────────────────────
CREATE POLICY attendance_devices_select ON public.attendance_devices
  FOR SELECT TO authenticated USING (public.can_manage_hr() OR public.can_manage_settings());
CREATE POLICY attendance_devices_insert ON public.attendance_devices
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_settings());
CREATE POLICY attendance_devices_update ON public.attendance_devices
  FOR UPDATE TO authenticated USING (public.can_manage_settings()) WITH CHECK (public.can_manage_settings());
CREATE POLICY attendance_devices_delete ON public.attendance_devices
  FOR DELETE TO authenticated USING (public.can_manage_settings());

-- ── 5. Settings: HR reads, admins update ───────────────────────────────────
CREATE POLICY face_attendance_settings_select ON public.face_attendance_settings
  FOR SELECT TO authenticated USING (public.can_manage_hr() OR public.can_manage_settings());
CREATE POLICY face_attendance_settings_update ON public.face_attendance_settings
  FOR UPDATE TO authenticated USING (public.can_manage_settings()) WITH CHECK (public.can_manage_settings());

-- ── 6. Identity helpers ────────────────────────────────────────────────────
-- The active kiosk device the caller is signed in as, or NULL. SECURITY
-- DEFINER because devices cannot read attendance_devices themselves.
CREATE OR REPLACE FUNCTION public.current_device_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM public.attendance_devices
  WHERE auth_user_id = public.safe_auth_uid() AND active = true;
$$;

-- Where the face attendance app sends a signed-in user:
--   'hr'     an active staff member who can manage HR  -> /review
--   'device' an active kiosk device                    -> /kiosk
--   'none'   anyone else                               -> "not allowed"
CREATE OR REPLACE FUNCTION public.face_whoami()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN public.can_manage_hr() THEN 'hr'
    WHEN public.current_device_id() IS NOT NULL THEN 'device'
    ELSE 'none'
  END;
$$;

REVOKE ALL ON FUNCTION public.current_device_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.face_whoami() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_device_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.face_whoami() TO authenticated;
