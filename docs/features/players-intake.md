# Players page and intake (`/players`)
- Age-group tabs (All, 8U, 10U, 11U, 12U, 13U, 14U, 15U, 16U, 17U, 18U; `?age=16U`, keeps `?q=`) above the
  search. A player's age group is her current team's age group (user's rule): active roster entry in
  the latest season, `teams.age_group` read by `ageGroupOf()` in `src/lib/softball.ts`. The team form's
  Age group is a dropdown of the same groups so they stay consistent.
- Player intake (user, 2026-11-07: on the team, not the Players page): our team's page has a
  "Player intake →" button to `/teams/[teamId]/intake?season=` (also where a new own team lands right
  after it's created). New player: `players/intake-form.tsx` (name, date of birth, jersey number, class
  year, batting/throwing hand, positions; optional profile picture and up to three walk-up songs).
  Returning player: add her existing profile to this season (keeps history). Opponent teams keep the
  short roster form. "Edit profile" (Pop Report) uses the same fields (`player-fields.tsx`). Moving a
  player to another team is on the Dugout's Roster tab (see `dugout-roster.md`), not her profile.
- Profile pictures: PRIVATE bucket `player-photos` (photos of minors): staff read, coaches write;
  shown through signed URLs (`src/lib/player-photos.ts`). The browser shrinks photos to 900px JPEG
  before upload; replaced photos are deleted. Photo and walk-up songs show in the dashboard header.
