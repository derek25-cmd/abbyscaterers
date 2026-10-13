-- Phase 2 (HR Manager review, section 2.1): leave management tables.
-- Depends on Phase 1 (can_manage_hr, is_active_staff, set_updated_by,
-- audit_row_change, safe_auth_uid) and 20261020000000 (current_employee_id).
--
-- Rules that live in the database, not just the UI (see 20261020000200 for the
-- functions and triggers that enforce them): a request is always created
-- `pending`; only review_leave_request() / cancel_leave_request() can move it;
-- approving writes the attendance rows and the balance in one transaction.

-- ── 1. Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  days_per_year numeric(6,1) NOT NULL DEFAULT 0 CHECK (days_per_year >= 0),
  is_paid boolean NOT NULL DEFAULT true,
  -- Unpaid leave has no entitlement to run out of, so it has no balance row.
  tracks_balance boolean NOT NULL DEFAULT true,
  requires_attachment boolean NOT NULL DEFAULT false,
  -- Days that may roll into the next leave year (applied by open_leave_year).
  max_carry_forward numeric(6,1) NOT NULL DEFAULT 0 CHECK (max_carry_forward >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row: how the working week is defined server-side. Mon-Sat by default
-- (ISO day numbers, 1 = Monday ... 7 = Sunday). The client reads this too, with
-- the same default as a fallback in src/lib/leave.ts, so HR can change it
-- here without a code release if it is confirmed as Mon-Fri.
CREATE TABLE IF NOT EXISTS public.leave_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  working_days integer[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]
    CHECK (working_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7] AND array_length(working_days, 1) >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.leave_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  -- Working days (excluding non-working weekdays and public holidays). Set by
  -- the BEFORE INSERT trigger, never trusted from the client.
  days numeric(5,1) NOT NULL CHECK (days > 0),
  reason text,
  -- Storage object path in the private leave-attachments bucket, not a URL.
  attachment_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests (employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  entitled numeric(6,1) NOT NULL DEFAULT 0 CHECK (entitled >= 0),
  carried_forward numeric(6,1) NOT NULL DEFAULT 0 CHECK (carried_forward >= 0),
  taken numeric(6,1) NOT NULL DEFAULT 0 CHECK (taken >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_balances_unique UNIQUE (employee_id, leave_type_id, year)
);

-- Marks attendance rows created by an approved request. RESTRICT: a request
-- that still owns attendance rows cannot be hard-deleted out from under them.
DO $$
BEGIN
  IF to_regclass('public.attendance') IS NULL THEN
    RAISE NOTICE 'Skipping attendance.leave_request_id — public.attendance does not exist in this database';
    RETURN;
  END IF;
  ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS idx_attendance_leave_request ON public.attendance (leave_request_id)
    WHERE leave_request_id IS NOT NULL;
END $$;

-- ── 2. Seed leave types ────────────────────────────────────────────────────
-- Editable by HR afterwards; the migration never overwrites an existing row.
INSERT INTO public.leave_types
  (name, description, days_per_year, is_paid, tracks_balance, requires_attachment, max_carry_forward, sort_order)
VALUES
  ('Annual',        'Yearly paid leave.', 28, true, true, false, 0, 1),
  ('Sick',          '126 days a year: the first 63 at full pay, the next 63 at half pay. Needs a medical document.', 126, true, true, true, 0, 2),
  ('Maternity',     'Paid leave around childbirth. Needs a medical document.', 84, true, true, true, 0, 3),
  ('Paternity',     'Paid leave for a new father. Needs a supporting document.', 3, true, true, true, 0, 4),
  ('Compassionate', 'Paid leave for a death or serious illness in the family.', 4, true, true, false, 0, 5),
  ('Unpaid',        'Leave without pay. No entitlement; days are listed in the unpaid-leave report for payroll.', 0, false, false, false, 0, 6)
ON CONFLICT (name) DO NOTHING;

-- ── 3. Seed fixed-date public holidays (2026-2027) ─────────────────────────
-- Moving holidays (Eid al-Fitr, Eid al-Adha, Good Friday, Easter Monday, ...)
-- depend on the calendar and are entered by HR on the Leave page. Check this
-- list against the official gazette; Jan 12 and Apr 7 are Zanzibar-origin
-- holidays. HR can delete any that do not apply.
INSERT INTO public.public_holidays (holiday_date, name)
SELECT make_date(y, m, d), n
FROM (VALUES
  (1, 1,  'New Year''s Day'),
  (1, 12, 'Zanzibar Revolution Day'),
  (4, 7,  'Karume Day'),
  (4, 26, 'Union Day'),
  (5, 1,  'Workers'' Day'),
  (7, 7,  'Saba Saba (Industry Day)'),
  (8, 8,  'Nane Nane (Farmers'' Day)'),
  (10, 14, 'Nyerere Day'),
  (12, 9, 'Independence Day'),
  (12, 25, 'Christmas Day'),
  (12, 26, 'Boxing Day')
) AS h(m, d, n)
CROSS JOIN (VALUES (2026), (2027)) AS yrs(y)
ON CONFLICT (holiday_date) DO NOTHING;

-- ── 4. Calendar helpers (one source of truth for working days) ─────────────
-- Leave year = calendar year for now. Everything that needs "which leave year
-- is this date in" goes through this function, so moving to a per-employee
-- leave cycle later is a one-function change (client twin: leaveYearOf()).
CREATE OR REPLACE FUNCTION public.leave_year_of(p_date date)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(YEAR FROM p_date)::integer;
$$;

-- Dates in [p_start, p_end] that count as leave days: a working weekday that
-- is not a public holiday.
CREATE OR REPLACE FUNCTION public.leave_working_dates(p_start date, p_end date)
RETURNS SETOF date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g::date
  FROM generate_series(p_start, p_end, interval '1 day') AS g
  WHERE EXTRACT(ISODOW FROM g)::integer = ANY (SELECT unnest(working_days) FROM public.leave_settings WHERE id = 1)
    AND NOT EXISTS (SELECT 1 FROM public.public_holidays h WHERE h.holiday_date = g::date)
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.leave_working_days(p_start date, p_end date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.leave_working_dates(p_start, p_end);
$$;

GRANT EXECUTE ON FUNCTION public.leave_year_of(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_working_dates(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_working_days(date, date) TO authenticated;

-- ── 5. Who/when columns and audit trigger (as in Phase 1) ──────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leave_types', 'leave_settings', 'public_holidays', 'leave_requests', 'leave_balances']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT public.safe_auth_uid()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approved_at timestamptz', t);

    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_by ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_by BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_by()', t);

    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t
    );
  END LOOP;
END $$;

-- ── 6. RLS ─────────────────────────────────────────────────────────────────
-- Everyone active can read (the apply dialog needs types, holidays and
-- balances). Anyone active can submit a request, always as `pending`; every
-- other write is HR-only. Balance and attendance changes caused by a decision
-- are made by the SECURITY DEFINER functions, which bypass these policies.
DO $$
DECLARE
  t text;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['leave_types', 'leave_settings', 'public_holidays', 'leave_requests', 'leave_balances']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_staff())', t || '_select', t);

    IF t = 'leave_requests' THEN
      EXECUTE 'CREATE POLICY leave_requests_insert ON public.leave_requests FOR INSERT TO authenticated '
           || 'WITH CHECK (public.is_active_staff() AND status = ''pending'')';
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_hr())', t || '_insert', t);
    END IF;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_hr()) WITH CHECK (public.can_manage_hr())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_manage_hr())', t || '_delete', t);
  END LOOP;
END $$;
