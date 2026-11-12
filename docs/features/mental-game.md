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
- Lessons (user, 2026-11-12; migration 20261112023653): eight Standard lessons first on her Mental GP (`#lessons`),
  content in `src/lib/mental-lessons.ts` (no imports, unit-tested; slugs are stored, never rename, append only), page
  `/mental/lessons/[slug]` (the idea, steps to build her own version, by position or situation, a rep for practice,
  "Lock it in", links to her Mental GP tools, prev/next; parts in `components/lesson-parts.tsx`).
  - They apply the skills to game moments and don't re-teach G3 Advanced (user, 2026-11-12, after an overlap review):
    the teaching stays in Mental Toughness, Hitting Approach and the habit chapters. `deeper` = G3 chapter slugs, shown
    as "Go deeper in G3 Advanced" only to players with G3. A unit test keeps lesson titles off the G3 titles.
  - Her answer to the lesson's question finishes it (`player_mental_lessons`: first `completed_at`; `saveMentalLesson`).
    Lessons with a `planField` (1 pre-pitch routine, 2 big-moment plan, 4 reset routine, 8 pre-game routine) save the
    answer into her Mental Game Plan (`mental_game_plans`) instead of the lesson row, so there's one copy; the lesson
    pre-fills from the plan. Only she sees the form; coaches and her parents read the answer. Mentors don't read lesson
    answers, but they do read her plan, so they see the four plan-field answers there.
  - "Up next": `nextLesson()` picks the first open lesson that builds her weakest skills on the latest self-scan
    (`skills` = `SCAN_SKILLS` keys; her top scores and a flat scan don't count), else the next in order.
- Coach training, "Coaching the Mental Game" (user, 2026-11-12): a separate course for coaches, never shown to players,
  in Dugout → Training → Coach training (`/dugout/training/coach`, `/dugout/training/coach/[slug]`, all staff). Nine
  modules in `src/lib/coach-training.ts`: why it matters, what to do, "say this / not this", one thing to try this
  week, a takeaway, the player lessons it goes with (`pairsWith`; every player lesson has one), and the coach's notes.
  The last module covers wellbeing and when to get help (988, parents, licensed professionals). Progress and notes in
  `coach_mental_lessons` (exception to staff RLS: each staff member keeps their own, viewers included; admins read
  everyone's and see a staff progress list). The course page also shows the team's progress on the player lessons.
- Mentors read her signals, intensity checks and self-scans, not the journal or her lesson answers (except what's in her plan).
- G3 Advanced: the Mental Toughness chapter is written (no longer "coming"): a `course` of step-through lessons with
  quick checks (`CourseStep` in advanced-book.ts, `course-client.tsx`; place saved in
  `player_advanced_chapters.course_step/course_done_at`), then the foundation habits; "Mark chapter complete" waits
  for the course. Only append course steps at the end (saved places are step numbers).
- DB tests: `tests/db/mental.test.sql`, `tests/db/mental_lessons.test.sql`; unit: `tests/unit/mental-lessons.test.ts`.
