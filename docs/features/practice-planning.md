# Practice planning (SB Blueprint Phase 7, user 2026-11-08; migration 20261109060000)
- Install checklist (`/dugout/plans/install`, sub-menu `plans/plans-nav.tsx`): `install_items` per team (category
  position/situation, `group_name`, status not_started/taught/repped/game_ready, optional `iq_track` pointer), staff RLS
  (coaches and assistants write). "Load the starter checklist" (`STARTER_ITEMS`) adds what the team doesn't have yet.
  "Road to opening day": days to the first game (or the In-season phase), practices on the calendar before it (Calendar
  practices + plans), items to go and the pace; the preseason calendar lists those plans with their installs.
  Logic in `src/lib/install.ts` (no imports, unit-tested).
- Notes for players on every plan (`plans/[planId]/notes.tsx`, `savePlanExtras`; editable on final plans too, same edit
  rights as the plan): objective, rule of the day, announcements, coach-only notes (columns on `practice_plans`), a cue per
  player (`practice_plan_cues`, ≤120) and the installs it covers (`install_item_plans`). Players get them through
  `my_practice_notes(player, from, to)` (definer: her active teams' plans, her own cue only, never coach notes), shown in
  her TWIS cell on that day (`TwisCell.notes`).
- DB tests: `tests/db/practice_planning.test.sql`.
