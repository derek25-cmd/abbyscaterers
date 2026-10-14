# HR & Operations — go-live runbook

**Who runs this:** the system owner (Derek). Every step that touches the live database is done by you, by hand, in the order below. Nothing here is run automatically.

**Where:** the main Supabase project `enpcjcesyvjqugnxdslp` (there is no separate staging) and the app on Firebase App Hosting, backend `studio`: <https://studio--catersmart-client-manager.us-central1.hosted.app>.

**How SQL is run:** paste it into the Supabase SQL editor (Dashboard → SQL Editor → New query) and press Run. The editor shows only the **last** result, so run multi-part files one part at a time.

**Never:** run `supabase db push` on this project (see 1c), or put a password or key in any file you save.

Files referred to below are in the repository:

| File | What it is |
|---|---|
| `docs/hr-ops/preflight.sql` | read-only checks before UAT |
| `docs/hr-ops/postflight.sql` | read-only checks after migrations and after the cleanup |
| `docs/hr-ops/crons.sql` | schedules the daily jobs |
| `docs/hr-ops/cleanup-uat.sql` | removes the UAT test data |
| `docs/hr-ops/monitoring.sql` | daily read-only checks for the first weeks |
| `docs/hr-ops/uat-checklist.md` | the UAT test script and sign-off |
| `scripts/setup-uat.js`, `scripts/cleanup-uat.js` | create / remove the UAT data (run on your own machine) |
| `supabase/migrations/20261014001900_…`, `…002000_…`, `…002100_…` | the three Phase 5 migrations |

---

## Step 1 — Backup (before any UAT data exists)

### 1a. Database dump

You need the PostgreSQL client tools (`pg_dump`, version 17 or newer; on Windows: the "Command Line Tools" option of the PostgreSQL installer). Get the connection string from Dashboard → **Connect** → *Session pooler*. It looks like `postgresql://postgres.enpcjcesyvjqugnxdslp:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`.

In a terminal (PowerShell shown; type the password when asked rather than putting it in the command):

```powershell
$env:DB_URL = "postgresql://postgres.enpcjcesyvjqugnxdslp@aws-0-<region>.pooler.supabase.com:5432/postgres"
$stamp = Get-Date -Format "yyyyMMdd-HHmm"

# Everything in the public schema: tables, functions, policies and all data.
pg_dump $env:DB_URL --schema=public --no-owner --no-privileges --format=custom --file="hr-golive-public-$stamp.dump"

# The logins (auth.users), so they can be restored together with staff_users.
pg_dump $env:DB_URL --schema=auth --data-only --table=auth.users --table=auth.identities --format=custom --file="hr-golive-auth-$stamp.dump"

# Check both files are readable (prints the table of contents):
pg_restore --list "hr-golive-public-$stamp.dump" | Select-Object -First 20
```

Keep both files somewhere safe and off this computer (they contain salaries and personal data).

Also note the time, and check Dashboard → Database → **Backups**: the daily automatic backup (and point-in-time recovery, if your plan has it) is a second safety net.

### 1b. Storage

`pg_dump` copies the *list* of stored files, not the files. Download the buckets that matter, from Dashboard → Storage, or with the Supabase CLI:

```powershell
supabase storage cp -r ss:///hr-documents ./backup/hr-documents --experimental --linked
supabase storage cp -r ss:///leave-attachments ./backup/leave-attachments --experimental --linked
```

(Before go-live `hr-documents` holds only test letters; this matters most for later backups.)

### 1c. Apply the three Phase 5 migrations

In the SQL editor, paste and run each file **in this order**, one at a time, and wait for "Success":

1. `supabase/migrations/20261014001900_hr_go_live_settings.sql`
2. `supabase/migrations/20261014002000_hr_imports.sql`
3. `supabase/migrations/20261014002100_uat_cleanup.sql`

### 1d. Record the migration history (optional, recommended)

This project has no migration history table (`supabase_migrations.schema_migrations` does not exist): every migration was pasted into the SQL editor. That is why `supabase db push` must not be used here: it would think nothing has been applied and try to run all 89 files again.

To let the Supabase CLI work safely in future, record every file as already applied. On your own machine, in the repository folder:

