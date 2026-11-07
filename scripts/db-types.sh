#!/usr/bin/env bash
# Regenerates src/lib/supabase/database.types.ts from the live schema.
# Needs a one-time `supabase login` (opens your browser).
set -euo pipefail
source "$(dirname "$0")/lib/env.sh"
# Generate into a temp file and only replace the real one on success, so a failed
# run (e.g. no `supabase login` yet) can't overwrite the types with an error message.
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > "$tmp"
if ! grep -q "export type" "$tmp"; then
  echo "Type generation failed (run 'supabase login' first?):" >&2
  head -c 400 "$tmp" >&2; echo >&2
  exit 1
fi
mv "$tmp" "$ROOT/src/lib/supabase/database.types.ts"
echo "Wrote src/lib/supabase/database.types.ts"
