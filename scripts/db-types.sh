#!/usr/bin/env bash
# Regenerates src/lib/supabase/database.types.ts from the migrations: applies them to a
# throwaway local Postgres (the same one db:test uses; no Docker, no `supabase login`),
# reads the public schema and writes the Supabase client's Database type.
# Run it after every new migration (db:push runs it for you).
set -euo pipefail
source "$(dirname "$0")/lib/local-db.sh"

local_db_start quiet
out="$WORK/schema.json"
run -t -A -f "$ROOT/scripts/sql/introspect.sql" > "$out"
python3 "$ROOT/scripts/gen-types.py" "$out" > "$WORK/database.types.ts"
mv "$WORK/database.types.ts" "$ROOT/src/lib/supabase/database.types.ts"
echo "Wrote src/lib/supabase/database.types.ts"
