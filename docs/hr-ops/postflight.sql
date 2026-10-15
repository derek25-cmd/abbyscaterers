-- HR & Operations go-live: POSTFLIGHT. READ-ONLY, safe to run on the live database.
--
-- Run it after applying migrations, and again after the UAT cleanup (runbook
-- step 9). Paste the whole file into the Supabase SQL editor. It runs inside a
-- READ ONLY transaction and ends with ROLLBACK.
-- One result table: every row is PASS or FAIL (or INFO) with a one-line reason.
-- Stop and investigate on any FAIL.

BEGIN READ ONLY;

WITH
fn(name, sig) AS (VALUES
  -- Phase 1
  ('has_staff_role', 'public.has_staff_role(text[])'), ('can_manage_hr', 'public.can_manage_hr()'),
  ('can_manage_ops', 'public.can_manage_ops()'), ('can_manage_settings', 'public.can_manage_settings()'),
  ('get_employee_directory', 'public.get_employee_directory()'), ('audit_row_change', 'public.audit_row_change()'),
  -- Phase 2
  ('current_employee_id', 'public.current_employee_id()'),
  ('review_leave_request', 'public.review_leave_request(uuid,text,text,boolean)'),
  ('cancel_leave_request', 'public.cancel_leave_request(uuid,text)'), ('open_leave_year', 'public.open_leave_year(integer)'),
  ('leave_working_days', 'public.leave_working_days(date,date)'), ('notify_hr_roles', 'public.notify_hr_roles(text,text,text,text)'),
  -- Phase 3
  ('submit_hr_document', 'public.submit_hr_document(uuid)'), ('approve_hr_document', 'public.approve_hr_document(uuid)'),
  ('return_hr_document', 'public.return_hr_document(uuid,text)'), ('reserve_hr_document_ref', 'public.reserve_hr_document_ref(uuid)'),
  ('issue_hr_document', 'public.issue_hr_document(uuid,text,text)'), ('void_hr_document', 'public.void_hr_document(uuid,text)'),
  ('save_hr_template_version', 'public.save_hr_template_version(text,text,text,boolean)'),
  -- Phase 4
  ('validate_hr_document', 'public.validate_hr_document(uuid)'),
  ('end_employment_without_letter', 'public.end_employment_without_letter(text,date,text)'),
  ('respond_to_offer', 'public.respond_to_offer(uuid,text,date)'), ('expire_offers', 'public.expire_offers(date)'),
  ('record_legacy_contract', 'public.record_legacy_contract(text,text,date,date,text,numeric,integer,integer,text)'),
  ('pending_cash_rewards', 'public.pending_cash_rewards()'), ('mark_recognition_paid', 'public.mark_recognition_paid(uuid,text)'),
  ('run_contract_expiry_job', 'public.run_contract_expiry_job(date)'),
  -- Phase 5
  ('set_hr_modules', 'public.set_hr_modules(text[])'),
  ('set_opening_leave_taken', 'public.set_opening_leave_taken(text,uuid,integer,numeric)'),
  ('import_legacy_contracts', 'public.import_legacy_contracts(jsonb)'), ('import_opening_leave', 'public.import_opening_leave(jsonb)'),
  ('cleanup_uat_data', 'public.cleanup_uat_data(boolean)'),
  -- Phase 6
  ('delete_employee', 'public.delete_employee(text)'), ('employee_history', 'public.employee_history(text)'),
  ('portal_pending_hr_documents', 'public.portal_pending_hr_documents()'),
  ('portal_approve_hr_document', 'public.portal_approve_hr_document(uuid)'),
  ('portal_return_hr_document', 'public.portal_return_hr_document(uuid,text)')),
tbl(name) AS (VALUES
  ('staff_users'), ('audit_log'), ('leave_types'), ('leave_settings'), ('public_holidays'), ('leave_requests'),
  ('leave_balances'), ('hr_notifications'), ('hr_document_types'), ('hr_document_templates'), ('hr_documents'),
  ('hr_document_counters'), ('candidates'), ('employment_contracts'), ('disciplinary_records'),
  ('recognition_records'), ('contract_expiry_notices')),
pol(tab, name) AS (VALUES
  ('payroll', 'portal_read_payroll'), ('attendance', 'portal_read_attendance'),
  ('audit_log', 'audit_log_select_hr'),
  ('leave_requests', 'leave_requests_select'), ('leave_requests', 'leave_requests_insert'), ('leave_balances', 'leave_balances_select'),
  ('candidates', 'candidates_hr_select'), ('employment_contracts', 'employment_contracts_hr_select'),
  ('disciplinary_records', 'disciplinary_records_hr_select'), ('recognition_records', 'recognition_records_hr_select'),
  ('contract_expiry_notices', 'contract_expiry_notices_hr_select'),
  ('objects', 'hr_documents_storage_insert'), ('objects', 'hr_documents_storage_select'),
  ('objects', 'leave_attachments_insert'), ('objects', 'leave_attachments_select')),
