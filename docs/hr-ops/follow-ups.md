# Known follow-ups (not fixed in Phases 1–5)

Things found while building the HR & Operations module that should be fixed later. They are listed here and not changed, so go-live is not delayed and nothing outside the HR scope changes without a decision. Most important first.

## Security

### 1. `claim_ids()` can be called by anyone, with any counter name

- **Where:** `supabase/migrations/20260702100000_id_counters.sql`, line 54: `GRANT EXECUTE ON FUNCTION public.claim_ids(TEXT, INTEGER) TO authenticated, anon;`
- **Problem:** the function is `SECURITY DEFINER` and accepts any `counter_name` and any `count`. Anyone holding the public anon key, without signing in, can move any ID counter forward by an arbitrary amount (making order or delivery-note numbers jump), or create new counter rows.
- **Callers:**
  - `apps/catering-system/src/services/orderService.ts:76` (order / event ids)
  - `apps/catering-system/src/services/deliveryNoteService.ts:48`
  - `apps/catering-system/src/app/requests/page.tsx:261`
  - `apps/admin-portal/src/components/rfq/rfq-form.tsx:162` (portal users)
- **Suggested fix:** revoke from `anon`; check the counter name against a fixed list and cap `count` (e.g. 1–100); require `is_active_staff()` or `is_active_portal_user()`.

### 2. Any active staff member can change the app settings

- **Where:** `supabase/migrations/20260901160000_app_settings.sql`, policy `app_settings_write` (`USING (public.is_active_staff())`).
- **Problem:** every active login, including plain staff, can change the letterhead and footer images, signature, stamps, the next order / proforma / invoice numbers and the PDF scale. The company details (Phase 3) and the HR module switch and go-live date (Phase 5) are protected by their own triggers, but the rest of the row is not.
- **Suggested fix:** limit `app_settings_write` to `can_manage_settings()` (Admin), or guard the number fields and images the same way as `guard_company_settings`.

### 3. Operations tables are not locked; stock is changed from the browser

- **Where:** `supabase/migrations/20261014000200_hr_ops_rls.sql` (header comment: products, stock_logs, assets and issuance keep staff-wide write access). `apps/catering-system/src/services/issuanceService.ts:21-27`, where `addIssuance()` reads each asset's quantity and writes `quantity - quantityIssued` back from the client.
- **Problem:** any active staff member can edit or delete products, stock logs, assets and issuance records. The quantity update is a read-then-write in the browser: two issuances at the same time can lose one decrement, and a failed write after the issuance insert leaves stock wrong.
- **Suggested fix:** an `issue_assets()` RPC that inserts the issuance and decrements quantities in one transaction (with `quantity >= issued` checks); then apply the Phase 1 pattern to the Ops tables (anyone active inserts, `can_manage_ops()` edits and deletes).

## Deployment and scripts

### 4. `vercel.json` crons do not run on App Hosting

- **Where:** `vercel.json`. Production is Firebase App Hosting (backend `studio`), which ignores it.
- **Status:** the HR jobs are scheduled with pg_cron (`docs/hr-ops/crons.sql`). The non-HR **`/api/cron/marketing-performance`** job has not been running in production. `crons.sql` contains a commented-out schedule for it.
- **Suggested fix:** decide whether marketing-performance should run, schedule it the same way, then delete `vercel.json` (or keep it only as documentation of the schedules).

### 5. Hosting configuration is confusing

- **Where:** the root `apphosting.yaml` builds and runs **admin-portal**, the root `package.json` `build`/`start` scripts run **catering-system**, and `firebase.json` points Firebase Hosting at catering-system.
- **Problem:** it is not clear from the repository which App Hosting backend builds which app, or where the `studio` backend's environment variables live.
- **Suggested fix:** one `apphosting.yaml` per app folder (`apps/catering-system/apphosting.yaml` with its `env:` entries referencing Secret Manager), each backend's root directory set to its app, and the unused `firebase.json` hosting entry removed.

### 6. Duplicate migration versions

- **Where:** `supabase/migrations/20240801120000_add_bookings_and_daily_orders.sql`, `…_add_bookings_and_daily_orders_up.sql`, `…_create_bookings_tables.sql` (three files, one version), and `20260726010000_add_audit_log.sql` / `20260726010000_fix_function_search_path.sql` (two files, one version).
- **Problem:** the Supabase CLI keys migrations by version, so `migration list` / `db push` cannot track these reliably.
- **Suggested fix:** after `migration repair` (runbook 1d), give the extra files new, unused versions (contents unchanged) and repair those versions too.

### 7. The scripts' environment loading

- **Where:** `scripts/invite-staff.js` used `require('dotenv')`, which is not installed in the repository, so it could not start. Fixed in Phase 5 to use Node's own `.env` loader (as `setup-uat.js` and `cleanup-uat.js` do).
- **Remaining:** nothing in CI checks the scripts. Add a `node --check scripts/*.js` step to `.github/workflows/ci.yml`.

## HR module (by design for now; review after go-live)

### 8. Contract reminders fire on the exact day only

- **Where:** `contracts_due_for_reminder()` in `supabase/migrations/20261014001700_hr_letter_effects.sql`.
- **Problem:** the 60/30/7-day reminders are sent only when exactly that many days are left. If the job does not run on that day (outage, pg_cron off), that reminder is skipped; the overdue notice still comes.
- **Suggested fix:** send the highest threshold not yet sent whose day has passed (e.g. 29 days left and no 30-day notice yet → send it).

### 9. Voiding a recognition letter after the cash reward was paid

- **Where:** `hr_doc_void_effects()` in the same migration.
- **Behaviour:** the record is voided but stays "paid"; HR has to settle the money by hand. Consider a warning in the void dialog when the reward is already paid.

### 10. Notifications about UAT letters stay after the cleanup

- **Where:** `cleanup_uat_data()` (`supabase/migrations/20261014002100_uat_cleanup.sql`).
- **Behaviour:** notifications sent to real approvers during UAT ("Document waiting for approval: …") carry only the letter's subject, so they cannot be matched to UAT data and remain in those people's notification lists. They are harmless and can be marked read.

### 11. Letters are exported, not stored

- **Where:** `hr_documents.issued_content` (`supabase/migrations/20261016000000_hr_documents_export_not_stored.sql`).
- **Behaviour:** issuing saves the letter's final text; Export PDF builds the file in the browser, like invoices and delivery notes. The text is frozen, but the letterhead, signature and stamp come from the current settings, so an old letter exported after the stamp changes shows the new stamp. Files uploaded to the `hr-documents` bucket before this change are kept; nothing new is uploaded. Plan a retention rule (how many years to keep HR letters) with HR.

### 12. The module switch is read once per page load

- **Where:** `apps/catering-system/src/lib/hr-modules.ts`.
- **Behaviour:** when the Admin switches a module off, people already on a page keep seeing it until they reload or navigate. Acceptable for a safety switch; a realtime subscription on `app_settings` would make it instant.