```powershell
supabase init            # only if supabase/config.toml does not exist yet; answer "N" to the questions
supabase link --project-ref enpcjcesyvjqugnxdslp
supabase migration repair --status applied `
  20240730120000 20240731000002 20240731000003 20240731093126 20240731093437 20240731102213 `
  20240801120000 20240802000000 20260409000000 20260529124000 20260620120000 20260620130000 `
  20260620140000 20260620150000 20260620160000 20260621000000 20260621100000 20260623120000 `
  20260623130000 20260623140000 20260623150000 20260623160000 20260623170000 20260623400000 `
  20260623700000 20260623710000 20260626100000 20260702100000 20260714000000 20260714000100 `
  20260714000200 20260719000000 20260719000100 20260726000000 20260726000100 20260726000200 `
  20260726010000 20260727000000 20260727000100 20260727000200 20260727000300 20260728000000 `
  20260728000100 20260901000000 20260901010000 20260901020000 20260901030000 20260901040000 `
  20260901050000 20260901060000 20260901070000 20260901080000 20260901090000 20260901100000 `
  20260901110000 20260901120000 20260901130000 20260901140000 20260901150000 20260901160000 `
  20260901170000 20260901180000 20260901190000 20260901200000 20260901210000 20260901220000 `
  20260901230000 20261014000000 20261014000100 20261014000200 20261014000300 20261014000400 `
  20261014000500 20261014000600 20261014000700 20261014000800 20261014000900 20261014001000 `
  20261014001100 20261014001200 20261014001300 20261014001400 20261014001500 20261014001600 `
  20261014001700 20261014001800 20261014001900 20261014002000 20261014002100
