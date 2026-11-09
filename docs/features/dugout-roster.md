# Dugout Roster tab (`/dugout/roster`)
- "Waiting for approval" first (player claims + parent requests for the team, approve/decline in place),
  then the season's roster with each player's account status (Claimed / Waiting) and approved parents,
  then player accounts (remove access). Player intake button. The Roster tab, the Coaches Dugout nav link and
  the dashboard card show the waiting count (`pending_approvals()`). Shared pieces:
  `src/lib/approvals.ts` (loadTeamApprovals) and `dugout/approvals.tsx` (also used by the team page and
  the Parents tab).
