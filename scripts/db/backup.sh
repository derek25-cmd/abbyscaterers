#!/usr/bin/env bash
# Full logical backup of the Supabase database: roles, schema and data.
#
#   DB_URL='postgresql://...' scripts/db/backup.sh
#
# Reads the connection string ONLY from $DB_URL (use the Session pooler
# string; see docs/data-readiness/00-backup-and-staging.md). It never prints
# it. Writes backups/<YYYY-MM-DD_HHMM>/ (gitignored) with roles.sql,
# schema.sql, data.sql and SHA256SUMS. Set BACKUP_ROOT to write somewhere
# else, e.g. an encrypted volume outside the repo.
#
# Read-only against the database: `supabase db dump` runs pg_dump. It needs
# the Supabase CLI and Docker running.
#
# The output contains client, payroll and tax data. Never commit it, never
# upload it anywhere unencrypted.

set -euo pipefail

if [[ -z "${DB_URL:-}" ]]; then
  echo "DB_URL is not set. Export the Session pooler connection string first:" >&2
  echo "  read -rs DB_URL && export DB_URL" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "The Supabase CLI is not installed (https://supabase.com/docs/guides/cli)." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
stamp="$(date +%Y-%m-%d_%H%M)"
dir="${BACKUP_ROOT:-$repo_root/backups}/$stamp"

if [[ -e "$dir" ]]; then
  echo "$dir already exists; wait a minute or remove it first." >&2
  exit 1
fi

# Files are readable by the current user only.
umask 077
mkdir -p "$dir"

echo "Backing up to $dir"

echo "1/3 roles"
supabase db dump --db-url "$DB_URL" -f "$dir/roles.sql" --role-only
echo "2/3 schema"
supabase db dump --db-url "$DB_URL" -f "$dir/schema.sql"
echo "3/3 data"
supabase db dump --db-url "$DB_URL" -f "$dir/data.sql" --use-copy --data-only

# ── Checks ──────────────────────────────────────────────────────────────────
failed=0
for f in roles.sql schema.sql data.sql; do
  if [[ ! -s "$dir/$f" ]]; then
    echo "ERROR: $f is missing or empty." >&2
    failed=1
  fi
done
if (( failed )); then
  echo "Backup is INCOMPLETE. Do not rely on $dir." >&2
  exit 1
fi

echo
echo "File sizes (bytes):"
for f in roles.sql schema.sql data.sql; do
  printf '  %-11s %12s\n' "$f" "$(wc -c < "$dir/$f" | tr -d ' ')"
done

# The CLI may quote identifiers ("public"."orders"), so match both forms.
copy_count="$(grep -cE '^COPY ("public"|public)\.' "$dir/data.sql" || true)"
echo
echo "COPY public.* statements in data.sql: $copy_count"
if [[ "$copy_count" == "0" ]]; then
  echo "WARNING: no public tables in data.sql. Check the connection string and permissions." >&2
fi

# ── Checksums ───────────────────────────────────────────────────────────────
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$dir" && sha256sum roles.sql schema.sql data.sql > SHA256SUMS)
elif command -v shasum >/dev/null 2>&1; then
  (cd "$dir" && shasum -a 256 roles.sql schema.sql data.sql > SHA256SUMS)
else
  echo "ERROR: neither sha256sum nor shasum is available; no checksum written." >&2
  exit 1
fi

echo
echo "Checksums written to $dir/SHA256SUMS"
echo "Done. Move this folder to encrypted storage outside the repo."
