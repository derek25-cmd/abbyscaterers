#!/usr/bin/env bash
# Restore a backup made by scripts/db/backup.sh into a STAGING database.
#
#   STAGING_DB_URL='postgresql://...' PROD_PROJECT_REF='<prod ref>' \
#     scripts/db/restore-to-staging.sh backups/2026-10-16_1430
#
# WARNING: this WRITES to whatever database STAGING_DB_URL points at. It is
# meant for an empty, freshly created staging project. Safety checks:
#   * refuses if STAGING_DB_URL contains the production project ref
#     ($PROD_PROJECT_REF, required);
#   * refuses if it cannot tell which Supabase project the URL points at;
#   * verifies the backup's SHA256SUMS when present;
#   * asks you to type the target project ref before restoring.
# Connection strings are read from the environment and never printed.
#
# The restore is Supabase's documented sequence: roles, schema, then data
# with triggers disabled (session_replication_role = replica), all in one
# transaction that stops at the first error.

set -euo pipefail

usage() {
  echo "Usage: STAGING_DB_URL=... PROD_PROJECT_REF=... $0 <backup-folder>" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage
backup_dir="${1%/}"

if [[ -z "${STAGING_DB_URL:-}" ]]; then
  echo "STAGING_DB_URL is not set." >&2
  exit 1
fi
if [[ -z "${PROD_PROJECT_REF:-}" ]]; then
  echo "PROD_PROJECT_REF is not set. It is required so this script can refuse to touch production." >&2
  exit 1
fi

url_lc="$(printf '%s' "$STAGING_DB_URL" | tr '[:upper:]' '[:lower:]')"
prod_lc="$(printf '%s' "$PROD_PROJECT_REF" | tr '[:upper:]' '[:lower:]')"

if [[ "$url_lc" == *"$prod_lc"* ]]; then
  echo "REFUSED: STAGING_DB_URL points at the production project ($PROD_PROJECT_REF)." >&2
  exit 1
fi

# Project ref from the Session pooler user (postgres.<ref>@...pooler.supabase.com)
# or the direct host (db.<ref>.supabase.co).
target_ref=""
if [[ "$url_lc" =~ postgres\.([a-z0-9]{20})[:@] ]]; then
  target_ref="${BASH_REMATCH[1]}"
elif [[ "$url_lc" =~ @db\.([a-z0-9]{20})\.supabase\.co ]]; then
  target_ref="${BASH_REMATCH[1]}"
fi
if [[ -z "$target_ref" ]]; then
  echo "REFUSED: cannot tell which Supabase project STAGING_DB_URL points at." >&2
  echo "Use the Session pooler or direct connection string from the staging project's dashboard." >&2
  exit 1
fi
if [[ "$target_ref" == "$prod_lc" ]]; then
  echo "REFUSED: the target project is production." >&2
  exit 1
fi

for f in roles.sql schema.sql data.sql; do
  if [[ ! -s "$backup_dir/$f" ]]; then
    echo "$backup_dir/$f is missing or empty." >&2
    exit 1
  fi
done

if [[ -f "$backup_dir/SHA256SUMS" ]]; then
  echo "Verifying checksums..."
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$backup_dir" && sha256sum -c SHA256SUMS)
  else
    (cd "$backup_dir" && shasum -a 256 -c SHA256SUMS)
  fi
else
  echo "WARNING: no SHA256SUMS in $backup_dir; the files cannot be verified." >&2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed (PostgreSQL client tools)." >&2
  exit 1
fi

echo
echo "About to restore $backup_dir into Supabase project: $target_ref"
echo "This WRITES to that database. Production ($PROD_PROJECT_REF) is excluded."
read -r -p "Type the target project ref to continue: " typed
if [[ "$(printf '%s' "$typed" | tr '[:upper:]' '[:lower:]')" != "$target_ref" ]]; then
  echo "Confirmation did not match. Nothing was restored." >&2
  exit 1
fi

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$backup_dir/roles.sql" \
  --file "$backup_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$backup_dir/data.sql" \
  --dbname "$STAGING_DB_URL"

echo "Restore into $target_ref finished."
