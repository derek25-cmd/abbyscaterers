-- HR & Operations go-live: remove the UAT test data (runbook steps 7 and 8).
--
-- Run in the Supabase SQL editor, ONE PART AT A TIME. The SQL editor runs as
-- the database owner, which is allowed to call cleanup_uat_data(); signed-in
-- app users are not. (scripts/cleanup-uat.js does the same with the service
-- role key and also removes the files.)
--
-- What counts as test data: employees with ids UAT-... or first names starting
-- "UAT ", candidates named "UAT ...", logins whose email contains "+uat-".
-- Real employees are never matched; the dry run lists every person it found so
-- you can check before removing anything.

-- ── Part 1 (runbook step 7): DRY RUN. Changes nothing. ─────────────────────
-- Read the result carefully:
--   employees / logins / candidates: every one must be test data.
--   other_tables: rows elsewhere pointing at UAT employees (e.g. payroll). They
--                 are removed too; if anything here surprises you, stop.
--   counters:     each reference counter goes back to the highest number used
--                 by a real letter ("to"), so real letters start at 0001.
SELECT jsonb_pretty(public.cleanup_uat_data(true)) AS dry_run;


-- ── Part 2 (runbook step 8): REMOVE. One transaction: all or nothing. ──────
-- Only after the dry run looked right. Uncomment and run.
-- SELECT jsonb_pretty(public.cleanup_uat_data(false)) AS removed;


-- ── Part 3: the files ──────────────────────────────────────────────────────
-- Supabase does not allow deleting stored files with SQL. The list of files is
-- saved in the 'uat.cleanup' Audit Trail entry; remove them with:
--     node scripts/cleanup-uat.js --files-from-audit
-- To see the list here:
-- SELECT created_at, jsonb_array_length(metadata -> 'files') AS files, metadata -> 'removed' AS removed
--   FROM public.audit_log WHERE action = 'uat.cleanup' ORDER BY created_at DESC LIMIT 1;


-- ── Part 4: confirm ────────────────────────────────────────────────────────
-- Run docs/hr-ops/postflight.sql: every "UAT data" row must be PASS.
