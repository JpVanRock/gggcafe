# Dugout Roster tab (`/dugout/roster`)
- "Waiting for approval" first (player claims + parent requests for the team, approve/decline in place),
  then the team code card for coaches (`dugout/team-code.tsx`: the code players, parents and assistant coaches sign up
  with; head coaches make a new one or turn sign-up off), then the season's roster with each player's account status (Claimed / Waiting) and approved parents,
  then player accounts (remove access), then "Move a player to another team" for coaches (`players/move-form.tsx`,
  `movePlayer`: pick her from the active roster, the new team (ours or another organization, never this one),
  season and jersey; her active spots go inactive but stay in her history, and she gets a spot on the new team).
  User, 2026-11-11: the move lives here on the coaches' page only, never on her Pop Report. Player intake button. The Roster tab, the Coaches Dugout nav link and
  the dashboard card show the waiting count (`pending_approvals()`). Shared pieces:
  `src/lib/approvals.ts` (loadTeamApprovals) and `dugout/approvals.tsx` (also used by the team page and
  the Parents tab).
