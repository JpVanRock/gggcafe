#!/usr/bin/env bash
# New migration from the privileged-function template: npm run db:new:definer <name>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="${1:?usage: npm run db:new:definer <name>}"
cd "$ROOT"
supabase migration new "$name" < /dev/null
file="$(ls -t supabase/migrations/*_"$name".sql | head -1)"
cat supabase/templates/definer-function.sql > "$file"
echo "Wrote $file from supabase/templates/definer-function.sql"
