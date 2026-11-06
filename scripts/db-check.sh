#!/usr/bin/env bash
# Confirms .env.local can reach the live database and shows which migrations are applied.
set -euo pipefail
source "$(dirname "$0")/lib/env.sh"
export LC_ALL=C PGCONNECT_TIMEOUT=15
psql "$SUPABASE_DB_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL' 2>&1 | sed -E 's#postgres(ql)?://[^ ]+#<db-url>#g'
select 'Connected to Supabase Postgres ' || current_setting('server_version');
select 'Tables in public schema: ' || count(*) from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';
select to_regclass('supabase_migrations.schema_migrations') is not null as has_history \gset
\if :has_history
select 'Migrations applied: ' || coalesce(string_agg(version || '_' || name, ', ' order by version), 'none')
  from supabase_migrations.schema_migrations;
\else
select 'Migrations applied: none';
\endif
SQL
exit "${PIPESTATUS[0]}"