trg(tab, name) AS (VALUES
  ('employees', 'audit_row_change'), ('employees', 'employees_status_guard'), ('attendance', 'attendance_leave_guard'),
  ('leave_requests', 'leave_request_before_insert'), ('leave_requests', 'leave_request_guard'), ('leave_requests', 'audit_row_change'),
  ('leave_balances', 'audit_row_change'), ('leave_balances', 'leave_balances_opening_guard'),
  ('hr_documents', 'hr_documents_guard'), ('hr_documents', 'audit_row_change'), ('hr_document_templates', 'hr_document_templates_guard'),
  ('candidates', 'candidates_guard'), ('employment_contracts', 'audit_row_change'), ('disciplinary_records', 'audit_row_change'),
  ('recognition_records', 'audit_row_change'), ('app_settings', 'guard_company_settings'), ('app_settings', 'guard_hr_settings'),
  ('hr_notifications', 'hr_notifications_only_read'),
  -- Phase 6: someone who has left is frozen; employees deleted only via delete_employee()
  ('employees', 'employees_delete_guard'), ('leave_requests', 'hr_refuse_if_employee_inactive'),
  ('attendance', 'hr_refuse_if_employee_inactive'), ('hr_documents', 'hr_refuse_if_employee_inactive'),
  ('payroll', 'hr_refuse_if_employee_inactive'), ('hr_documents', 'hr_documents_notify_portal'))
