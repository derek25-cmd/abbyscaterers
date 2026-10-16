#!/usr/bin/env bash
# Print (do NOT run) the commands that copy every Storage bucket created in
# supabase/migrations to ./storage-backup/<bucket> (gitignored).
#
#   scripts/db/backup-storage.sh
#
# Bucket names come from the `INSERT INTO storage.buckets` statements in the
# migrations. Buckets created by hand in the dashboard are NOT found this way;
# compare with Storage in the dashboard before relying on the list.
#
# Before running the printed commands: `supabase login` and
# `supabase link --project-ref <ref>` (they use the linked project).

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migrations="$repo_root/supabase/migrations"

# Each INSERT can span several lines, so collect the statement up to its ';'
# first, then take the first quoted value of each VALUES tuple (the id).
buckets="$(
  awk '
    tolower($0) ~ /insert[[:space:]]+into[[:space:]]+storage\.buckets/ { grab = 1; stmt = "" }
    grab { stmt = stmt " " $0 }
    grab && /;/ { print stmt; grab = 0 }
  ' "$migrations"/*.sql \
  | grep -oE "\([[:space:]]*'[^']+'" \
  | sed -E "s/^\([[:space:]]*'//; s/'$//" \
  | sort -u
)"

if [[ -z "$buckets" ]]; then
  echo "No storage.buckets inserts found in $migrations." >&2
  exit 1
fi

echo "# Buckets created in supabase/migrations:"
while IFS= read -r b; do
  echo "#   $b"
done <<< "$buckets"
echo
echo "# Run these yourself, from the repo root, after supabase login + link:"
while IFS= read -r b; do
  printf 'supabase storage cp -r "ss:///%s" "./storage-backup/%s" --experimental\n' "$b" "$b"
done <<< "$buckets"
echo
echo "# Not created in any migration but used by the app (Settings uploads):"
echo "#   'abbys catersmart'. If it exists in the dashboard, back it up too:"
echo "supabase storage cp -r \"ss:///abbys catersmart\" \"./storage-backup/abbys catersmart\" --experimental"
