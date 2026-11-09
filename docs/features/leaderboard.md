# Offseason Training Leaderboard and + Activity (user, 2026-11-08)
- The "From the Dugout" strip on her dashboard has two more pills: Leaderboard
  (`/players/[id]/leaderboard?team=`) and + Activity (`/players/[id]/log`, log a session in a few taps).
- Points (user's system): 3 per site unlock (rings, Golden Gloves, MVP badges, Champions Trophy,
  Manager of the Year, hidden awards, training achievements; NOT the Leader Badge, which is private),
  3 per training session, 5 per workout, 7 per private lesson. Sessions = `training_logs` (+ Activity:
  her own, last 7 days, 4 a day; coaches remove any) plus checked-off TWIS routines with a training
  category (workout = 5, other categories = 3). Only dates inside the team's offseason count
  (`team_offseason`, coaches set it in Coaches Dugout → Calendar, user 2026-11-08; the grid marks the window).
- Player of the Week (`team_player_of_week`): Monday-Sunday, decided from the Tuesday after by
  `private.decide_players_of_week` (run inside `team_leaderboard()`): most points with at least 10;
  rounds, so nobody wins twice until everyone on the roster has been named (unless nobody new
  qualifies); never within six weeks of her last win. The user's goal: every player named at least once.
- Teammates see each other only through `public.team_leaderboard(team)` (definer; staff or a player on
  the team this season): names, numbers, points, weekly points, Players of the Week. Points and rules are
  in SQL (migration 20261108124500) and mirrored in `src/lib/leaderboard.ts` (no imports, unit-tested):
  change both together. DB tests: `tests/db/leaderboard.test.sql`.
- Page (user, 2026-11-08: "meant to be fun"): "Be the Best Version of You" header; standings end with
  Total (cumulative offseason points), no Player of the Week count column. The offseason dates appear only
  at the very top (subtitle); no links to change them on this page.
- Notifications (`notifications`, migration 20261108150000): each user sees and marks read only their own;
  only the database writes them. A new Player of the Week notifies every coach and admin. Coaches/admins
  get a bell with the unread count in the top menu (`unread_notifications()`, a plain count) and the list at
  `/notifications` (opening it marks them read). Finished weeks are decided by a daily pg_cron job at 09:00 UTC
  (`private.decide_all_players_of_week`, migration 20261109120000) and whenever a Leaderboard opens.
