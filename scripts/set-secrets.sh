#!/usr/bin/env bash
# Prompts for the Supabase publishable key and database password and saves them
# into .env.local. The password is hidden while you type and never printed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
[[ -f "$ENV_FILE" ]] || cp "$ROOT/.env.example" "$ENV_FILE"

echo "GGG.Cafe — save Supabase settings to .env.local"
echo "Press Enter on either prompt to leave that value unchanged."
echo
read -r -p "Publishable key (starts with sb_publishable_): " GGG_KEY
read -r -s -p "Database password (hidden as you type): " GGG_PW
echo
echo

GGG_KEY="$GGG_KEY" GGG_PW="$GGG_PW" python3 - "$ENV_FILE" <<'PY'
import os, sys
path = sys.argv[1]
key = os.environ["GGG_KEY"].strip()
pw = os.environ["GGG_PW"]

def single_quote(v):  # safe for bash `source` and for Next.js dotenv
    return "'" + v.replace("'", "'\"'\"'") + "'"

updates = {}
if key:
    updates["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = key
if pw:
    updates["SUPABASE_DB_PASSWORD"] = single_quote(pw)

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

print("Publishable key:", "saved" if key else "unchanged")
print("Database password:", "saved" if pw else "unchanged")
PY

echo
echo "Testing the database connection..."
bash "$ROOT/scripts/db-check.sh" && echo "Done. You can close this tab and tell Claude."
