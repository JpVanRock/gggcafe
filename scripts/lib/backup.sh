# Sourced by db-backup.sh, db-backup-check.sh and db-restore.sh. Shared pieces of the local
# backups: which tools to use, what goes in a backup, and how its data is loaded back.
# docs/architecture/backups.md explains the whole setup.

# The backup tools must be at least as new as the server (Supabase runs Postgres 17; Homebrew's
# postgresql@16, which db:test uses, can't dump it): brew install postgresql@17.
# pg17_bin <server-major>: prints the folder of the first pg_dump that is new enough.
pg17_bin() {
  local need="$1" dir v
  for dir in "${PG_BACKUP_BIN:-}" /opt/homebrew/opt/postgresql@18/bin /opt/homebrew/opt/postgresql@17/bin \
             /usr/local/opt/postgresql@18/bin /usr/local/opt/postgresql@17/bin "$(dirname "$(command -v pg_dump 2>/dev/null || echo /x/x)")"; do
    [[ -n "$dir" && -x "$dir/pg_dump" ]] || continue
    v="$("$dir/pg_dump" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
    if (( v >= need )); then echo "$dir"; return 0; fi
  done
  echo "No pg_dump $need or newer found. Install it with: brew install postgresql@$need" >&2
  return 1
}

# What a backup holds (pg_dump -t patterns), and the tables left out of it: sign-in sessions and
# one-time tokens (secrets with no use after a restore), rate-limit and reset counters that expire
# within a day, and the job queue (restoring it could send old emails again). Supabase Vault and the
# bucket list aren't copied: the migrations and docs/architecture/jobs.md set those up again.
BACKUP_TABLES=(public.'*' private.'*' auth.'*' storage.objects supabase_migrations.schema_migrations)
BACKUP_SKIP=(
  auth.sessions auth.refresh_tokens auth.flow_state auth.one_time_tokens auth.mfa_amr_claims
  auth.mfa_challenges auth.audit_log_entries auth.saml_relay_states auth.webauthn_challenges
  auth.oauth_client_states auth.oauth_authorizations auth.schema_migrations auth.instances
  private.rate_limit_hits private.password_reset_requests private.jobs
)

# dump_row_counts <pg_restore> <database.dump>: "schema.table<TAB>rows" for every table in the dump.
dump_row_counts() {
  "$1" -f - --data-only "$2" | awk '
    /^COPY / { split($2, p, "."); t = p[1] "." p[2]; n = 0; inside = 1; next }
    inside && $0 == "\\." { print t "\t" n; inside = 0; next }
    inside { n++ }'
}

# restore_data <bin> <database.dump> <db-url> <schemas...>: empties the tables the dump has data for
# in those schemas, then loads the dump's rows and sequence values, all in one transaction. Triggers
# and foreign-key checks are off while loading (session_replication_role = replica), so the rows come
# back exactly as saved: no lifecycle guards, notifications or points fire.
restore_data() {
  local bin="$1" dump="$2" url="$3"; shift 3
  local schemas=" $* " list tables
  list="$(mktemp)"
  "$bin/pg_restore" -l "$dump" | awk -v s="$schemas" '
    /^;/ { next }
    ($4 == "TABLE" && $5 == "DATA") || ($4 == "SEQUENCE" && $5 == "SET") {
      if (index(s, " " $6 " ")) print }' > "$list"
  tables="$(awk '$4 == "TABLE" && $5 == "DATA" { printf "%s%s.%s", (n++ ? ", " : ""), $6, $7 }' "$list")"
  [[ -n "$tables" ]] || { echo "The backup has no data for: $*" >&2; rm -f "$list"; return 1; }
  {
    echo "set session_replication_role = replica;"
    echo "truncate table $tables cascade;"
    "$bin/pg_restore" -f - --data-only -L "$list" "$dump"
  } | "$bin/psql" "$url" -X -q -v ON_ERROR_STOP=1 --single-transaction -f - >/dev/null
  local status=$?
  rm -f "$list"
  return $status
}
