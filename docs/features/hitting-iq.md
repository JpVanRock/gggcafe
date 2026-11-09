# Hitting & Softball IQ (SB Blueprint Phase 3, user 2026-11-08; migrations 20261109020000-020200)
- Offense IQ: track `offense` (Battery IQ, `battery`, is Phase 4), Levels 1-3, 20 questions each in
  `supabase/iq/offense.json` (written for GGG.Cafe: `playbook_page` null, ref "GGG.Cafe Offense IQ · topic"; diagrams can
  carry `count` {balls, strikes}, drawn by diamond.tsx). User's rule: the award is the MVP badge, no ring. A passed
  attempt unlocks the next level (`start_iq_level_unchecked`); `finish_iq_level_unchecked` gives no ring for
  offense/battery. UI: `buildBadgeTracks` (iq.tsx) and `BadgeTrackPicker` (iq-tests-client.tsx); Trophy Room labels the badges.
- New questions for the existing tracks: 7 baserunning reads (Levels 2-3, now 30 each) and 5 defensive situations on
  the Extra Credit Library's "Defense · Situations" shelf (the defense levels are at the cap).
- My Zone (Standard): `hitting_zones` (hot/strong/weak cells 1-9, catcher's view, each cell in one list; she or a coach
  edits, mentors read) in the Pop Report next to Preferred Hitting Style (`my-zone.tsx`, editor `zone-client.tsx`, grid
  `components/zone-grid.tsx`); `countPlan()` in `src/lib/my-zone.ts` (unit-tested): 0 strikes her pitch, 1 strike what
  she handles, 2 strikes protect, battle on weak spots.
- G3 Advanced: the Hitting Approach chapter is written (course + habits) and shows her count plan (`tools: ["count-plan"]`).
- DB tests: `tests/db/hitting_iq.test.sql`.
