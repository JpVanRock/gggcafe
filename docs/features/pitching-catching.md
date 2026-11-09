# Pitching & catching (SB Blueprint Phase 4, user 2026-11-08; migrations 20261109030000 + 030100)
- Battery IQ: `supabase/iq/battery.json` (60 questions, Levels 1-3, windmill from 43 ft, catcher back-picks, no pitcher
  pickoffs); same rules and UI as Offense IQ (MVP badges, `buildBadgeTracks` shows it once it has questions; labels
  in `src/lib/iq-tracks.ts`, shared by server and client). Open to everyone, aimed at pitchers and catchers.
- Scripted bullpens: coaches write `bullpen_scripts` per team in Coaches Dugout → Training → Bullpens (`bullpen-builder.tsx`;
  pitches {pitch, zone 1-9 or 11-14, intent strike/chase/up, count}); logic in `src/lib/bullpen.ts` (unit-tested). Pitchers
  (positions include P) see them on Performance Training (`pitching.tsx`), throw one at
  `/players/[id]/training/bullpen/[scriptId]` (`BullpenRunner`: tap Hit it / Missed) → `bullpen_sessions`; command % by
  pitch type. A pitching team routine can carry `bullpen_script_id` (copied by `sync_team_routine`); TWIS shows "Start".
- Pitcher's game plan: `pitcher_game_plans` (one per game; first pitch, out pitch, reset, hitters to watch; after: worked,
  fix, strike %) at `/players/[id]/training/game-plan`; the G3 Pitching chapter links to it (`tools: ["game-plans"]`).
- Mentors read bullpen sessions and game plans. DB tests: `tests/db/pitching.test.sql`.
