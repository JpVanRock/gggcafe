# Game-day production (SB Blueprint Phase 9, user 2026-11-08; migration 20261109080000)
- GameDay lineups gained DP/FLEX (`dp_player_id` bats; `flex_player_id` fields only and is the extra line after the order;
  `dpFlexProblems`, `fieldingPlayers` in `src/lib/gameday.ts`; the depth-chart fill uses the fielding players), game-day
  jobs (`jobs` [{job, who}], "Fill from staff duties" = the matrix's "during the game" lines with an owner) and the
  in-game substitution log (`sub_log`, `SubTracker` in `gameday/[lineupId]/subs.tsx`, saved by `saveSubLog` on final
  lineups): `trackSubs()` applies the re-entry rule (a starter re-enters once, in her own spot; a sub who leaves is done;
  nobody holds two spots). The umpire exchange card is `/dugout/gameday/[id]/pdf?card=umpire` (half-letter; order,
  number, name, position from rotation 1, DP and FLEX, substitutes, head coach signature line); the lineup card PDF
  prints the FLEX line and the jobs.
- Staff duties & standards (`/dugout/roster/staff`, linked from Roster; head-coach writes, every coach reads):
  `staff_duties` (phase practice/pregame/game/postgame/season, duty, owner) and `staff_standards` (commitment,
  pre_practice). Starters and helpers in `src/lib/staff-duties.ts` (no imports, unit-tested).
- Box scores (migration 20261109090000): GameDay → Box scores (`/dugout/gameday/box`, `box/[gameId]`, `box-form.tsx`):
  batting, pitching (IP typed "4.2", stored as outs), fielding, the final score (marks the game final) and an optional
  0-5 grade per plate appearance (`pa_grades`), all saved by `save_box_score` (invoker, one transaction, RLS). Order comes
  from the game's GameDay lineup (`gameday_lineups.game_id`) when there is one. Checks in `boxProblems()` mirror the DB.
- Quality at-bats and BP production: `QAB_SCALE` (fastpitch: an executed slap or bunt is a 5), 3+ = quality; `qab_season`
  view. BP rounds (Training → BP rounds, `/dugout/training/bp`, keypad `bp-form.tsx`): `bp_rounds.grades` 0-5 per swing;
  production = average grade. Leaderboard: top five with 20+ swings in the offseason window (`team_bp_leaders`, definer).
- "How it's figured": `src/lib/stat-formulas.ts` (`STAT_INFO`; ERA and per-7 on 7 innings) + `components/stat-term.tsx`
  (tap the abbreviation). Used on her stats card (`players/[playerId]/stats-card.tsx`, Pop Report: players now read their
  own batting/pitching/fielding lines), GameDay player cards, BP rounds and the Leaderboard.
- Logic in `src/lib/box-score.ts` (no imports, unit-tested). DB tests: `tests/db/gameday_production.test.sql`,
  `tests/db/box_scores.test.sql`.
