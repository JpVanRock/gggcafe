# Offseason training (SB Blueprint Phase 2, user 2026-11-08; migration 20261109010000)
- Coaches Dugout → Training (`dugout/training`, all coaches; sub-menu `nav.tsx`), logic in `src/lib/training-plan.ts`
  (no imports, unit-tested):
  - Roadmap: `training_phases` per team (kinds testing/build/sport/preseason/inseason/recovery); "Plan it backward from
    the championship" (`suggestRoadmap`: in-season from the first game, 3-week preseason, retest week, 6 weeks
    sport-specific, testing week then build). Players read their team's phases; TWIS shows "Build · Week 3 of 9" and the
    focus (`TwisWeek.phase`); the Dugout Calendar labels each phase's first day and outlines testing weeks.
  - Team routines (`team_routines`): copied into `player_activities` (source 'coach', `team_routine_id`) for the current
    roster by `sync_team_routine()`, re-synced on save and by a trigger on `roster_entries` (new players get them; players
    who leave have theirs ended). Restrictive RLS: players check them off but can't add, change or remove coach
    routines ("From your coach" in Performance Training and Activities). Remove = copies end, check-offs stay.
  - Testing (`/dugout/training/testing`): ten tests (`TESTS`; metrics added by the migration) saved as measurements
    (context "Testing"), rated 1-5 (Building..Elite) against starter bands for girls by age tier, or the coach's own
    (`test_bands`, per age group); composite = average rating on 100. Coaches see the team table; a player sees only her
    own (Performance Training, `testing-data.ts`). No public rankings.
  - Measurements (`/dugout/training/measurements`, user 2026-11-10): the built-in list every player's Pop Report shows by
    season, and the extras a team's coaches tick for their team (`team_measurements`, up to 20; players read their own
    team's list). See docs/features/player-dashboard.md.
  - Library: starter conditioning and landing/ACL drills (`drills.focus`: speed, agility, core, power, med-ball, landing).
  - Offseason draft (`/dugout/training/draft`, head coach/admin; user: the head coach names captains): `offseason_squads`
    + `offseason_squad_members` (captain = pick 0, snake order `onTheClock`), head-coach writes; players see squads via
    `team_squads()`; squad points = sum of members' Leaderboard points (`squadStandings`), shown on the Leaderboard.
  - Coach training (`/dugout/training/coach`, every staff member; user, 2026-11-12): the coaches' Mental Game course.
    See docs/features/mental-game.md.
- DB tests: `tests/db/training.test.sql`.
- Team Hitting Philosophy (`/dugout/training/hitting`) and Throwing Program (`/dugout/training/throwing?group=`; user,
  2026-11-12; migration 20261112132321): the head coach (and admins) writes them, every coach reads them. The philosophy is a
  statement and up to 12 titled sections; the throwing program is for position players, not pitchers, in three groups:
  Outies (outfielders), Innies (infielders) and Catchers, each an intro and up to 20 throws (name, reps/distance, cue).
  "Load the starter" fills the form with our own fastpitch starters (`src/lib/team-programs.ts`, unit-tested) to edit
  before saving. Tables `team_hitting_philosophy`, `team_throwing_programs` (jsonb typed in scripts/json-types.json).
  Players read their teams' on the Team page (`#hitting`, `#throwing`): her group comes from her first fielding position
  (`throwGroupFor`; P, DP, FLEX don't count, so a P/1B is an Innie and a pitcher alone sees none), with the SafetyNote.
  DB tests: `tests/db/team_programs.test.sql`.
