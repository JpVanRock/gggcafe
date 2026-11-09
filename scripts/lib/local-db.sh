# Sourced by db-test.sh and db-types.sh: starts a throwaway local Postgres (no Docker;
# Homebrew Postgres: brew install postgresql@16), applies the Supabase stand-in and every
# migration, and deletes it all on exit. Afterwards `run` executes SQL against it.
export LC_ALL=C  # macOS: postgres refuses to start without a valid locale

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGBIN="$(dirname "$(command -v pg_ctl)")"
PORT="${DB_TEST_PORT:-54329}"
WORK="$(mktemp -d)"

cleanup() {
  "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run() { psql -h localhost -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

# local_db_start [quiet]: boot the server and apply the stub + every migration.
local_db_start() {
  "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
  "$PGBIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" -w \
    -o "-p $PORT -c listen_addresses=localhost -c unix_socket_directories=''" start >/dev/null
  run -o /dev/null -f "$ROOT/tests/db/00_supabase_stub.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    [[ "${1:-}" == quiet ]] || echo "migrate  $(basename "$f")"
    run -o /dev/null -f "$f"
  done
}
