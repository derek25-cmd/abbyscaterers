# Data readiness 00: backups, staging restore and schema pull

Before any ML work touches the data, take a full backup of the production
database and its Storage files. Then restore the backup into a separate
staging project, so exploratory queries never run on production. This page
covers Step 0 (backups and staging) and the schema pull from Step 1.

> **The data in a backup is real client, payroll and tax data.** Never commit
> it, never e-mail it, and never leave an unencrypted copy on a shared or synced
> drive. `backups/`, `storage-backup/` and `*.dump` are gitignored so that a
> careless `git add .` cannot pick them up. Do not rely on that alone.

All scripts are bash. On Windows, run them in **Git Bash** from the repository
root.

## What you need

| Tool | Used by | Notes |
| --- | --- | --- |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | `backup.sh`, storage backup, `db pull` | `supabase --version` |
| Docker Desktop, running | `supabase db dump`, `supabase db pull` | The CLI runs `pg_dump` in a container |
| `psql` (PostgreSQL client) | `restore-to-staging.sh` | Same major version as the database (Supabase is on 15 or 17) |
| `sha256sum` or `shasum` | both backup scripts | Included in Git Bash and macOS |

## 1. Get the Session pooler connection string

1. Open the project in the Supabase dashboard and click **Connect** (top bar).
2. Choose **Session pooler** (not "Direct connection", which is IPv6-only on
   most networks, and not "Transaction pooler" on port 6543, which `pg_dump`
   cannot use).
3. Copy the URI. It looks like
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   Put the database password in place of `[YOUR-PASSWORD]`. If you don't have
   it, reset it under **Project Settings → Database**. Resetting changes it
   for everything that uses it.
4. The `<project-ref>` part (20 lowercase letters) is the project's reference
   ID. You also need it for `PROD_PROJECT_REF` below.

Keep the string in your password manager. Load it into the shell without it
landing in your shell history:

```bash
read -rs DB_URL && export DB_URL     # paste, press Enter; nothing is echoed
```

## 2. Back up the database: `scripts/db/backup.sh`

```bash
read -rs DB_URL && export DB_URL
scripts/db/backup.sh
unset DB_URL
```

The script refuses to start if `DB_URL` is not set, and never prints it. It
creates `backups/<YYYY-MM-DD_HHMM>/` with:

| File | Contents |
| --- | --- |
| `roles.sql` | Database roles (`supabase db dump --role-only`) |
| `schema.sql` | Tables, functions, policies, triggers |
| `data.sql` | All rows, as `COPY` statements (`--use-copy --data-only`) |
| `SHA256SUMS` | Checksums of the three files |

It then checks that each file is non-empty, prints file sizes and the number of
`COPY public.…` statements in `data.sql` (roughly one per table that has rows).
A count of 0 means something is wrong.

To write the backup straight to an encrypted volume instead of `backups/`, set
`BACKUP_ROOT`, e.g. `BACKUP_ROOT=/e/secure-backups scripts/db/backup.sh`.

The database dump does **not** contain the files in Storage (logos, HR letters,
leave attachments, visit photos). Back those up separately (next section).

## 3. Back up Storage: `scripts/db/backup-storage.sh`

```bash
scripts/db/backup-storage.sh
```

This only **prints** commands; it runs nothing. It reads the bucket names from
the `INSERT INTO storage.buckets` statements in `supabase/migrations/`:

`company-documents`, `hr-documents`, `leave-attachments`, `marketer-avatars`,
`marketer-documents`, `visit-photos`, `voice-notes`

It also prints a command for **`abbys catersmart`**. The Settings page uploads
the logo and images to that bucket, but no migration creates it. Check
**Storage** in the dashboard for any other bucket created by hand and add it
the same way.

The printed commands use the linked project. Link first (section 6, steps 1–2),
then run them from the repository root. Files land in `storage-backup/<bucket>/`
(gitignored). Example:

```bash
supabase storage cp -r "ss:///hr-documents" "./storage-backup/hr-documents" --experimental
```

## 4. Store the backup safely

- Move `backups/<stamp>/` and `storage-backup/` **out of the repository**
  as soon as the scripts finish.
- Encrypt them, for example:
  - `tar czf - backups/<stamp> | gpg --symmetric --cipher-algo AES256 -o abbys-db-<stamp>.tar.gz.gpg`
  - or 7-Zip on Windows: archive format 7z, encryption AES-256, and tick
    "Encrypt file names".
