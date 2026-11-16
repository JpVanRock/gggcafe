#!/usr/bin/env bash
# Saves a dated copy of the live database (and, with SUPABASE_SECRET_KEY in .env.local, every
# uploaded file) to a folder on this Mac, outside the repo. Then it test-loads the copy into a
# throwaway local database and checks every table's row count, and deletes backups older than
# 30 days (the Privacy page promises backup copies are gone within about 30 days).
#   npm run db:backup                 back up, check, prune
#   npm run db:backup -- --no-check   skip the test load
# Folder: ~/GGG.Cafe-backups (GGG_BACKUP_DIR to change). docs/architecture/backups.md
set -euo pipefail
source "$(dirname "$0")/lib/env.sh"
source "$ROOT/scripts/lib/backup.sh"
export LC_ALL=C PGCONNECT_TIMEOUT=15
umask 077  # backups hold private player data: only this Mac account can read them

CHECK=1
[[ "${1:-}" == "--no-check" ]] && CHECK=0
KEEP_DAYS=30
real() { python3 -c 'import os, sys; print(os.path.realpath(os.path.expanduser(sys.argv[1])))' "$1"; }
DIR="$(real "${GGG_BACKUP_DIR:-$HOME/GGG.Cafe-backups}")"
case "$DIR/" in
  "$(real "$ROOT")/"*) echo "The backup folder is inside the repo, which is public. Pick another GGG_BACKUP_DIR." >&2; exit 1 ;;
esac
mkdir -p "$DIR"

hide_url() { sed -E 's#postgres(ql)?://[^ ]+#<db-url>#g'; }
server_major="$(psql "$SUPABASE_DB_URL" -X -At -c "show server_version_num" 2>&1 | hide_url)"
[[ "$server_major" =~ ^[0-9]+$ ]] || { echo "Can't reach the database: $server_major" >&2; exit 1; }
server_major=$(( server_major / 10000 ))
BIN="$(pg17_bin "$server_major")"

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="$DIR/$STAMP"
PART="$OUT.partial"
mkdir "$PART"
trap 'rm -rf "$PART"' EXIT
echo "backup   $OUT"

# 1. The data (custom format: compressed, and pg_restore can load any part of it).
args=(--data-only --format=custom --no-owner --no-privileges)
for t in "${BACKUP_TABLES[@]}"; do args+=(--table="$t"); done
for t in "${BACKUP_SKIP[@]}"; do args+=(--exclude-table="$t"); done
"$BIN/pg_dump" "${args[@]}" --file="$PART/database.dump" "$SUPABASE_DB_URL" 2>&1 | hide_url
"$BIN/pg_restore" -l "$PART/database.dump" >/dev/null
echo "data     database.dump ($(du -h "$PART/database.dump" | cut -f1 | tr -d ' '))"

# 2. The structure at this moment, as readable SQL. The migrations are the real source; this shows
#    anything changed by hand in the dashboard, and what the data above fits.
"$BIN/pg_dump" --schema-only --schema=public --schema=private --file="$PART/structure.sql" "$SUPABASE_DB_URL" 2>&1 | hide_url
echo "schema   structure.sql"

# 3. Uploaded files (team logos, player photos, yearbook, ...), with their sizes checked.
meta="$("$BIN/psql" "$SUPABASE_DB_URL" -X -At -F $'\t' -v ON_ERROR_STOP=1 -c \
  "select bucket_id, name, coalesce(metadata->>'size', ''), coalesce(metadata->>'mimetype', '')
     from storage.objects order by 1, 2" 2>&1 | hide_url)"
file_count=$(grep -c . <<<"$meta" || true)
if [[ -z "${SUPABASE_SECRET_KEY:-}" ]]; then
  files_line="not included: $file_count file(s) in storage. Add the Supabase secret key (bash scripts/set-secrets.sh) to copy them"
  echo "files    skipped: no SUPABASE_SECRET_KEY in .env.local ($file_count file(s) not copied)"
