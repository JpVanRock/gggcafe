#!/usr/bin/env bash
# Test-loads a backup (db-backup.sh runs this after every backup): builds a throwaway local Postgres
# from the migrations up to the backup's latest one, loads the backup's app data (public and private
# schemas) the same way db:restore does, and checks each table has the row count the backup recorded.
# Sign-in accounts (auth) are checked only by count in the dump: the local stand-in for Supabase Auth
# doesn't have every column. Nothing here touches the live database.
#   bash scripts/db-backup-check.sh ~/GGG.Cafe-backups/<date_time>
set -euo pipefail
B="${1:?Usage: db-backup-check.sh <backup folder>}"
B="$(cd "$B" && pwd -P)"
[[ -f "$B/database.dump" && -f "$B/rows.tsv" && -f "$B/manifest.txt" ]] || { echo "Not a backup folder: $B" >&2; exit 1; }
source "$(dirname "$0")/lib/backup.sh"

major="$(sed -nE 's/^Postgres: +([0-9]+).*/\1/p' "$B/manifest.txt")"
export MIGRATIONS_UPTO="$(sed -nE 's/^Latest migration: +([0-9]+).*/\1/p' "$B/manifest.txt")"
BIN="$(pg17_bin "${major:-17}")"
export PATH="$BIN:$PATH" DB_TEST_PORT="${DB_CHECK_PORT:-54339}"
source "$(dirname "$0")/lib/local-db.sh"

echo "check    test database: Postgres $("$BIN/postgres" --version | awk '{print $3}'), migrations up to $MIGRATIONS_UPTO"
local_db_start quiet
URL="postgresql://postgres@localhost:$PORT/postgres"
restore_data "$BIN" "$B/database.dump" "$URL" public private

bad=0 tables=0 rows=0
while IFS=$'\t' read -r table want; do
  case "$table" in public.*|private.*) ;; *) continue ;; esac
  got="$(run -At -c "select count(*) from $table")"
  tables=$((tables + 1)); rows=$((rows + got))
  if [[ "$got" != "$want" ]]; then echo "MISMATCH $table: backup has $want rows, loaded $got" >&2; bad=1; fi
done < "$B/rows.tsv"
(( bad == 0 )) || exit 1
users="$(awk -F'\t' '$1 == "auth.users" { print $2 }' "$B/rows.tsv")"
echo "check    loaded $tables tables, $rows rows: every count matches the backup (sign-in accounts in the dump: ${users:-0})"
