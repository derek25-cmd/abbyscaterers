-- Leave management tests (Phase 2): who may do what, and that approval and
-- cancellation really move the balance and the attendance rows.
--
-- RUN AGAINST A LOCAL OR STAGING DATABASE ONLY, never production, after all
-- migrations through 20261014000900 are applied. Same harness as
-- hr_ops_rls.sql: ONE statement, works with the hosted `postgres` role, and it
-- ALWAYS ends in an exception that starts with PASS: or FAIL: (and rolls back
-- everything it created: users, employees, requests, attendance, notifications).
--
-- It acts as four people: staffA (a plain staff login linked to employee A),
-- staffB (staff, employee B), hr (hr_manager, employee H) and adm (admin, not
-- linked to an employee). All dates are in 2030 so they cannot touch real data.
-- Mon 4 Mar 2030 is a Monday; the default working week is Mon-Sat.
--
-- Not covered here: the UI. Storage checks are skipped, with a note in the
-- result, if the postgres role is not allowed to write storage.objects.

DO $test$
DECLARE
  yr constant integer := 2030;
  roles_ constant text[] := ARRAY['staffA', 'staffB', 'hr', 'adm'];
  u jsonb := '{}'::jsonb;      -- test login -> auth uid
  emp jsonb := '{}'::jsonb;    -- employee key -> employees.id
  nm text; uid uuid; r text; n integer; v numeric; ok boolean;
  annual uuid; paternity uuid; sick uuid;
  req1 uuid; req2 uuid; reqH uuid; reqB uuid; req3 uuid;
  res text; absent_id text; failures integer; checks integer; notes text[] := '{}';