elif (( file_count == 0 )); then
  files_line="0 files in storage"
  echo "files    none in storage"
else
  printf '%s\n' "$meta" > "$PART/files.tsv"
  python3 - "$PART" <<'PY'
import os, sys, urllib.parse, urllib.request
out = sys.argv[1]
base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/storage/v1/object/"
key = os.environ["SUPABASE_SECRET_KEY"]
headers = {"apikey": key, "Authorization": "Bearer " + key}
total = 0
with open(os.path.join(out, "files.tsv")) as f:
    rows = [line.rstrip("\n").split("\t") for line in f if line.strip()]
for bucket, name, size, _mimetype in rows:
    parts = name.split("/")
    if not name or name.startswith("/") or ".." in parts or "/" in bucket:
        sys.exit(f"Unsafe file name in storage, not copied: {bucket}/{name}")
    url = base + urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(name, safe="/")
    dest = os.path.join(out, "files", bucket, *parts)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
            data = r.read()
    except Exception as e:  # never print the URL's headers; the key is in them
        sys.exit(f"Couldn't download {bucket}/{name}: {e}")
    if size and int(size) != len(data):
        sys.exit(f"{bucket}/{name}: got {len(data)} bytes, storage says {size}")
    with open(dest, "wb") as w:
        w.write(data)
    total += len(data)
print(f"files    {len(rows)} file(s), {total / 1024:.0f} kB")
PY
  files_line="$file_count file(s), sizes checked (files/, list in files.tsv)"
fi

# 4. The manifest: what this backup is, and every table's row count (read back from the dump itself).
latest="$("$BIN/psql" "$SUPABASE_DB_URL" -X -At -c "select max(version) from supabase_migrations.schema_migrations" 2>&1 | hide_url)"
dump_row_counts "$BIN/pg_restore" "$PART/database.dump" | sort > "$PART/rows.tsv"
{
  echo "GGG.Cafe backup"
  echo "Taken:             $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Project:           $SUPABASE_PROJECT_REF"
  echo "Postgres:          $server_major (pg_dump $("$BIN/pg_dump" --version | awk '{print $3}'))"
  echo "Latest migration:  $latest"
  echo "Tables:            $(wc -l < "$PART/rows.tsv" | tr -d ' '), $(awk -F'\t' '{s += $2} END {print s + 0}' "$PART/rows.tsv") rows (rows.tsv)"
  echo "Files:             $files_line"
  echo "Restore:           docs/architecture/backups.md (npm run db:restore -- \"$OUT\")"
} > "$PART/manifest.txt"
mv "$PART" "$OUT"
trap - EXIT

# 5. Prove it loads: a throwaway local Postgres, the migrations up to this backup, then the data.
if (( CHECK )); then
  if bash "$ROOT/scripts/db-backup-check.sh" "$OUT"; then
    echo "Restore check:     passed $(date '+%Y-%m-%d %H:%M')" >> "$OUT/manifest.txt"
  else
    echo "Restore check:     FAILED $(date '+%Y-%m-%d %H:%M')" >> "$OUT/manifest.txt"
    echo "The backup was saved but didn't load cleanly. Older backups were kept." >&2
    exit 1
  fi
fi

# 6. Keep the last 30 days. Only after a good backup, and never the one just made.
if date -v-1d >/dev/null 2>&1; then cutoff="$(date -v-"$KEEP_DAYS"d +%Y-%m-%d)"; else cutoff="$(date -d "$KEEP_DAYS days ago" +%Y-%m-%d)"; fi
for old in "$DIR"/20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]_*; do
  [[ -d "$old" && "$old" != "$OUT" ]] || continue
  name="$(basename "$old")"
  if [[ "${name:0:10}" < "$cutoff" ]]; then rm -rf "$old"; echo "removed  $name (older than $KEEP_DAYS days)"; fi
done
echo "Done: $OUT"
