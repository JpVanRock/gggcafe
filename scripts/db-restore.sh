#!/usr/bin/env bash
# Loads a backup from db-backup.sh into a NEW, EMPTY Supabase project: the one .env.local points at.
# It refuses a database that already has sign-in accounts, teams or players, so it can't overwrite
# the live site. Before running it: create the project, put its settings in .env.local
# (bash scripts/set-secrets.sh) and push the migrations. Full steps: docs/architecture/backups.md.
#   npm run db:restore -- ~/GGG.Cafe-backups/<date_time>                 data, then files
#   npm run db:restore -- ~/GGG.Cafe-backups/<date_time> --files-only    just the uploaded files
set -euo pipefail
B="${1:?Usage: npm run db:restore -- <backup folder> [--files-only]}"
B="$(cd "$B" && pwd -P)"
FILES_ONLY=0
[[ "${2:-}" == "--files-only" ]] && FILES_ONLY=1
[[ -f "$B/database.dump" && -f "$B/manifest.txt" ]] || { echo "Not a backup folder: $B" >&2; exit 1; }
source "$(dirname "$0")/lib/env.sh"
source "$ROOT/scripts/lib/backup.sh"
export LC_ALL=C PGCONNECT_TIMEOUT=15
hide_url() { sed -E 's#postgres(ql)?://[^ ]+#<db-url>#g'; }

major="$(sed -nE 's/^Postgres: +([0-9]+).*/\1/p' "$B/manifest.txt")"
want="$(sed -nE 's/^Latest migration: +([0-9]+).*/\1/p' "$B/manifest.txt")"
BIN="$(pg17_bin "${major:-17}")"
q() { "$BIN/psql" "$SUPABASE_DB_URL" -X -At -v ON_ERROR_STOP=1 -c "$1" 2>&1 | hide_url; }

echo "Backup:  $B"
sed -n '2,7p' "$B/manifest.txt" | sed 's/^/         /'
echo "Into:    project $SUPABASE_PROJECT_REF (from .env.local)"

upload_files() {
  if [[ ! -f "$B/files.tsv" ]]; then echo "files    none in this backup"; return 0; fi
  if [[ -z "${SUPABASE_SECRET_KEY:-}" ]]; then
    echo "files    not uploaded yet: add the new project's secret key (bash scripts/set-secrets.sh), then run"
    echo "         npm run db:restore -- \"$B\" --files-only"
    return 0
  fi
  python3 - "$B" <<'PY'
import os, sys, urllib.error, urllib.parse, urllib.request
b = sys.argv[1]
base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/storage/v1/object/"
key = os.environ["SUPABASE_SECRET_KEY"]
n = skipped = 0
with open(os.path.join(b, "files.tsv")) as f:
    rows = [line.rstrip("\n").split("\t") for line in f if line.strip()]
for bucket, name, _size, mimetype in rows:
    parts = name.split("/")
    if not name or name.startswith("/") or ".." in parts or "/" in bucket:
        sys.exit(f"Unsafe file name in the backup, not uploaded: {bucket}/{name}")
    with open(os.path.join(b, "files", bucket, *parts), "rb") as r:
        data = r.read()
    url = base + urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(name, safe="/")
    # Never replaces a file that's already there (x-upsert false), so pointing this at a project
    # that's in use can't change its files.
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey": key, "Authorization": "Bearer " + key, "x-upsert": "false",
        "content-type": mimetype or "application/octet-stream"})
    try:
        urllib.request.urlopen(req, timeout=60).read()
        n += 1
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        if e.code == 409 or "Duplicate" in body or "already exists" in body:
            skipped += 1
            continue
        sys.exit(f"Couldn't upload {bucket}/{name}: HTTP {e.code} {body[:200]}")
    except Exception as e:
        sys.exit(f"Couldn't upload {bucket}/{name}: {e}")
print(f"files    {n} file(s) uploaded to the same buckets and paths" + (f", {skipped} already there (left as they are)" if skipped else ""))
PY
}

if (( FILES_ONLY )); then upload_files; exit 0; fi

# Never into a database that's in use.
in_use="$(q "select (select count(*) from auth.users) + (select count(*) from public.teams) + (select count(*) from public.players)")"
[[ "$in_use" =~ ^[0-9]+$ ]] || { echo "Can't read the target database: $in_use" >&2; exit 1; }
if (( in_use > 0 )); then
  echo "Stopped: project $SUPABASE_PROJECT_REF already has sign-in accounts, teams or players." >&2
  echo "A restore only goes into a new, empty project, so it can never overwrite the live site." >&2
  exit 1
fi
# The structure must be the one the backup was taken on.
have="$(q "select coalesce(max(version), 'none') from supabase_migrations.schema_migrations")"
if [[ "$have" != "$want" ]]; then
  echo "Stopped: this project's latest migration is $have, the backup's is $want." >&2
  echo "Push exactly the migrations up to $want first (docs/architecture/backups.md)." >&2
  exit 1
fi

read -r -p "Type the project ref ($SUPABASE_PROJECT_REF) to load the backup into it: " typed < /dev/tty
[[ "$typed" == "$SUPABASE_PROJECT_REF" ]] || { echo "Not confirmed. Nothing was changed."; exit 1; }

restore_data "$BIN" "$B/database.dump" "$SUPABASE_DB_URL" public private auth
echo "data     loaded: sign-in accounts (same passwords), teams, players and everything else in the backup"
upload_files
echo "Next: the settings a backup can't hold (Vault, Vercel, Auth email, DNS): docs/architecture/backups.md"
