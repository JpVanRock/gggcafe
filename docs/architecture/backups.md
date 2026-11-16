# Backups

A copy of the live data on this Mac, so the site can be rebuilt if we lose access to Supabase.
Set up 2026-11-16.

## What's where

| Piece | Kept in | Backed up by |
|---|---|---|
| Code | GitHub + this Mac (git) | git: every push |
| Database structure (tables, rules, functions, buckets, scheduled jobs) | `supabase/migrations/` | git |
| **Data**: accounts, teams, players, stats, goals, answers, logs | Supabase only | **`npm run db:backup`** |
| **Uploaded files**: team logos, player photos, yearbook, journal | Supabase Storage only | **`npm run db:backup`**, once `SUPABASE_SECRET_KEY` is in `.env.local` |
| Keys and settings | Vercel, Supabase dashboard, GoDaddy, Resend, Zoom | not copied: rebuilt by hand (see "After a restore") |

## Taking a backup

```bash
npm run db:backup
```

It saves a dated folder in `~/GGG.Cafe-backups/` (set `GGG_BACKUP_DIR` to change it; a folder inside the
repo is refused, because the repo is public):

| File | What it is |
|---|---|
| `database.dump` | Every row of the app's data (`public`, `private`), the sign-in accounts (`auth`, with password hashes, so people keep their passwords) and the list of uploaded files. pg_dump custom format. |
| `structure.sql` | The `public` and `private` structure at that moment, as readable SQL. The migrations are the source; this shows anything changed by hand, and what the data fits. |
| `files/`, `files.tsv` | The uploaded files, with each file's size checked against Storage. Only with `SUPABASE_SECRET_KEY`. |
| `rows.tsv` | Every table's row count, read back from the dump. |
| `manifest.txt` | When, which project, Postgres version, latest migration, totals, and the restore check result. |

Then it:

1. **Test-loads the backup** (`scripts/db-backup-check.sh`). A throwaway local Postgres 17 gets the
   migrations up to the backup's latest, then the backup's app data. Every table must have the row count
   the backup recorded. The live database isn't touched. Sign-in accounts are checked by count in the
   dump only, because the local stand-in for Supabase Auth doesn't have every column.
2. **Deletes backups older than 30 days**, only after a good backup and never the one just made. The
   Privacy page says copies in backups are overwritten within about 30 days. Pruning only happens when
   a backup runs, which is why the daily schedule matters.

`npm run db:backup -- --no-check` skips the test load (about 30 seconds).

## Daily schedule (on since 2026-11-16)

A launchd agent on this Mac (`cafe.ggg.backup`, `~/Library/LaunchAgents/cafe.ggg.backup.plist`) runs
`scripts/backup-schedule.sh run` every hour and at login.

- **When it backs up:** only when the newest backup is 20 hours old or more. That makes one a day, and a
  day the Mac was asleep or off at some fixed time isn't skipped.
- **When it fails:** it tries again the next hour. A failed test load saves the backup, marks it failed,
  and waits a day.
- **Warnings:** a Mac notification appears when there's been no good backup for 48 hours, or none at all.
- **Log:** `~/Library/Logs/ggg-cafe-backup.log` (the last 2,000 lines). Anything unexpected from
  launchd itself goes to `ggg-cafe-backup.launchd.log` beside it.

```bash
npm run db:backup:schedule -- status
```

`install` sets it up again (after moving the repo, say) and `remove` stops it. The agent runs the
scripts from this repo folder, so it backs up whichever project `.env.local` points at.
macOS lists it under System Settings → General → Login Items & Extensions, as "bash".

**Left out on purpose:** sign-in sessions and one-time tokens (secrets with no use after a restore),
rate-limit and password-reset counters (they expire within a day), the job queue (restoring it could
send old emails again), and Supabase Vault (encrypted with the project's own key; re-entered by hand).
The list is `BACKUP_SKIP` in `scripts/lib/backup.sh`.

**Tools:** the database runs Postgres 17, and `pg_dump` can't copy a server newer than itself.
`brew install postgresql@17` installs it beside postgresql@16 without replacing it (keg-only). `db:test`
keeps using 16.

**Privacy:** a backup holds private player data, medical cards included.

- The folder and files are readable only by this Mac account (`umask 077`), and the disk is encrypted
  (FileVault).
- Keep backups out of iCloud Drive and other synced folders. That's why the default is in the home
  folder, not Documents or Desktop. Sending them to a sync service would add a provider the Privacy page
  doesn't name.
- `SUPABASE_SECRET_KEY` can read everything. It stays in `.env.local` on this Mac and never goes in
  Vercel. Add it with `bash scripts/set-secrets.sh`.

## Restoring (lost the Supabase project)

Into a **new, empty** project. `npm run db:restore` refuses a database that has any sign-in accounts,
teams or players, so it can't overwrite the live site.

1. Create a Supabase project (US East / Ohio, Postgres 17) and note its database password.
2. Put its settings in `.env.local`. Edit `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PROJECT_REF` and
   `SUPABASE_DB_HOST`, then run `bash scripts/set-secrets.sh` for the publishable key, password and
   secret key. `npm run db:check` should connect.
3. Push the migrations up to the backup's "Latest migration" (`manifest.txt`). If the repo has newer
   ones, move those files out of `supabase/migrations/` for now. Then `npm run db:push`.
4. `npm run db:restore -- ~/GGG.Cafe-backups/<date_time>`. Type the project ref to confirm.
   - It loads all the data in one transaction, with triggers off, so rows come back exactly as saved.
   - Then it uploads the files to the same buckets and paths. It never replaces a file that's already
     there.
   - If the secret key wasn't set yet, add it, then run
     `npm run db:restore -- <folder> --files-only`.
5. Put back any migrations you moved out in step 3, and `npm run db:push` again.

### After a restore (not in a backup; rebuild by hand)

- **Supabase Vault:** `jobs_secret` and `jobs_worker_url` (`docs/architecture/jobs.md`, setup).
- **Supabase Auth:**
  - Custom SMTP through Resend.
  - Site URL and redirect URLs.
  - The "Reset Password" email template link.
  - Rate limits.

  All in CLAUDE.md, under "Next.js 16 notes".
- **Vercel:** set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the new
  project, then redeploy. Resend, Zoom and `JOBS_SECRET` stay as they are (if the Vercel project was lost
  too, make new keys in Resend and Zoom).
- **Check:** sign in with an existing account, open a player, and open a page with a team logo.

## Not yet rehearsed

- **The test load covers only part of a backup.** It proves the app data loads and every count matches.
  It doesn't exercise:
  - loading sign-in accounts into a real Supabase Auth;
  - uploading files;
  - the steps after a restore.

  Do one full rehearsal into a spare project before relying on it. Phase 2 in `scaling.md` plans a
  staging project.
- **Supabase's own backups depend on the plan.** Check what yours keeps under Database → Backups in the
  dashboard.
