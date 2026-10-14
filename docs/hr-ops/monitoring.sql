-- HR & Operations: daily check for the first weeks after go-live.
-- READ-ONLY, safe on the live database. Paste the whole file into the SQL
-- editor each morning. One result table, newest problems first in each section:
--   ATTENTION = someone should act today; OK = nothing to do; INFO = for reading.
--
-- Refused actions (permission denied) are not stored in the database: they are
-- reported to Sentry. In Sentry, filter on  kind:permission_denied  (tags role,
-- target, method; the page is in "extra"). A burst for one role and target
-- usually means a missing permission or a confusing screen.

BEGIN READ ONLY;

WITH
since AS (SELECT now() - interval '24 hours' AS t),
stuck AS (   -- reference number reserved, but the letter was never issued ("Issue incomplete")
  SELECT d.ref_no, d.subject, d.approved_at
    FROM public.hr_documents d
   WHERE d.status = 'approved' AND d.ref_no IS NOT NULL AND d.approved_at < now() - interval '1 hour'),
waiting_leave AS (
  SELECT r.id, r.employee_id, r.start_date, r.created_at
    FROM public.leave_requests r
   WHERE r.status = 'pending' AND r.created_at < now() - interval '3 days'),
waiting_docs AS (
  SELECT d.subject, d.doc_type, d.created_at
    FROM public.hr_documents d
   WHERE d.status = 'pending_approval' AND d.created_at < now() - interval '2 days'),
cron_failed AS (
  SELECT CASE WHEN to_regclass('cron.job_run_details') IS NULL THEN NULL
              ELSE (xpath('/row/c/text()', query_to_xml(
                     'SELECT count(*) AS c FROM cron.job_run_details WHERE status <> ''succeeded'' AND start_time > now() - interval ''24 hours''',
                     false, true, '')))[1]::text::int END AS n),
cron_ran AS (
  SELECT CASE WHEN to_regclass('cron.job_run_details') IS NULL THEN NULL
              ELSE (xpath('/row/c/text()', query_to_xml(
                     'SELECT count(*) AS c FROM cron.job_run_details d JOIN cron.job j USING (jobid) WHERE j.jobname = ''hr-contract-expiry'' AND d.start_time > now() - interval ''26 hours''',
                     false, true, '')))[1]::text::int END AS n),
http_bad AS (   -- answers from the app to the scheduled calls (pg_net keeps them about 6 hours)
  SELECT CASE WHEN to_regclass('net._http_response') IS NULL THEN NULL
              ELSE (xpath('/row/c/text()', query_to_xml(
                     'SELECT count(*) AS c FROM net._http_response WHERE (status_code IS DISTINCT FROM 200 OR error_msg IS NOT NULL) AND created > now() - interval ''24 hours''',
                     false, true, '')))[1]::text::int END AS n)