SELECT n, section, item, status, reason FROM (

  -- 1. Functions
  SELECT 1 AS n, 'Functions' AS section, f.name AS item,
         CASE WHEN to_regprocedure(f.sig) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
         CASE WHEN to_regprocedure(f.sig) IS NOT NULL THEN 'present' ELSE 'missing: ' || f.sig END AS reason
    FROM fn f
  UNION ALL
  SELECT 1, 'Functions', 'internal helpers not callable from the app',
         CASE WHEN to_regprocedure('public.cleanup_uat_data(boolean)') IS NULL THEN 'FAIL'
              WHEN NOT has_function_privilege('authenticated', 'public.hr_doc_apply_effects(public.hr_documents)', 'EXECUTE')
               AND NOT has_function_privilege('authenticated', 'public.hr_end_employment(text,date,text)', 'EXECUTE')
               AND NOT has_function_privilege('anon', 'public.cleanup_uat_data(boolean)', 'EXECUTE')
               AND NOT has_function_privilege('authenticated', 'public.cleanup_uat_data(boolean)', 'EXECUTE')
              THEN 'PASS' ELSE 'FAIL' END,
         'issue effects, end-employment core and UAT cleanup are closed to signed-in users'

  -- 2. Tables, with RLS on
  UNION ALL
  SELECT 2, 'Tables', t.name,
         CASE WHEN c.oid IS NULL THEN 'FAIL' WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN c.oid IS NULL THEN 'missing' WHEN c.relrowsecurity THEN 'present, row level security on' ELSE 'row level security is OFF' END
    FROM tbl t LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || t.name)
  UNION ALL
  SELECT 2, 'Tables', 'leave_balances.opening_taken',
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leave_balances' AND column_name = 'opening_taken') THEN 'PASS' ELSE 'FAIL' END,
         'opening balances column (Phase 5)'

  -- 3. Policies (the admin portal's two must survive)
  UNION ALL
  SELECT 3, 'Policies', p.tab || ': ' || p.name,
         CASE WHEN EXISTS (SELECT 1 FROM pg_policies x WHERE x.tablename = p.tab AND x.policyname = p.name) THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN EXISTS (SELECT 1 FROM pg_policies x WHERE x.tablename = p.tab AND x.policyname = p.name) THEN 'present'
              WHEN p.name LIKE 'portal_%' THEN 'missing: the admin portal payroll/attendance reports will break'
              ELSE 'missing' END
    FROM pol p

  -- 4. Triggers
  UNION ALL
  SELECT 4, 'Triggers', g.tab || ': ' || g.name,
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = to_regclass('public.' || g.tab) AND t.tgname = g.name AND NOT t.tgisinternal) THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = to_regclass('public.' || g.tab) AND t.tgname = g.name AND NOT t.tgisinternal) THEN 'present' ELSE 'missing' END
    FROM trg g

  -- 5. Storage buckets: present and private
  UNION ALL
  SELECT 5, 'Buckets', b.id,
         CASE WHEN s.id IS NULL THEN 'FAIL' WHEN s.public THEN 'FAIL' ELSE 'PASS' END,
         CASE WHEN s.id IS NULL THEN 'missing' WHEN s.public THEN 'is PUBLIC: files readable by anyone with the link' ELSE 'present, private' END
    FROM (VALUES ('hr-documents'), ('leave-attachments')) AS b(id) LEFT JOIN storage.buckets s ON s.id = b.id

  -- 6. Every active login has a valid role
  UNION ALL
  SELECT 6, 'Logins', 'every active login has a valid role',
         CASE WHEN NOT EXISTS (SELECT 1 FROM public.staff_users WHERE is_active AND role NOT IN ('admin', 'general_manager', 'hr_manager', 'finance', 'staff')) THEN 'PASS' ELSE 'FAIL' END,
         format('%s active login(s)', (SELECT count(*) FROM public.staff_users WHERE is_active))

  -- 7. Reference numbers can never be reused: each counter is at or above the highest number used
  UNION ALL
  SELECT 7, 'Reference numbers', c.doc_type || ' ' || c.year,
         CASE WHEN c.last_value >= coalesce(u.max_used, 0) THEN 'PASS' ELSE 'FAIL' END,
         format('counter at %s, highest number in use %s', c.last_value, coalesce(u.max_used, 0))
    FROM public.hr_document_counters c
    LEFT JOIN (SELECT d.doc_type, split_part(d.ref_no, '/', 4)::int AS year, max(substring(d.ref_no FROM '[0-9]+$')::int) AS max_used
                 FROM public.hr_documents d WHERE d.ref_no IS NOT NULL GROUP BY 1, 2) u
      ON u.doc_type = c.doc_type AND u.year = c.year
  UNION ALL
  SELECT 7, 'Reference numbers', 'counters', 'INFO', 'no numbers reserved yet (counters are created by the first letter of each type)'
   WHERE NOT EXISTS (SELECT 1 FROM public.hr_document_counters)

  -- 8. Leave balances for this year exist for every active employee
  UNION ALL
  SELECT 8, 'Leave balances', 'balances for ' || extract(year FROM now() AT TIME ZONE 'Africa/Dar_es_Salaam')::int,
         CASE WHEN missing = 0 THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN missing = 0 THEN 'every active employee has a balance for every tracked leave type'
              ELSE missing || ' missing: HR Manager → Leave → Balances → Set up <year> balances' END
    FROM (SELECT count(*) AS missing
            FROM public.employees e CROSS JOIN public.leave_types lt
           WHERE e.status = 'Active' AND lt.is_active AND lt.tracks_balance
             AND NOT EXISTS (SELECT 1 FROM public.leave_balances b
                              WHERE b.employee_id = e.id AND b.leave_type_id = lt.id
                                AND b.year = extract(year FROM now() AT TIME ZONE 'Africa/Dar_es_Salaam')::int)) m

  -- 9. No test data left (after the UAT cleanup)
  UNION ALL
  SELECT 9, 'UAT data', x.what,
         CASE WHEN x.cnt = 0 THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN x.cnt = 0 THEN 'none left' ELSE x.cnt || ' left: run the UAT cleanup (runbook steps 7-8)' END
    FROM (VALUES
      ('UAT employees', (SELECT count(*) FROM public.employees WHERE id LIKE 'UAT-%' OR "firstName" LIKE 'UAT %' OR "firstName" = 'UAT')),
      ('UAT logins', (SELECT count(*) FROM public.staff_users WHERE email ILIKE '%+uat-%')),
      ('UAT candidates', (SELECT count(*) FROM public.candidates WHERE full_name LIKE 'UAT %')),
      ('HR records of UAT employees', (SELECT count(*) FROM public.leave_requests WHERE employee_id LIKE 'UAT-%')
                                    + (SELECT count(*) FROM public.hr_documents WHERE employee_id LIKE 'UAT-%')
                                    + (SELECT count(*) FROM public.employment_contracts WHERE employee_id LIKE 'UAT-%'))
    ) AS x(what, cnt)

  -- 10. Switches and scheduled jobs
  UNION ALL
  SELECT 10, 'Settings', 'HR modules switched on', 'INFO',
         coalesce((SELECT to_jsonb(s) ->> 'hr_modules' FROM public.app_settings s WHERE s.id = true), 'all (not set)')
  UNION ALL
  SELECT 10, 'Settings', 'go-live date', 'INFO',
         coalesce((SELECT 'set: ' || (to_jsonb(s) ->> 'hr_go_live_at') FROM public.app_settings s WHERE s.id = true AND to_jsonb(s) ->> 'hr_go_live_at' IS NOT NULL),
                  'not set yet (runbook step 13)')
  UNION ALL
  SELECT 10, 'Scheduled jobs', j.job,
         CASE WHEN to_regclass('cron.job') IS NULL THEN 'FAIL'
              WHEN (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM cron.job WHERE jobname = %L AND active', j.job), false, true, '')))[1]::text::int > 0 THEN 'PASS'
              ELSE 'FAIL' END,
         CASE WHEN to_regclass('cron.job') IS NULL THEN 'pg_cron is not switched on (runbook step 3)'
              ELSE 'scheduled with pg_cron (missing = FAIL; see docs/hr-ops/crons.sql)' END
    FROM (VALUES ('hr-contract-expiry'), ('hr-leave-year-end')) AS j(job)
) r
ORDER BY n, section, item;

ROLLBACK;