- Keep the passphrase in the password manager, not next to the file.
- Keep at least two copies in different places (e.g. an encrypted external
  drive and a private cloud bucket that only you can read).
- Delete the unencrypted folders afterwards, and empty the recycle bin.
- Check that `SHA256SUMS` still verifies after copying:
  `cd <folder> && sha256sum -c SHA256SUMS`.

## 5. Create a staging project and restore into it

Staging is a separate Supabase project holding a copy of production, for
analysis and for trying migrations. Nothing there reaches production.

### Create the project (free plan)

1. Dashboard → **New project**, same organisation. The free plan allows two
   active projects, so check you have one free.
2. Name it clearly, e.g. `abbys-staging`. Pick the **same region** as
   production and a **new** database password.
3. Wait until it is ready, then copy its **Session pooler** string (section 1).
   Its project ref must differ from production's.
4. Free projects pause after a week without activity. Restore it from the
   dashboard when needed.

### Restore: `scripts/db/restore-to-staging.sh`

> **Warning: this command writes to whatever database `STAGING_DB_URL` points
> at.** It creates roles, tables and data, and on a database that already has
> them it will fail or mix old and new data. Only ever point it at a freshly
> created, empty staging project.

```bash
read -rs STAGING_DB_URL && export STAGING_DB_URL   # the STAGING Session pooler string
export PROD_PROJECT_REF=<production project ref>   # not secret; used to refuse production
scripts/db/restore-to-staging.sh backups/<YYYY-MM-DD_HHMM>
unset STAGING_DB_URL
```

Before touching anything the script:

1. refuses if `PROD_PROJECT_REF` is unset, or if `STAGING_DB_URL` contains it;
2. refuses if it cannot read a Supabase project ref from `STAGING_DB_URL`;
3. checks the backup's `SHA256SUMS`;
4. shows the target project ref and makes you **type it** to continue.

It then runs Supabase's documented restore in **one transaction**, stopping at
the first error: roles, schema, `SET session_replication_role = replica`
(triggers off, so audit and guard triggers don't fire on restored rows), then
data. If anything fails, the whole restore rolls back and the staging database
is unchanged. Read the **first** error in the output.

The storage files are not restored by this script. Copy them into the staging
project's buckets with `supabase storage cp` only if an analysis needs them.

## 6. Pull the live schema into the repo (you run this)

Many tables the app depends on have no migration in this repo, or only a loose
schema file (see `01-schema-inventory.md`). `supabase db pull` writes the live
schema into a new migration file, so the repo finally matches production.
It **reads** production and changes nothing there.

Needs Docker running.

1. `supabase login`. This opens the browser to authorise the CLI.
2. `supabase link --project-ref <production project ref>`. Enter the
   production database password when asked. Linking writes
   `supabase/.temp/` (now gitignored).
3. `supabase db pull`. It writes `supabase/migrations/<timestamp>_remote_schema.sql`.
4. Commit that file **exactly as generated**: don't edit, reformat or trim
   it. Review it in the PR instead. A clear message, e.g.
   `chore(db): pull live production schema (unedited)`.

### If `db pull` reports a migration-history mismatch

You apply migrations by pasting them into the SQL Editor, so production's
migration-history table (`supabase_migrations.schema_migrations`) does not list
most of the files in `supabase/migrations/`. `db pull` will probably stop with a
message like *"The remote database's migration history does not match local
files"* and suggest `supabase migration repair --status applied …` or
`--status reverted …`.

**Do not run `supabase migration repair`** (or `db push`, or `db reset`
against the linked project) without asking first. `repair` rewrites that
history table on production, and choosing the wrong status can make a later
`db push` re-run, or skip, real migrations. Copy the full output and send it
over. We'll decide together, and may pull into a throwaway directory instead.

If `link` or `pull` complains that `supabase/config.toml` is missing, stop
there too. `supabase init` would add new files to the repo, so decide that
first.

## Order of work

1. Database backup (section 2) → encrypt and move it (section 4).
2. Storage backup (section 3, after linking).
3. Audit SQL: `supabase/audit/01_schema_audit.sql`, then
   `supabase/audit/02_baseline_quality.sql`, in the production SQL Editor.
   Both are read-only. Export each result as CSV into
   `docs/data-readiness/audit-output/` (gitignored until you've checked it for
   personal data).
4. Schema pull (section 6).
5. Optional: staging project and restore (section 5).
