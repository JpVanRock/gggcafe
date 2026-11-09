#!/usr/bin/env bash
# Applies every migration + seed.sql to a throwaway local Postgres (no Docker
# needed), then runs tests/db/*.test.sql. The temporary database is deleted after.
# Requires Homebrew Postgres:  brew install postgresql@16
set -euo pipefail
source "$(dirname "$0")/lib/local-db.sh"

local_db_start
# The app's database types must match the migrations (npm run db:types writes them).
run -t -A -f "$ROOT/scripts/sql/introspect.sql" > "$WORK/schema.json"
python3 "$ROOT/scripts/gen-types.py" "$WORK/schema.json" > "$WORK/database.types.ts"
if ! cmp -s "$WORK/database.types.ts" "$ROOT/src/lib/supabase/database.types.ts"; then
  echo "src/lib/supabase/database.types.ts is out of date with the migrations: run npm run db:types" >&2
  exit 1
fi
echo "types    database.types.ts matches the migrations"
echo "seed     seed.sql"
run -o /dev/null -f "$ROOT/supabase/seed.sql"
for f in "$ROOT"/tests/db/*.test.sql; do
  echo "test     $(basename "$f")"
  run -o /dev/null -f "$f"
done
echo "All database checks passed."
