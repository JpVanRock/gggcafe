# Culture & team (SB Blueprint Phase 5, user 2026-11-08; migration 20261109040000)
- Head-coach work on Coaches Dugout → Culture (`culture-forms.tsx`, `culture-team.tsx`, actions in `dugout/actions.ts`):
  the season motto (`team_culture.motto`, shown in From the Dugout), Team Season Goals (`team_goals`: phase, optional
  target/progress by hand until box scores, achieved), the pledge tracker, and Player Spotlights (`player_spotlights`: the
  player's name and number are copied in so teammates can read them). Players on the team read goals and spotlights.
- Her commitment and the team pledge (`team_pledges`, per team and current season, plus a typed signature) on her Team
  page (`team-culture-client.tsx`, `culture-actions.ts`, `team-culture-data.ts`). One "I will..." that covers every Team
  Standard (user, 2026-11-11): the standards are listed, she writes once (`lines` = { all: … }, `cleanPledge`,
  `PLEDGE_MAX` 500). A pledge saved before, with a line per standard, still counts (`pledgeLine` joins them). Complete =
  written and signed. Logic: `src/lib/culture.ts`.
- Season goals are numbered 01, 02… in the order the coach entered them (`sortGoals` by `created_at`, user 2026-11-11),
  on the player's Team page and in the Dugout.
- The Team Culture box takes light formatting (user, 2026-11-11): B, I and U buttons wrap the selected words in
  `**bold**`, `*italic*` and `__underline__` (`components/format-toolbar.tsx`, `src/lib/rich-text.ts`), drawn by
  `<RichText>` wherever culture shows (`CultureStatement`). Parsed to React elements, never HTML.
- Spotlight media-day graphic: `/players/[id]/spotlight/[spotlightId]` (`keep-night` card).
- Leadership Guide Extra Reps: a "Know your why" shelf (3 reps; 25 Extra Reps now).
- DB tests: `tests/db/culture_team.test.sql`.
