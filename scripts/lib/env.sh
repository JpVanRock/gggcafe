# Sourced by the db scripts. Loads .env.local and builds SUPABASE_DB_URL from the project ref
# and pooler host, unless a full postgres:// SUPABASE_DB_URL is already given. The password is
# never in the URL: it goes to psql, pg_dump, pg_restore and the Supabase CLI as PGPASSWORD,
# because a command line is visible to every account on this Mac (ps) and the environment
# only to this one.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ ! -f "$ROOT/.env.local" ]]; then
  echo "Missing .env.local — copy .env.example and fill it in." >&2
  exit 1
fi
set -a; source "$ROOT/.env.local"; set +a

if [[ "${SUPABASE_DB_URL:-}" != postgres* ]]; then
  if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    SUPABASE_PROJECT_REF="$(sed -nE 's#^https://([a-z0-9]+)\.supabase\.co.*#\1#p' <<<"${NEXT_PUBLIC_SUPABASE_URL:-}")"
  fi
  for v in SUPABASE_PROJECT_REF SUPABASE_DB_HOST SUPABASE_DB_PASSWORD; do
    if [[ -z "${!v:-}" || "${!v}" == *YOUR-* || "${!v}" == *REGION* ]]; then
      echo "$v is not set in .env.local." >&2
      exit 1
    fi
  done
  SUPABASE_DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}@${SUPABASE_DB_HOST}:5432/postgres"
  PGPASSWORD="$SUPABASE_DB_PASSWORD"
  export PGPASSWORD
fi
export SUPABASE_DB_URL SUPABASE_PROJECT_REF
