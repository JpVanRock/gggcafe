#!/usr/bin/env bash
# Regenerates src/lib/supabase/database.types.ts from the live schema.
# Needs a one-time `supabase login` (opens your browser).
set -euo pipefail
source "$(dirname "$0")/lib/env.sh"
supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public \
  > "$ROOT/src/lib/supabase/database.types.ts"
echo "Wrote src/lib/supabase/database.types.ts"
