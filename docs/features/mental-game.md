# Mental game (SB Blueprint Phase 1, user 2026-11-08; migrations 20261109000000 + 20261109000100)
- Standard tools on her Mental GP page (`mental-game.tsx`, forms `mental-game-client.tsx`, actions `mental-actions.ts`,
  data `mental-data.ts`, content `src/lib/mental.ts`, no imports, unit-tested): My signals (green/yellow/red + a
  release for yellow and red, her zone: columns on `mental_game_plans`), intensity checks 1-10 vs her zone
  (`mental_intensity_checks`), monthly self-scan of ten skills 1-5 (`mental_scans.scores`, order = `SCAN_SKILLS`,
  append only), guided breathing/imagery sessions (`/mental/session/[slug]`, `session-client.tsx`) and the practice
  journal (`/mental/journal?week=`: `journal_entries` per day, `journal_weeks` look-back; practice days marked).
- Guided sessions are training drills (`drills.guide` = slug, seeded) in the new `mental` training category: as a
  routine they show in TWIS with "Start →", "Log it" ticks today's check (streaks, achievements, "Locked In"), and
  `private.offseason_tally` leaves mental routines out of Leaderboard session points. TWIS items can carry a `link`
  (practice days: "Journal →").
- Mentors read her signals, intensity checks and self-scans, not the journal.
- G3 Advanced: the Mental Toughness chapter is written (no longer "coming"): a `course` of step-through lessons with
  quick checks (`CourseStep` in advanced-book.ts, `course-client.tsx`; place saved in
  `player_advanced_chapters.course_step/course_done_at`), then the foundation habits; "Mark chapter complete" waits
  for the course. Only append course steps at the end (saved places are step numbers).
- DB tests: `tests/db/mental.test.sql`.
