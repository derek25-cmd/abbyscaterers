-- HR & Operations go-live: PREFLIGHT. READ-ONLY, safe to run on the live database.
--
-- Paste the whole file into the Supabase SQL editor and run it. It runs inside
-- a READ ONLY transaction (any write would fail) and ends with ROLLBACK.
-- One result table: each row is a check with PASS, FAIL or INFO and a one-line
-- reason. INFO rows are lists to read, not problems.
--
-- Before go-live, expect FAIL on the DRAFT templates and maybe the company
-- details: those are runbook steps 11 and 12. Everything else should PASS.

BEGIN READ ONLY;

WITH
emp AS (SELECT id, "firstName", "lastName", status FROM public.employees),
staff AS (SELECT id, email, role, is_active, employee_id FROM public.staff_users),
settings AS (SELECT to_jsonb(s) AS j FROM public.app_settings s WHERE s.id = true),
hr_tables(t) AS (VALUES
  ('employees'), ('attendance'), ('positions'), ('training_participants'), ('training_evaluations'), ('payroll'),
  ('products'), ('stock_logs'), ('assets'), ('issuance'),
  ('staff_users'), ('audit_log'), ('app_settings'),
  ('leave_types'), ('leave_settings'), ('public_holidays'), ('leave_requests'), ('leave_balances'), ('hr_notifications'),
  ('hr_document_types'), ('hr_document_templates'), ('hr_documents'), ('hr_document_counters'),
  ('candidates'), ('employment_contracts'), ('disciplinary_records'), ('recognition_records'), ('contract_expiry_notices')),
objects(n, phase, label, ok) AS (VALUES
  (1, 'Phase 1', 'roles (staff_users_role_check_v2)',  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_users_role_check_v2')),
  (1, 'Phase 1', 'can_manage_hr()',                     to_regprocedure('public.can_manage_hr()') IS NOT NULL),
  (1, 'Phase 1', 'get_employee_directory()',            to_regprocedure('public.get_employee_directory()') IS NOT NULL),
  (1, 'Phase 1', 'audit_row_change()',                  to_regprocedure('public.audit_row_change()') IS NOT NULL),
  (1, 'Phase 2', 'staff_users.employee_id',             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_users' AND column_name = 'employee_id')),
  (1, 'Phase 2', 'leave tables and review_leave_request()', to_regclass('public.leave_balances') IS NOT NULL AND to_regprocedure('public.review_leave_request(uuid,text,text,boolean)') IS NOT NULL),
  (1, 'Phase 2', 'hr_notifications',                    to_regclass('public.hr_notifications') IS NOT NULL),
  (1, 'Phase 3', 'company details on app_settings',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'company_name')),
  (1, 'Phase 3', 'hr_documents and issue_hr_document()', to_regclass('public.hr_documents') IS NOT NULL AND to_regprocedure('public.issue_hr_document(uuid,text,text)') IS NOT NULL),
  (1, 'Phase 4', 'employment_contracts and run_contract_expiry_job()', to_regclass('public.employment_contracts') IS NOT NULL AND to_regprocedure('public.run_contract_expiry_job(date)') IS NOT NULL),
  (1, 'Phase 4', 'expire_offers(date) (no old no-argument copy)', to_regprocedure('public.expire_offers(date)') IS NOT NULL AND to_regprocedure('public.expire_offers()') IS NULL),
  (1, 'Phase 5', 'HR module switch (app_settings.hr_modules)', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'hr_modules')),
  (1, 'Phase 5', 'opening leave balances (set_opening_leave_taken)', to_regprocedure('public.set_opening_leave_taken(text,uuid,integer,numeric)') IS NOT NULL),
  (1, 'Phase 5', 'importers (import_legacy_contracts, import_opening_leave)', to_regprocedure('public.import_legacy_contracts(jsonb)') IS NOT NULL AND to_regprocedure('public.import_opening_leave(jsonb)') IS NOT NULL),
  (1, 'Phase 5', 'UAT cleanup (cleanup_uat_data)',      to_regprocedure('public.cleanup_uat_data(boolean)') IS NOT NULL))
