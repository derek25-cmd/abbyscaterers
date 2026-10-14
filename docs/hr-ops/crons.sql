-- HR & Operations: the daily jobs, scheduled in the database (runbook step 3).
--
-- The app runs on Firebase App Hosting, which does not read vercel.json, so the
-- jobs are scheduled with pg_cron and call the app's cron routes over HTTPS
-- with pg_net, sending CRON_SECRET (kept in Supabase Vault) as a Bearer token.
-- The routes check the token, use the service-role key on the server, and do
-- nothing (but answer 200) when their HR module is switched off.
--
-- Before running:
--   * Dashboard → Database → Extensions: switch on pg_cron (pg_net is already on).
--   * The app's environment must have CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY
--     (Firebase console → App Hosting → studio → environment / secrets).
-- Run the parts one at a time in the SQL editor.

-- ── Part 1: the secret ─────────────────────────────────────────────────────
-- Paste the SAME value as the app's CRON_SECRET between the quotes. It is
-- stored encrypted in Vault; do not save this file with the value in it.
SELECT vault.create_secret('<paste CRON_SECRET here>', 'hr_cron_secret', 'Bearer token for the HR cron routes');
-- To change it later:
-- SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'hr_cron_secret'), '<new value>');


-- ── Part 2: the schedules (times are UTC; Dar es Salaam is UTC+3) ──────────
-- Contract reminders, overdue contracts, offers and warnings: daily 04:00 UTC (07:00 Dar).
SELECT cron.schedule('hr-contract-expiry', '0 4 * * *', $job$
  SELECT net.http_get(
    url := 'https://studio--catersmart-client-manager.us-central1.hosted.app/api/cron/contract-expiry',
    headers := jsonb_build_object('Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hr_cron_secret')),
    timeout_milliseconds := 60000);
$job$);

-- Opens the new leave year: 1 January, 01:00 UTC.
SELECT cron.schedule('hr-leave-year-end', '0 1 1 1 *', $job$
  SELECT net.http_get(
    url := 'https://studio--catersmart-client-manager.us-central1.hosted.app/api/cron/leave-year-end',
    headers := jsonb_build_object('Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hr_cron_secret')),
    timeout_milliseconds := 60000);
$job$);

-- Optional, not HR: the marketing-performance job was also only in vercel.json,
-- so it has not been running on App Hosting either. Uncomment to schedule it
-- (daily 23:00 UTC), if it should run.
-- SELECT cron.schedule('marketing-performance', '0 23 * * *', $job$
--   SELECT net.http_get(
--     url := 'https://studio--catersmart-client-manager.us-central1.hosted.app/api/cron/marketing-performance',
--     headers := jsonb_build_object('Authorization',
--       'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hr_cron_secret')),
--     timeout_milliseconds := 60000);
-- $job$);


-- ── Part 3: run each job once by hand, and check it ────────────────────────
-- Calls the contract-expiry route now (the leave-year-end one only adds missing
-- balances, so running it by hand is harmless too: swap the URL).
SELECT net.http_get(
  url := 'https://studio--catersmart-client-manager.us-central1.hosted.app/api/cron/contract-expiry',
  headers := jsonb_build_object('Authorization',
    'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hr_cron_secret')),
  timeout_milliseconds := 60000) AS request_id;

-- A few seconds later: the answer. Expect status 200 and {"success":true,...}.
-- 401 = the secret in Vault differs from the app's CRON_SECRET.
-- 500 with "SUPABASE_SERVICE_ROLE_KEY is not configured" = set it in App Hosting.
SELECT id, status_code, content::text AS body, error_msg, created
  FROM net._http_response ORDER BY created DESC LIMIT 5;


-- ── Part 4: what is scheduled, and how the runs went ───────────────────────
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
SELECT j.jobname, d.status, d.return_message, d.start_time
  FROM cron.job_run_details d JOIN cron.job j USING (jobid)
 ORDER BY d.start_time DESC LIMIT 20;
-- pg_cron's "succeeded" only means the HTTP request was sent; the app's answer
-- is in net._http_response (Part 3), kept for about 6 hours.

-- To stop a job:   SELECT cron.unschedule('hr-contract-expiry');
