#!/usr/bin/env bash
# Applies any new migrations in supabase/migrations to the live Supabase database.
# Does NOT load seed.sql (sample data stays local).
set -euo pipefail
source "$(dirname "$0")/lib/env.sh"
cd "$ROOT"
supabase db push --db-url "$SUPABASE_DB_URL" "$@"