SELECT n, section, item, status, reason FROM (

  -- 1. Which migrations are applied (by their objects: the SQL editor keeps no history)
  SELECT n, 'Migrations' AS section, phase || ': ' || label AS item,
         CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS status,
         CASE WHEN ok THEN 'present' ELSE 'missing: apply this phase''s migrations' END AS reason
    FROM objects

  -- 2. Every login with its role and active flag
  UNION ALL
  SELECT 2, 'Logins', s.email,
         CASE WHEN s.role IN ('admin', 'general_manager', 'hr_manager', 'finance', 'staff') THEN 'INFO' ELSE 'FAIL' END,
         format('role %s, %s, %s', s.role, CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END,
                CASE WHEN s.employee_id IS NULL THEN 'not linked to an employee' ELSE 'linked to ' || s.employee_id END)
    FROM staff s
  UNION ALL
  SELECT 2, 'Logins', 'second approver available',
         CASE WHEN (SELECT count(*) FROM staff WHERE is_active AND role IN ('admin', 'general_manager', 'hr_manager')) >= 2 THEN 'PASS' ELSE 'FAIL' END,
         format('%s active Admin/HR Manager/GM login(s); termination and warning letters need two different people',
                (SELECT count(*) FROM staff WHERE is_active AND role IN ('admin', 'general_manager', 'hr_manager')))

  -- 3. Active employees with no login, and logins with no employee
  UNION ALL
  SELECT 3, 'Links', 'active employees with no login', 'INFO',
         format('%s of %s active employees (normal for staff who never sign in)',
                (SELECT count(*) FROM emp e WHERE e.status = 'Active' AND NOT EXISTS (SELECT 1 FROM staff s WHERE s.employee_id = e.id)),
                (SELECT count(*) FROM emp WHERE status = 'Active'))
  UNION ALL
  SELECT 3, 'Links', 'login without employee: ' || s.email,
         'INFO', 'cannot apply for their own leave until linked (runbook step 10)'
    FROM staff s WHERE s.is_active AND s.employee_id IS NULL

  -- 4. Key column types
  UNION ALL
  SELECT 4, 'Types', c.table_name || '.' || c.column_name,
         CASE WHEN c.data_type = 'text' THEN 'PASS' ELSE 'FAIL' END,
         'type ' || c.data_type || ' (the HR tables reference it as text)'
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.column_name = 'id' AND c.table_name IN ('payroll', 'employees')

  -- 5. One attendance row per employee per day (leave approval relies on it)
  UNION ALL
  SELECT 5, 'Constraints', 'attendance_employee_id_date_key',
         CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_employee_id_date_key') THEN 'PASS' ELSE 'FAIL' END,
         'UNIQUE (employee_id, date) on attendance'

  -- 6. Open policies left on HR/Ops tables
  UNION ALL
  SELECT 6, 'Policies', p.tablename || ': ' || p.policyname, 'FAIL',
         format('%s policy with USING/WITH CHECK (true): anyone signed in passes it', p.cmd)
    FROM pg_policies p JOIN hr_tables h ON h.t = p.tablename
   WHERE p.schemaname = 'public' AND (trim(p.qual) = 'true' OR trim(p.with_check) = 'true')
  UNION ALL
  SELECT 6, 'Policies', 'no USING (true) policies on HR/Ops tables', 'PASS', 'none found'
   WHERE NOT EXISTS (SELECT 1 FROM pg_policies p JOIN hr_tables h ON h.t = p.tablename
                      WHERE p.schemaname = 'public' AND (trim(p.qual) = 'true' OR trim(p.with_check) = 'true'))

  -- 7. Company details printed on letters
  UNION ALL
  SELECT 7, 'Company details', f.label,
         CASE WHEN nullif(trim(settings.j ->> f.col), '') IS NOT NULL THEN 'PASS'
              WHEN f.required THEN 'FAIL' ELSE 'INFO' END,
         CASE WHEN nullif(trim(settings.j ->> f.col), '') IS NOT NULL THEN 'filled'
              WHEN f.required THEN 'empty: fill in Settings → General (runbook step 11)'
              ELSE 'empty (optional; left off letters)' END
    FROM settings, (VALUES ('company_name', 'company name', true), ('company_address', 'company address', true),
                           ('company_tin', 'TIN', true), ('company_vrn', 'VRN', false),
                           ('company_phone', 'phone', false), ('company_email', 'email', false)) AS f(col, label, required)

  -- 8. Templates still on DRAFT wording (letters of that type cannot be issued)
  UNION ALL
  SELECT 8, 'Templates', t.doc_type || ' (version ' || t.version || ')', 'FAIL',
         'active template still has the DRAFT line: HR Manager replaces it (runbook step 11)'
    FROM public.hr_document_templates t
   WHERE t.is_active AND position('DRAFT TEMPLATE — HR Manager to replace this wording before use.' IN t.body) > 0
  UNION ALL
  SELECT 8, 'Templates', 'no active template on DRAFT wording', 'PASS', 'all active templates have final wording'
   WHERE NOT EXISTS (SELECT 1 FROM public.hr_document_templates t
                      WHERE t.is_active AND position('DRAFT TEMPLATE — HR Manager to replace this wording before use.' IN t.body) > 0)

  -- 9. Active employees without any contract record
  UNION ALL
  SELECT 9, 'Contracts', 'active employees with no contract record', 'INFO',
         format('%s (record their existing contracts with the importer, runbook step 12)',
                (SELECT count(*) FROM emp e WHERE e.status = 'Active' AND e.id NOT LIKE 'UAT-%'
                    AND NOT EXISTS (SELECT 1 FROM public.employment_contracts c WHERE c.employee_id = e.id AND c.status <> 'void')))

  -- 10. Test data present (expected during UAT, must be zero at go-live)
  UNION ALL
  SELECT 10, 'UAT data', 'UAT employees and logins', 'INFO',
         format('%s UAT employee(s), %s UAT login(s)',
                (SELECT count(*) FROM emp WHERE id LIKE 'UAT-%' OR "firstName" LIKE 'UAT %' OR "firstName" = 'UAT'),
                (SELECT count(*) FROM staff WHERE email ILIKE '%+uat-%'))
) r
ORDER BY n, section, item;

ROLLBACK;
