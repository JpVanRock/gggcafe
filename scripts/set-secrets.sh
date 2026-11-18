#!/usr/bin/env bash
# Prompts for the Supabase publishable key, database password and (optional, for backups of
# uploaded files) secret key, and saves them into .env.local. The password and secret key are
# hidden while you type and never printed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
[[ -f "$ENV_FILE" ]] || cp "$ROOT/.env.example" "$ENV_FILE"

echo "GGG.Cafe — save Supabase settings to .env.local"
echo "Press Enter on any prompt to leave that value unchanged."
echo
read -r -p "Publishable key (starts with sb_publishable_): " GGG_KEY
read -r -s -p "Database password (hidden as you type): " GGG_PW
echo
echo "Secret key, only for backups of uploaded files (npm run db:backup). It stays on this Mac:"
echo "never put it in Vercel. Dashboard → Project Settings → API Keys → Secret keys."
read -r -s -p "Secret key (starts with sb_secret_; hidden; Enter to skip): " GGG_SECRET
echo
echo

GGG_KEY="$GGG_KEY" GGG_PW="$GGG_PW" GGG_SECRET="$GGG_SECRET" python3 - "$ENV_FILE" <<'PY'
import os, sys
path = sys.argv[1]
key = os.environ["GGG_KEY"].strip()
pw = os.environ["GGG_PW"]
secret = os.environ["GGG_SECRET"].strip()

def single_quote(v):  # safe for bash `source` and for Next.js dotenv
    return "'" + v.replace("'", "'\"'\"'") + "'"

updates = {}
if key:
    updates["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = key
if pw:
    updates["SUPABASE_DB_PASSWORD"] = single_quote(pw)
if secret:
    updates["SUPABASE_SECRET_KEY"] = single_quote(secret)

lines = open(path).read().splitlines()
seen = set()
for i, line in enumerate(lines):
    name = line.split("=", 1)[0]
    if name in updates and "=" in line and not line.lstrip().startswith("#"):
        lines[i] = f"{name}={updates[name]}"
        seen.add(name)
for name, value in updates.items():
    if name not in seen:
        lines.append(f"{name}={value}")
open(path, "w").write("\n".join(lines) + "\n")
os.chmod(path, 0o600)  # the password and keys: readable by this Mac account only

print("Publishable key:", "saved" if key else "unchanged")
print("Database password:", "saved" if pw else "unchanged")
print("Secret key:", "saved" if secret else "unchanged")
PY

echo
echo "Testing the database connection..."
bash "$ROOT/scripts/db-check.sh" && echo "Done. You can close this tab and tell Claude."
