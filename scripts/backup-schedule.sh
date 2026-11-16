#!/usr/bin/env bash
# Runs the backup (scripts/db-backup.sh) automatically on this Mac with a launchd agent. The agent
# wakes every hour and backs up when the newest backup is 20 hours old or more. That makes one a day,
# and a day the Mac was asleep or off at some fixed time isn't skipped. It retries hourly after a
# failure. A Mac notification appears when there's been no good backup for 2 days.
#   npm run db:backup:schedule -- install   set it up (checks right away)
#   npm run db:backup:schedule -- status    whether it's set up, its last run, the newest backups
#   npm run db:backup:schedule -- remove    stop it
# The agent calls "run". Log: ~/Library/Logs/ggg-cafe-backup.log (anything unexpected from launchd itself:
# ggg-cafe-backup.launchd.log). docs/architecture/backups.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
LABEL=cafe.ggg.backup
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/ggg-cafe-backup.log"
DIR="${GGG_BACKUP_DIR:-$HOME/GGG.Cafe-backups}"
DUE_HOURS=20    # back up when the newest backup is this old
WARN_HOURS=48   # notify when the newest good backup is this old
DOMAIN="gui/$(id -u)"

# age_hours [passed]: hours since the newest backup (only ones whose restore check passed, with
# "passed"); prints nothing when there's none.
age_hours() {
  python3 - "$DIR" "${1:-}" <<'PY'
import datetime, os, re, sys, time
d, need = sys.argv[1], sys.argv[2]
best = None
for n in sorted(os.listdir(d)) if os.path.isdir(d) else []:
    if not re.fullmatch(r"\d{4}-\d\d-\d\d_\d{6}", n):
        continue
    if need:
        try:
            m = open(os.path.join(d, n, "manifest.txt")).read()
        except OSError:
            continue
        if not re.search(r"^Restore check: +passed", m, re.M):
            continue
    best = n
if best:
    t = datetime.datetime.strptime(best, "%Y-%m-%d_%H%M%S").timestamp()
    print(int((time.time() - t) // 3600))
PY
}

notify() {
  osascript -e "display notification \"$1\" with title \"GGG.Cafe backup\"" >/dev/null 2>&1 || true
}

case "${1:-}" in
  run)
    last="$(age_hours)"
    if [[ "${2:-}" != "--force" && -n "$last" ]] && (( last < DUE_HOURS )); then exit 0; fi
    mkdir -p "$(dirname "$LOG")"
    echo "=== $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"
    status=0
    bash "$ROOT/scripts/db-backup.sh" >> "$LOG" 2>&1 || status=$?
    (( status == 0 )) || echo "FAILED (exit $status): retrying in an hour" >> "$LOG"
    tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"  # keep the log short
    good="$(age_hours passed)"
    if [[ -z "$good" ]]; then
      notify "No good backup yet. See ~/Library/Logs/ggg-cafe-backup.log"
    elif (( good >= WARN_HOURS )); then
      notify "The newest good backup is $good hours old. See ~/Library/Logs/ggg-cafe-backup.log"
    fi
    exit "$status"
    ;;
  install)
    mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
    real_dir="$(python3 -c 'import os, sys; print(os.path.realpath(os.path.expanduser(sys.argv[1])))' "$DIR")"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT/scripts/backup-schedule.sh</string>
    <string>run</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>GGG_BACKUP_DIR</key><string>$real_dir</string>
  </dict>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>${LOG%.log}.launchd.log</string>
  <key>StandardErrorPath</key><string>${LOG%.log}.launchd.log</string>
</dict>
</plist>
EOF
    plutil -lint "$PLIST" >/dev/null
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Set up: checks every hour, backs up once a day into $real_dir"
    echo "Log: $LOG"
    ;;
  remove)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Stopped. Backups already saved stay in $DIR."
    ;;
  status)
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
      echo "Schedule:          on (every hour; backs up when the newest backup is ${DUE_HOURS}h old)"
      launchctl print "$DOMAIN/$LABEL" | sed -nE 's/^[[:space:]]+(runs|last exit code) = (.*)/  \1: \2/p'
    else
      echo "Schedule:          off (npm run db:backup:schedule -- install)"
    fi
    a="$(age_hours)"; g="$(age_hours passed)"
    echo "Newest backup:     ${a:-none}${a:+ hours ago}"
    echo "Newest good one:   ${g:-none}${g:+ hours ago}"
    if [[ -f "$LOG" ]]; then
      echo "Last run:"
      awk '/^=== /{buf=""} {buf = buf $0 "\n"} END {printf "%s", buf}' "$LOG" | sed 's/^/  /'
    fi
    ;;
  *)
    echo "Usage: npm run db:backup:schedule -- install | status | remove" >&2
    exit 1
    ;;
esac