supabase migration list  # every row should now show the same version under Local and Remote
```

Two older version numbers are used by more than one file (`20240801120000` three times, `20260726010000` twice). `repair` records each version once, which is correct, but the CLI may complain about the duplicates later; this is listed in `follow-ups.md`. Until it is fixed, keep applying migrations by pasting them, and still never use `db push`.

---

## Step 2 — Preflight

Run `docs/hr-ops/preflight.sql` (the whole file).

Expected: every **Migrations** row PASS (including the four "Phase 5" rows). Expected **FAIL** at this point, to be fixed later:

- "Templates" rows (DRAFT wording): fixed in step 11.
- "second approver available", if there are fewer than two active Admin/HR Manager/GM logins: fixed in step 10.
- Company details marked FAIL: fixed in step 11.

Any other FAIL: stop and investigate before continuing.

---

## Step 3 — Set up the daily jobs (pg_cron)

1. Firebase console → App Hosting → backend **studio** → Settings → Environment: make sure these exist (secrets for the sensitive ones), then roll out the app so it picks them up:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service-role key (secret) |
   | `CRON_SECRET` | a long random string (secret), e.g. from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Sentry (monitoring, step 14) |

2. Supabase Dashboard → Database → Extensions → switch on **pg_cron**.
3. Run `docs/hr-ops/crons.sql`, **one part at a time**:
   - Part 1 with your `CRON_SECRET` pasted in (do not save the file with it),
   - Part 2 (schedules),
   - Part 3 (one run by hand): the last query must show status **200** and `"success":true`.
4. Run `docs/hr-ops/postflight.sql`: the two "Scheduled jobs" rows are PASS.

---

## Step 4 — Create the UAT data

On your own machine, in the repository folder, with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set (or present in `apps/catering-system/.env.local`):

```powershell
node scripts/setup-uat.js --base-email <your-address@domain>
```

It prints what it created. Invitations go to `<you>+uat-admin@…`, `+uat-general-manager@…`, `+uat-hr-manager@…`, `+uat-finance@…`, `+uat-staff@…` (they arrive in your normal inbox). Running it again changes nothing that already exists.

Then the HR Manager (with the UAT login): Leave → Balances → **Set up <year> balances** if any UAT employee has no balance.

---

## Step 5 — UAT

The HR Manager and General Manager work through `docs/hr-ops/uat-checklist.md`, with the UAT logins only. No monthly payroll run during UAT. Both sign the last page.

You can also run the SQL test files in `supabase/tests/` during this period (each ends with `PASS: …` or `FAIL: …` and changes nothing). They refuse to run after step 13.

## Step 6 — Fixes

Send me the failed tests (number + note). Each fix comes as its own commit with a test; re-test the affected rows.

---

## Step 7 — Cleanup dry run

Run Part 1 of `docs/hr-ops/cleanup-uat.sql`. Read the result:

- `employees`, `logins`, `candidates`: **every** name must be test data (UAT-…, "UAT …", `+uat-`).
- `other_tables`: anything listed there (e.g. payroll rows for a UAT employee) is removed too.
- `counters`: what each reference-number counter goes back to.

If anything real appears in the lists, **stop**.

## Step 8 — Cleanup

1. Run Part 2 of `docs/hr-ops/cleanup-uat.sql` (uncomment it first). One transaction: everything or nothing.
2. Remove the test files:

   ```powershell
   node scripts/cleanup-uat.js --files-from-audit
   ```

   (Alternatively, `node scripts/cleanup-uat.js` for a dry run and `node scripts/cleanup-uat.js --confirm` does steps 8.1 and 8.2 in one go.)

The Audit Trail keeps every entry; a final `uat.cleanup` entry records what was removed.

## Step 9 — Postflight

Run `docs/hr-ops/postflight.sql`. Every row must be PASS (INFO rows are information), in particular every **UAT data** row ("none left") and **Reference numbers**. Stop on any FAIL.

---

## Step 10 — Real roles and logins

1. Invite anyone who has no login yet (one line per person; roles: `admin`, `general_manager`, `hr_manager`, `finance`, `staff`):

   ```powershell
   node scripts/invite-staff.js person@abbyscaterers.com staff
   ```

2. In the SQL editor, set roles and link each login to its employee record. Fill in the emails and employee ids, then run:

   ```sql
   -- Roles
   UPDATE public.staff_users SET role = 'hr_manager',      is_active = true WHERE email = '<hr manager email>';
   UPDATE public.staff_users SET role = 'general_manager', is_active = true WHERE email = '<general manager email>';
   UPDATE public.staff_users SET role = 'finance',         is_active = true WHERE email = '<finance email>';
   -- ...one line per person

   -- Link each login to its employee (so they can apply for their own leave)
   UPDATE public.staff_users SET employee_id = '<employee id>' WHERE email = '<email>';
   -- ...one line per person

   -- Check
   SELECT s.email, s.role, s.is_active, s.employee_id, e."firstName" || ' ' || e."lastName" AS employee
     FROM public.staff_users s LEFT JOIN public.employees e ON e.id = s.employee_id
    ORDER BY s.role, s.email;
   ```

   Employee ids are on the Employee Records page. A login can be linked to one employee only.

3. Make sure at least **two** different people have Admin / HR Manager / General Manager: warnings and terminations need a second approver.

## Step 11 — Final wording and company details

1. HR Manager: HR Documents → Templates → for each of the eight letter types, replace the DRAFT text with the final wording and save. (The DRAFT line must be gone.)
2. Admin: Settings → General → Company details: name, address, TIN, VRN, phone, email.
3. Run `docs/hr-ops/preflight.sql`: the Templates and Company details rows are now PASS.

## Step 12 — Existing contracts and leave already taken

HR Manager, with their real login:

1. Employee Records → **Import existing contracts** → download the template → fill in one row per current contract (and past ones if wanted) → upload → check the preview → Import.
2. Leave → **Import opening balances** → download the template → fill in the leave each person took this year before go-live → upload → check → Import.
3. Leave → Balances: spot-check a few people.

If a file is refused, nothing from it was imported: fix the rows named in the message and import the file again.

## Step 13 — Record go-live

In the SQL editor:

```sql
UPDATE public.app_settings SET hr_go_live_at = now() WHERE id = true;
SELECT hr_go_live_at, hr_modules FROM public.app_settings WHERE id = true;
```

From now on the SQL test files refuse to run, and opening balances can only be corrected for this year. Use only `preflight.sql`, `postflight.sql` and `monitoring.sql` on this database.

## Step 14 — Announce

Tell the users the system is ready (share `guide-staff.md` / `guide-staff-sw.md` with staff and `guide-hr-admin.md` with HR). For the first weeks, run `docs/hr-ops/monitoring.sql` each morning and check Sentry for "permission denied" reports.

---

## Rollback

Migrations are **never reversed by hand**: no hand-written `DROP` or `DELETE` to "undo" a migration. Choose the lowest level that fixes the problem.

### Level 1 — hide a module (minutes, no deploy, no data change)

Admin: Settings → **HR modules** → untick the module → Save. Everyone sees the change on their next page load; its daily job stops doing anything. Or in the SQL editor:

```sql
-- Example: keep only audit and leave
UPDATE public.app_settings SET hr_modules = ARRAY['audit', 'leave'] WHERE id = true;
-- Everything back on
UPDATE public.app_settings SET hr_modules = ARRAY['audit', 'leave', 'documents', 'letters', 'candidates'] WHERE id = true;
```

"End employment without a letter" and Users & Access stay available whatever the switch says. The database rules stay in force.

### Level 2 — previous app version (about 10 minutes, no data change)

Firebase console → App Hosting → backend **studio** → Rollouts → choose the last good rollout → **Roll back** (or redeploy that commit). The database is not touched; the app must still work with the newer database, which every version from Phase 1 onwards does.

### Level 3 — restore the backup (last resort; loses data)

Only if data is damaged and cannot be fixed. Everything entered **after the backup in step 1** is lost: every leave request, approval, balance change, letter, contract, import, login and Audit Trail entry since then, and changes made by anyone else in the app (orders, invoices, stock, payroll) in that time. Letters issued since then lose their records but their PDF files stay in storage.

1. Hide all modules (Level 1) and tell users to stop working.
2. Prefer Supabase's own restore: Dashboard → Database → Backups → restore the backup from before step 1 (or point-in-time, if available). This restores the whole database.
3. If that is not possible, restore the dumps (this replaces the public schema; run against the main database only after a fresh dump of the current state, in case you need something from it):

   ```powershell
   pg_dump $env:DB_URL --schema=public --format=custom --file="before-restore-$stamp.dump"
   pg_restore --dbname=$env:DB_URL --clean --if-exists --no-owner --no-privileges --schema=public "hr-golive-public-<stamp>.dump"
   ```

4. Run `postflight.sql` and check a few records by hand before letting users back in.