BEGIN
  -- Go-live guard (Phase 5): these tests create and roll back test rows. Once
  -- go-live is recorded (app_settings.hr_go_live_at) they must not run on this
  -- database any more; use the read-only checks in docs/hr-ops instead.
  IF (SELECT to_jsonb(s) ->> 'hr_go_live_at' FROM public.app_settings s WHERE s.id = true) IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSED: go-live has been recorded (app_settings.hr_go_live_at), so the SQL tests no longer run on this database. Use docs/hr-ops/postflight.sql and monitoring.sql.';
  END IF;
  CREATE TEMP TABLE rls_results (who text, tbl text, op text, expected boolean, actual boolean) ON COMMIT DROP;

  -- ── Helpers, created inside this block so nothing is left behind ─────────
  EXECUTE $mk$
    CREATE FUNCTION public._rlstest_id(tbl text, suffix text) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE dt text;
    BEGIN
      SELECT data_type INTO dt FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'id';
      IF dt = 'uuid' THEN RETURN md5('rlstest-' || tbl || suffix)::uuid::text; END IF;
      IF dt IN ('integer', 'bigint', 'smallint') THEN RETURN (abs(hashtext('rlstest-' || tbl || suffix)))::text; END IF;
      RETURN 'rlstest-' || suffix;
    END $f$;
  $mk$;
  EXECUTE $mk$
    CREATE FUNCTION public._rlstest_insert_sql(tbl text, suffix text, ov jsonb) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE cols text; vals text;
    BEGIN
      SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
             string_agg(val, ', ' ORDER BY ordinal_position)
      INTO cols, vals
      FROM (
        SELECT c.column_name, c.ordinal_position,
          CASE
            WHEN c.column_name = 'id' THEN quote_literal(public._rlstest_id(tbl, suffix))
            WHEN ov ? c.column_name THEN quote_nullable(ov ->> c.column_name)
            WHEN c.column_name = 'score' THEN '3'
            WHEN c.data_type IN ('text', 'character varying', 'character') THEN quote_literal('t-' || suffix)
            WHEN c.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real') THEN '0'
            WHEN c.data_type = 'date' THEN quote_literal(current_date::text)
            WHEN c.data_type LIKE 'timestamp%' THEN 'now()'
            WHEN c.data_type = 'boolean' THEN 'false'
            WHEN c.data_type = 'uuid' THEN quote_literal(md5(suffix || c.column_name)::uuid::text)
            WHEN c.data_type IN ('json', 'jsonb', 'ARRAY') THEN quote_literal('{}')
            ELSE 'NULL'
          END AS val
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = tbl
          AND (c.column_name = 'id' OR ov ? c.column_name
               OR (c.is_nullable = 'NO' AND c.column_default IS NULL AND c.is_generated = 'NEVER' AND c.is_identity = 'NO'))
      ) x;
      RETURN format('INSERT INTO public.%I (%s) VALUES (%s)', tbl, cols, vals);
    END $f$;
  $mk$;
  EXECUTE $mk$
    CREATE FUNCTION public._rlstest_login(uid uuid) RETURNS void LANGUAGE plpgsql AS $f$
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
      PERFORM set_config('request.jwt.claim.sub', uid::text, true);
    END $f$;
  $mk$;
  EXECUTE $mk$
    CREATE FUNCTION public._rlstest_fk_ov(tbl text, suffix text) RETURNS jsonb LANGUAGE plpgsql AS $f$
    DECLARE fk RECORD; v text; res jsonb := '{}'::jsonb;
    BEGIN
      FOR fk IN
        SELECT a.attname AS col, c.confrelid::regclass::text AS parent, pa.attname AS parent_col, pc.relname AS parent_name
        FROM pg_constraint c
        JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
        JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
        JOIN pg_class pc ON pc.oid = c.confrelid
        WHERE c.contype = 'f' AND c.conrelid = ('public.' || quote_ident(tbl))::regclass
          AND array_length(c.conkey, 1) = 1
          -- Only REQUIRED foreign keys need a parent. Nullable ones (e.g. attendance.leave_request_id)
          -- stay NULL: pointing them at a made-up parent would make the insert fail.
          AND a.attnotnull AND pc.relnamespace = 'public'::regnamespace
      LOOP
        IF fk.parent_col = 'id' THEN
          PERFORM public._rlstest_seed(fk.parent_name, 'fk-' || suffix, '{}'::jsonb);
          v := public._rlstest_id(fk.parent_name, 'fk-' || suffix);
        ELSE
          EXECUTE format('SELECT %I::text FROM %s ORDER BY 1 LIMIT 1', fk.parent_col, fk.parent) INTO v;
        END IF;
        IF v IS NOT NULL THEN res := res || jsonb_build_object(fk.col, v); END IF;
      END LOOP;
      RETURN res;
    END $f$;
  $mk$;
  EXECUTE $mk$
    CREATE FUNCTION public._rlstest_seed(tbl text, suffix text, ov jsonb) RETURNS boolean LANGUAGE plpgsql AS $f$
    DECLARE found int;
    BEGIN
      BEGIN
        EXECUTE public._rlstest_insert_sql(tbl, suffix, public._rlstest_fk_ov(tbl, suffix) || ov) || ' ON CONFLICT DO NOTHING';
      EXCEPTION WHEN OTHERS THEN
        PERFORM set_config('rlstest.last_err', tbl || ': ' || SQLERRM, true);
        RETURN false;
      END;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE id::text = %L', tbl, public._rlstest_id(tbl, suffix)) INTO found;
      RETURN found > 0;
    END $f$;
  $mk$;
  -- Run one statement as a signed-in user. Returns 'ok:<rows>' or
  -- 'err:<sqlstate>:<message>|<hint>'. Claims are cleared afterwards so the
  -- owner-side seeding that follows is not mistaken for that user.
  EXECUTE $mk$
    CREATE FUNCTION public._lt_as(uid uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE n integer; m text; h text; res text;
    BEGIN
      PERFORM public._rlstest_login(uid);
      SET LOCAL ROLE authenticated;
      BEGIN
        EXECUTE stmt;
        GET DIAGNOSTICS n = ROW_COUNT;
        res := 'ok:' || n;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS m = MESSAGE_TEXT, h = PG_EXCEPTION_HINT;
        res := 'err:' || SQLSTATE || ':' || coalesce(m, '') || '|' || coalesce(h, '');
      END;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);
      PERFORM set_config('request.jwt.claim.sub', '', true);
      RETURN res;
    END $f$;
  $mk$;

  -- ── Fixtures ─────────────────────────────────────────────────────────────
  FOREACH nm IN ARRAY roles_ LOOP
    uid := md5('leavetest-user-' || nm)::uuid;
    u := u || jsonb_build_object(nm, uid);
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (uid, nm || '@leavetest.local', 'authenticated', 'authenticated') ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- Employees: A, B, H (linked to logins), C and D (carry-forward cases).
  FOREACH nm IN ARRAY ARRAY['A', 'B', 'H', 'C', 'D'] LOOP
    IF NOT public._rlstest_seed('employees', 'lt-' || nm,
         jsonb_build_object('status', 'Active', 'department', 'LeaveTest', 'firstName', 'Test' || nm, 'lastName', 'Leave')) THEN
      RAISE EXCEPTION 'FAIL: could not seed an employee row (%)', current_setting('rlstest.last_err', true);
    END IF;
    emp := emp || jsonb_build_object(nm, public._rlstest_id('employees', 'lt-' || nm));
  END LOOP;

  INSERT INTO public.staff_users (id, email, role, is_active, employee_id) VALUES
    ((u ->> 'staffA')::uuid, 'staffA@leavetest.local', 'staff',      true, emp ->> 'A'),
    ((u ->> 'staffB')::uuid, 'staffB@leavetest.local', 'staff',      true, emp ->> 'B'),
    ((u ->> 'hr')::uuid,     'hr@leavetest.local',     'hr_manager', true, emp ->> 'H'),
    ((u ->> 'adm')::uuid,    'adm@leavetest.local',    'admin',      true, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true, employee_id = EXCLUDED.employee_id;

  SELECT id INTO annual    FROM public.leave_types WHERE name = 'Annual';
  SELECT id INTO paternity FROM public.leave_types WHERE name = 'Paternity';
  SELECT id INTO sick      FROM public.leave_types WHERE name = 'Sick';
  IF annual IS NULL OR paternity IS NULL OR sick IS NULL THEN
    RAISE EXCEPTION 'FAIL: the seeded leave types are missing. Apply 20261014000600_leave_management.sql first.';
  END IF;

  -- Carry-forward fixtures must exist BEFORE the first open_leave_year call.
  UPDATE public.leave_types SET max_carry_forward = 5 WHERE id = annual;
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled, taken) VALUES
    (emp ->> 'C', annual, yr - 1, 28, 20),   -- 8 left, limit 5  -> carries 5
    (emp ->> 'D', annual, yr - 1, 28, 26);   -- 2 left, limit 5  -> carries 2

  -- ── A. Submitting ────────────────────────────────────────────────────────
  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, reason) VALUES (%L, %L, %L, %L, %L)',
    emp ->> 'A', annual, '2030-03-04', '2030-03-08', 'family'));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'files own request', true, res LIKE 'ok:%');
  SELECT id INTO req1 FROM public.leave_requests WHERE employee_id = emp ->> 'A' AND start_date = '2030-03-04';
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'new request is pending', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = req1 AND status = 'pending'));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'days counted by the database (Mon-Fri = 5)', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = req1 AND days = 5));

  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)',
    emp ->> 'B', annual, '2030-04-01', '2030-04-02'));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'files for someone else (linked login)', false, res LIKE 'ok:%');

  -- A client cannot choose status, days or approver: the trigger overrides them.
  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, status, days, approved_by) VALUES (%L, %L, %L, %L, %L, 99, %L)',
    emp ->> 'A', annual, '2030-04-01', '2030-04-02', 'approved', u ->> 'staffA'));
  SELECT id INTO req2 FROM public.leave_requests WHERE employee_id = emp ->> 'A' AND start_date = '2030-04-01';
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'forged status/days/approver are overridden', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = req2 AND status = 'pending' AND days = 2 AND approved_by IS NULL));

  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)',
    emp ->> 'A', annual, '2030-03-06', '2030-03-07'));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'overlapping request', false, res LIKE 'ok:%');

  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)',
    emp ->> 'A', sick, '2030-07-01', '2030-07-02'));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'Sick leave without a document', false, res LIKE 'ok:%');

  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, attachment_path) VALUES (%L, %L, %L, %L, %L)',
    emp ->> 'A', paternity, '2030-08-05', '2030-08-09', (u ->> 'staffA') || '/proof.pdf'));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'more days than the balance (5 > 3 Paternity)', false, res LIKE 'ok:%');

  -- ── B. A plain staff user cannot approve, edit or delete ─────────────────
  res := public._lt_as((u ->> 'staffA')::uuid, format('UPDATE public.leave_requests SET reason = %L WHERE id = %L', 'edited', req1));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'edits a submitted request', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('DELETE FROM public.leave_requests WHERE id = %L', req1));
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'deletes a submitted request', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT public.review_leave_request(%L, %L)', req1, 'approved'));
  INSERT INTO rls_results VALUES ('staffA', 'review_leave_request', 'staff approves', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'staffB')::uuid, format('SELECT public.cancel_leave_request(%L)', req1));
  INSERT INTO rls_results VALUES ('staffB', 'cancel_leave_request', 'cancels someone else''s request', false, res LIKE 'ok:%');

  -- ── C. Notifications on submit ───────────────────────────────────────────
  INSERT INTO rls_results VALUES ('hr', 'hr_notifications', 'told about the new request', true,
    EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = (u ->> 'hr')::uuid AND type = 'leave_request'));
  INSERT INTO rls_results VALUES ('adm', 'hr_notifications', 'told about the new request', true,
    EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = (u ->> 'adm')::uuid AND type = 'leave_request'));
  INSERT INTO rls_results VALUES ('staffB', 'hr_notifications', 'not told about it', true,
    NOT EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = (u ->> 'staffB')::uuid AND type = 'leave_request'));

  -- ── D. Nobody approves their own leave ───────────────────────────────────
  res := public._lt_as((u ->> 'hr')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)',
    emp ->> 'H', annual, '2030-04-15', '2030-04-16'));
  SELECT id INTO reqH FROM public.leave_requests WHERE employee_id = emp ->> 'H' AND start_date = '2030-04-15';
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'HR files own request', true, reqH IS NOT NULL);

  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.review_leave_request(%L, %L)', reqH, 'approved'));
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'approves own request', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'self-approval gives a clear reason', true, res LIKE '%your own leave%');
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.review_leave_request(%L, %L, %L)', reqH, 'rejected', 'no'));
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'rejects own request', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'adm')::uuid, format('SELECT public.review_leave_request(%L, %L)', reqH, 'approved'));
  INSERT INTO rls_results VALUES ('adm', 'review_leave_request', 'another approver approves it', true, res LIKE 'ok:%');

  -- ── E. Approving writes attendance and moves the balance ─────────────────
  -- A normal Present day for A, to prove cancellation leaves other rows alone.
  PERFORM public._rlstest_seed('attendance', 'lt-keep', jsonb_build_object('employee_id', emp ->> 'A', 'date', '2030-06-03', 'status', 'Present'));

  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.review_leave_request(%L, %L, %L)', req1, 'approved', 'enjoy'));
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'HR approves staff request', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'status is approved, with approver and time', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = req1 AND status = 'approved' AND approved_by = (u ->> 'hr')::uuid AND approved_at IS NOT NULL));
  SELECT count(*) INTO n FROM public.attendance WHERE leave_request_id = req1 AND status = 'Leave';
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'one Leave row per working day (5)', true, n = 5);
  SELECT taken INTO v FROM public.leave_balances WHERE employee_id = emp ->> 'A' AND leave_type_id = annual AND year = yr;
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'taken goes up by 5', true, v = 5);
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'approval is in the audit trail with who', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'leave_requests.approve' AND record_id = req1::text AND actor_id = (u ->> 'hr')::uuid));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'attendance rows created by approval are audited', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'attendance.insert' AND table_name = 'attendance' AND metadata -> 'new' ->> 'leave_request_id' = req1::text));
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT * FROM public.audit_log WHERE action = %L AND record_id = %L', 'leave_requests.approve', req1::text));
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'HR Manager can read the leave approval', true, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT * FROM public.audit_log WHERE action = %L AND record_id = %L', 'leave_requests.approve', req1::text));
  INSERT INTO rls_results VALUES ('staffA', 'audit_log', 'staff cannot read the audit trail', false, res LIKE 'ok:%' AND res <> 'ok:0');
  INSERT INTO rls_results VALUES ('staffA', 'hr_notifications', 'requester told of the decision', true,
    EXISTS (SELECT 1 FROM public.hr_notifications WHERE recipient_id = (u ->> 'staffA')::uuid AND type = 'leave_decision'));

  -- ── F. Leave-backed attendance is locked for staff ───────────────────────
  res := public._lt_as((u ->> 'staffA')::uuid, format('UPDATE public.attendance SET notes = %L WHERE leave_request_id = %L', 'x', req1));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'edits a leave-backed day', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('DELETE FROM public.attendance WHERE leave_request_id = %L', req1));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'deletes a leave-backed day', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid,
    public._rlstest_insert_sql('attendance', 'lt-manual', jsonb_build_object('employee_id', emp ->> 'A', 'date', '2030-06-04', 'status', 'Leave')));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'marks Leave by hand', false, res LIKE 'ok:%');
  -- Since 20261016000200 staff no longer write attendance at all (the kiosk does);
  -- HR still marks a normal day by hand.
  res := public._lt_as((u ->> 'staffA')::uuid,
    public._rlstest_insert_sql('attendance', 'lt-present', jsonb_build_object('employee_id', emp ->> 'A', 'date', '2030-06-05', 'status', 'Present')));
  INSERT INTO rls_results VALUES ('staffA', 'attendance', 'marks own Present by hand', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid,
    public._rlstest_insert_sql('attendance', 'lt-present', jsonb_build_object('employee_id', emp ->> 'A', 'date', '2030-06-05', 'status', 'Present')));
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'normal Present still works', true, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.attendance SET notes = %L WHERE leave_request_id = %L', 'hr note', req1));
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'HR can still edit a leave-backed day', true, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── G. Cancelling restores everything it changed, and only that ──────────
  res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT public.cancel_leave_request(%L)', req1));
  INSERT INTO rls_results VALUES ('staffA', 'cancel_leave_request', 'staff cancels approved leave', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.cancel_leave_request(%L, %L)', req1, 'plans changed'));
  INSERT INTO rls_results VALUES ('hr', 'cancel_leave_request', 'HR cancels approved leave', true, res LIKE 'ok:%');
  SELECT taken INTO v FROM public.leave_balances WHERE employee_id = emp ->> 'A' AND leave_type_id = annual AND year = yr;
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'taken is restored to 0', true, v = 0);
  SELECT count(*) INTO n FROM public.attendance WHERE leave_request_id = req1;
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'leave days removed', true, n = 0);
  SELECT count(*) INTO n FROM public.attendance WHERE employee_id = emp ->> 'A' AND date IN ('2030-06-03', '2030-06-05');
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'other attendance rows untouched', true, n = 2);
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'status is cancelled', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = req1 AND status = 'cancelled'));

  res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT public.cancel_leave_request(%L)', req2));
  INSERT INTO rls_results VALUES ('staffA', 'cancel_leave_request', 'requester withdraws own pending request', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('staffA', 'leave_requests', 'withdrawn request is cancelled', true,
    EXISTS (SELECT 1 FROM public.leave_requests WHERE id = req2 AND status = 'cancelled'));

  -- ── H. Attendance already recorded on the days ───────────────────────────
  res := public._lt_as((u ->> 'staffB')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)',
    emp ->> 'B', annual, '2030-05-06', '2030-05-08'));
  SELECT id INTO reqB FROM public.leave_requests WHERE employee_id = emp ->> 'B' AND start_date = '2030-05-06';
  PERFORM public._rlstest_seed('attendance', 'lt-b1', jsonb_build_object('employee_id', emp ->> 'B', 'date', '2030-05-06', 'status', 'Present'));
  PERFORM public._rlstest_seed('attendance', 'lt-b2', jsonb_build_object('employee_id', emp ->> 'B', 'date', '2030-05-07', 'status', 'Absent'));
  PERFORM public._rlstest_seed('attendance', 'lt-b3', jsonb_build_object('employee_id', emp ->> 'B', 'date', '2030-05-08', 'status', 'Leave'));

  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.review_leave_request(%L, %L, NULL, true)', reqB, 'approved'));
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'refused over a Present day (even when replacing Absent)', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'Present conflict says it must be corrected', true, res LIKE '%MUST_CORRECT%');
  DELETE FROM public.attendance WHERE employee_id = emp ->> 'B' AND date = '2030-05-06';

  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.review_leave_request(%L, %L)', reqB, 'approved'));
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'refused over an Absent day by default', false, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'Absent-only conflict is replaceable', true, res LIKE '%ONLY_ABSENT%');
  SELECT id::text INTO absent_id FROM public.attendance WHERE employee_id = emp ->> 'B' AND date = '2030-05-07';

  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.review_leave_request(%L, %L, NULL, true)', reqB, 'approved'));
  INSERT INTO rls_results VALUES ('hr', 'review_leave_request', 'approved when replacing Absent', true, res LIKE 'ok:%');
  SELECT count(*) INTO n FROM public.attendance WHERE leave_request_id = reqB AND status = 'Leave';
  INSERT INTO rls_results VALUES ('hr', 'attendance', 'Absent replaced and manual Leave adopted (3 rows)', true, n = 3);
  SELECT taken INTO v FROM public.leave_balances WHERE employee_id = emp ->> 'B' AND leave_type_id = annual AND year = yr;
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'adopted days count towards taken (3)', true, v = 3);
  INSERT INTO rls_results VALUES ('hr', 'audit_log', 'the replaced Absent row is audited', true,
    EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'attendance.update' AND record_id = absent_id AND metadata -> 'changed_fields' ? 'status'));

  -- ── I. Requests change state only through the functions ──────────────────
  res := public._lt_as((u ->> 'staffA')::uuid, format(
    'INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date) VALUES (%L, %L, %L, %L)',
    emp ->> 'A', annual, '2030-09-02', '2030-09-03'));
  SELECT id INTO req3 FROM public.leave_requests WHERE employee_id = emp ->> 'A' AND start_date = '2030-09-02';
  res := public._lt_as((u ->> 'hr')::uuid, format('UPDATE public.leave_requests SET status = %L WHERE id = %L', 'approved', req3));
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'HR flips status by hand', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'hr')::uuid, format('DELETE FROM public.leave_requests WHERE id = %L', reqH));
  INSERT INTO rls_results VALUES ('hr', 'leave_requests', 'HR deletes approved leave', false, res LIKE 'ok:%' AND res <> 'ok:0');

  -- ── J. Opening a leave year ──────────────────────────────────────────────
  res := public._lt_as((u ->> 'staffA')::uuid, format('SELECT public.open_leave_year(%s)', yr));
  INSERT INTO rls_results VALUES ('staffA', 'open_leave_year', 'staff opens a year', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.open_leave_year(%s)', yr));
  INSERT INTO rls_results VALUES ('hr', 'open_leave_year', 'HR opens a year', true, res LIKE 'ok:%');
  SELECT count(*) INTO n FROM public.leave_balances WHERE year = yr;
  res := public._lt_as((u ->> 'hr')::uuid, format('SELECT public.open_leave_year(%s)', yr));
  INSERT INTO rls_results VALUES ('hr', 'open_leave_year', 'running it again changes nothing', true,
    (SELECT count(*) FROM public.leave_balances WHERE year = yr) = n);
  SELECT carried_forward INTO v FROM public.leave_balances WHERE employee_id = emp ->> 'C' AND leave_type_id = annual AND year = yr;
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'carry-forward capped at the limit (8 left, limit 5 -> 5)', true, v = 5);
  SELECT carried_forward INTO v FROM public.leave_balances WHERE employee_id = emp ->> 'D' AND leave_type_id = annual AND year = yr;
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'carry-forward below the limit (2 left -> 2)', true, v = 2);
  INSERT INTO rls_results VALUES ('hr', 'leave_balances', 'unpaid leave has no balance row', true,
    NOT EXISTS (SELECT 1 FROM public.leave_balances b JOIN public.leave_types t ON t.id = b.leave_type_id WHERE t.name = 'Unpaid' AND b.year = yr));

  -- ── K. Balances and types are HR-only to change ──────────────────────────
  res := public._lt_as((u ->> 'staffA')::uuid, format('UPDATE public.leave_balances SET entitled = 99 WHERE employee_id = %L AND year = %s', emp ->> 'A', yr));
  INSERT INTO rls_results VALUES ('staffA', 'leave_balances', 'staff edits a balance', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('UPDATE public.leave_types SET days_per_year = 99 WHERE id = %L', annual));
  INSERT INTO rls_results VALUES ('staffA', 'leave_types', 'staff edits a leave type', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, 'INSERT INTO public.public_holidays (holiday_date, name) VALUES (''2030-12-30'', ''x'')');
  INSERT INTO rls_results VALUES ('staffA', 'public_holidays', 'staff adds a holiday', false, res LIKE 'ok:%');
  res := public._lt_as((u ->> 'hr')::uuid, 'INSERT INTO public.public_holidays (holiday_date, name) VALUES (''2030-12-30'', ''Test holiday'')');
  INSERT INTO rls_results VALUES ('hr', 'public_holidays', 'HR adds a holiday', true, res LIKE 'ok:%');
  INSERT INTO rls_results VALUES ('staffA', 'leave_types', 'staff can read the types', true,
    public._lt_as((u ->> 'staffA')::uuid, 'SELECT * FROM public.leave_types') LIKE 'ok:%' AND public._lt_as((u ->> 'staffA')::uuid, 'SELECT * FROM public.leave_types') <> 'ok:0');

  -- ── L. Notifications are private ─────────────────────────────────────────
  res := public._lt_as((u ->> 'staffB')::uuid, format('SELECT * FROM public.hr_notifications WHERE recipient_id = %L', u ->> 'staffA'));
  INSERT INTO rls_results VALUES ('staffB', 'hr_notifications', 'reads someone else''s notifications', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('UPDATE public.hr_notifications SET title = %L WHERE recipient_id = %L', 'forged', u ->> 'staffA'));
  INSERT INTO rls_results VALUES ('staffA', 'hr_notifications', 'rewrites a notification', false, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('UPDATE public.hr_notifications SET read_at = now() WHERE recipient_id = %L', u ->> 'staffA'));
  INSERT INTO rls_results VALUES ('staffA', 'hr_notifications', 'marks own notifications read', true, res LIKE 'ok:%' AND res <> 'ok:0');
  res := public._lt_as((u ->> 'staffA')::uuid, format('INSERT INTO public.hr_notifications (recipient_id, type, title) VALUES (%L, %L, %L)', u ->> 'staffA', 'x', 'forged'));
  INSERT INTO rls_results VALUES ('staffA', 'hr_notifications', 'inserts a notification directly', false, res LIKE 'ok:%');

  -- ── M. Attachments are private ───────────────────────────────────────────
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('leave-attachments', (u ->> 'staffA') || '/lt-test.pdf');
    res := public._lt_as((u ->> 'staffA')::uuid, 'SELECT * FROM storage.objects WHERE bucket_id = ''leave-attachments''');
    INSERT INTO rls_results VALUES ('staffA', 'storage.objects', 'reads own document', true, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'staffB')::uuid, 'SELECT * FROM storage.objects WHERE bucket_id = ''leave-attachments''');
    INSERT INTO rls_results VALUES ('staffB', 'storage.objects', 'reads another person''s document', false, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'hr')::uuid, 'SELECT * FROM storage.objects WHERE bucket_id = ''leave-attachments''');
    INSERT INTO rls_results VALUES ('hr', 'storage.objects', 'HR reads the document', true, res LIKE 'ok:%' AND res <> 'ok:0');
    res := public._lt_as((u ->> 'staffB')::uuid, format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'leave-attachments', (u ->> 'staffA') || '/forged.pdf'));
    INSERT INTO rls_results VALUES ('staffB', 'storage.objects', 'uploads into someone else''s folder', false, res LIKE 'ok:%');
    res := public._lt_as((u ->> 'staffB')::uuid, format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'leave-attachments', (u ->> 'staffB') || '/mine.pdf'));
    INSERT INTO rls_results VALUES ('staffB', 'storage.objects', 'uploads into own folder', true, res LIKE 'ok:%');
    INSERT INTO rls_results VALUES ('system', 'storage.buckets', 'bucket is private', true,
      EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'leave-attachments' AND public = false));
  EXCEPTION WHEN insufficient_privilege THEN
    notes := notes || 'storage checks skipped (the postgres role cannot write storage.objects here)';
  END;

  -- ── Verdict (always an exception, so everything above is rolled back) ────
  SELECT count(*) INTO checks FROM rls_results;
  SELECT count(*) INTO failures FROM rls_results WHERE expected IS DISTINCT FROM actual;
  IF failures > 0 THEN
    RAISE EXCEPTION 'FAIL: % of % checks failed. Failures: % %', failures, checks,
      (SELECT string_agg(who || '/' || tbl || '/' || op || ': expected ' || expected || ' got ' || actual, E'
' ORDER BY tbl, who, op) FROM rls_results WHERE expected IS DISTINCT FROM actual),
      array_to_string(notes, '; ');
  END IF;
  RAISE EXCEPTION 'PASS: all % leave checks passed. % This error is intentional: it rolls everything back.', checks, array_to_string(notes, '; ');
END
$test$;
