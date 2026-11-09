# Culture & team (SB Blueprint Phase 5, user 2026-11-08; migration 20261109040000)
- Head-coach work on Coaches Dugout → Culture (`culture-forms.tsx`, `culture-team.tsx`, actions in `dugout/actions.ts`):
  the season motto (`team_culture.motto`, shown in From the Dugout), Team Season Goals (`team_goals`: phase, optional
  target/progress by hand until box scores, achieved), the pledge tracker, and Player Spotlights (`player_spotlights`: the
  player's name and number are copied in so teammates can read them). Players on the team read goals and spotlights.
- Her commitment and the team pledge (`team_pledges`, per team and current season: `lines` = standard title → her "I
  will..." line, plus a typed signature) on her Team page (`team-culture-client.tsx`, `culture-actions.ts`,
  `team-culture-data.ts`). Lines follow the current standard titles (`cleanLines`). Logic: `src/lib/culture.ts`.
- Spotlight media-day graphic: `/players/[id]/spotlight/[spotlightId]` (`keep-night` card).
- Leadership Guide Extra Reps: a "Know your why" shelf (3 reps; 25 Extra Reps now).
- DB tests: `tests/db/culture_team.test.sql`.