SELECT n, section, status, detail FROM (

  -- 1. Refused actions
  SELECT 1 AS n, 'Refused actions' AS section, 'INFO' AS status,
         'Not stored in the database: see Sentry, filter kind:permission_denied (last 24 hours).' AS detail

  -- 2. Letters stuck in "Issue incomplete"
  UNION ALL
  SELECT 2, 'Issue incomplete', 'ATTENTION',
         format('%s "%s": approved %s ago and numbered, but not issued. Open it in HR Documents and press Issue again.',
                s.ref_no, s.subject, date_trunc('minute', now() - s.approved_at))
    FROM stuck s
  UNION ALL
  SELECT 2, 'Issue incomplete', 'OK', 'no letter is stuck between reserving a number and issuing'
   WHERE NOT EXISTS (SELECT 1 FROM stuck)

  -- 3. Leave waiting more than 3 days
  UNION ALL
  SELECT 3, 'Leave pending > 3 days', 'ATTENTION',
         format('%s: %s leave from %s, waiting since %s', public.hr_employee_name(w.employee_id),
                (SELECT lt.name FROM public.leave_requests r JOIN public.leave_types lt ON lt.id = r.leave_type_id WHERE r.id = w.id),
                w.start_date, to_char(w.created_at AT TIME ZONE 'Africa/Dar_es_Salaam', 'DD Mon HH24:MI'))
    FROM waiting_leave w
  UNION ALL
  SELECT 3, 'Leave pending > 3 days', 'OK', 'no request has waited more than 3 days'
   WHERE NOT EXISTS (SELECT 1 FROM waiting_leave)

  -- 4. Letters waiting for approval, written more than 2 days ago
  UNION ALL
  SELECT 4, 'Letters awaiting approval > 2 days', 'ATTENTION',
         format('%s: "%s", written %s', w.doc_type, w.subject, to_char(w.created_at AT TIME ZONE 'Africa/Dar_es_Salaam', 'DD Mon HH24:MI'))
    FROM waiting_docs w
  UNION ALL
  SELECT 4, 'Letters awaiting approval > 2 days', 'OK', 'none'
   WHERE NOT EXISTS (SELECT 1 FROM waiting_docs)

  -- 5. Contract reminders sent in the last 24 hours
  UNION ALL
  SELECT 5, 'Reminders sent (24h)', 'INFO',
         format('%s: %s', public.hr_employee_name(c.employee_id),
                CASE WHEN x.threshold_days = 0 THEN 'contract overdue (now expired)' ELSE x.threshold_days || ' days before the end' END)
    FROM public.contract_expiry_notices x JOIN public.employment_contracts c ON c.id = x.contract_id, since
   WHERE x.sent_at > since.t
  UNION ALL
  SELECT 5, 'Reminders sent (24h)', 'INFO', 'none sent'
   WHERE NOT EXISTS (SELECT 1 FROM public.contract_expiry_notices, since WHERE sent_at > since.t)

  -- 6. Scheduled jobs
  UNION ALL
  SELECT 6, 'Scheduled jobs', CASE WHEN r.n IS NULL THEN 'ATTENTION' WHEN r.n = 0 THEN 'ATTENTION' ELSE 'OK' END,
         CASE WHEN r.n IS NULL THEN 'pg_cron is not switched on: the daily contract job is not running'
              WHEN r.n = 0 THEN 'the daily contract job (hr-contract-expiry) did not run in the last 26 hours'
              ELSE 'the daily contract job ran' END
    FROM cron_ran r
  UNION ALL
  SELECT 6, 'Scheduled jobs', CASE WHEN coalesce(f.n, 0) > 0 THEN 'ATTENTION' ELSE 'OK' END,
         coalesce(f.n, 0) || ' failed pg_cron run(s) in 24h (see cron.job_run_details)'
    FROM cron_failed f
  UNION ALL
  SELECT 6, 'Scheduled jobs', CASE WHEN coalesce(h.n, 0) > 0 THEN 'ATTENTION' ELSE 'OK' END,
         coalesce(h.n, 0) || ' call(s) where the app did not answer 200 (see net._http_response; kept ~6h)'
    FROM http_bad h

  -- 7. Activity (for reading)
  UNION ALL
  SELECT 7, 'Activity (24h)', 'INFO',
         format('%s leave request(s) filed, %s decided; %s letter(s) issued, %s voided; %s audit entries',
                (SELECT count(*) FROM public.leave_requests, since WHERE created_at > since.t),
                (SELECT count(*) FROM public.leave_requests, since WHERE decided_at > since.t),
                (SELECT count(*) FROM public.hr_documents, since WHERE issued_at > since.t),
                (SELECT count(*) FROM public.hr_documents, since WHERE voided_at > since.t),
                (SELECT count(*) FROM public.audit_log, since WHERE created_at > since.t))
  UNION ALL
  SELECT 7, 'Activity (24h)', 'INFO', format('%s contract(s) end in the next 7 days',
         (SELECT count(*) FROM public.employment_contracts WHERE status = 'active' AND end_date BETWEEN public.hr_today() AND public.hr_today() + 7))
) r
ORDER BY n, status, detail;

ROLLBACK;
