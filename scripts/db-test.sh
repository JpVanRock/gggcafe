#!/usr/bin/env bash
# Applies every migration + seed.sql to a throwaway local Postgres (no Docker
# needed), then runs tests/db/*.test.sql. The temporary database is deleted after.
# Requires Homebrew Postgres:  brew install postgresql@16
set -euo pipefail
export LC_ALL=C  # macOS: postgres refuses to start without a valid locale

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(dirname "$(command -v pg_ctl)")"
PORT="${DB_TEST_PORT:-54329}"
WORK="$(mktemp -d)"

cleanup() {
  "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" -w \
  -o "-p $PORT -c listen_addresses=localhost -c unix_socket_directories=''" start >/dev/null

run() { psql -h localhost -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -o /dev/null "$@"; }

run -f "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  run -f "$f"
done
echo "seed     seed.sql"
run -f "$ROOT/supabase/seed.sql"
for f in "$ROOT"/tests/db/*.test.sql; do
  echo "test     $(basename "$f")"
  run -f "$f"
done
echo "All database checks passed."
