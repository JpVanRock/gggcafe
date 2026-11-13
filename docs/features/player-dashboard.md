# Player dashboard (`/players/[playerId]`, cafe-menu design)
- Layout in `src/app/(staff)/players/[playerId]/player-menu.tsx`: menu header, "From the Dugout"
  strip, TWIS board, then menu boards. Each board shows a summary and LINKS to the section's own page
  (user, 2026-11-07: pages, not pop-ups): `/players/[id]/{goals,pop,mental,training,iq,trophies}`, plus
  `/team` (Team Standards & Culture, #standards / #culture) and `/activities` (TWIS "Manage
  activities"). They live in the `(section)` route group, whose layout gives every section page a
  "← Back to {Name}'s menu" link and a section menu bar (`(section)/section-nav.tsx`); pages wrap
  their content in `SectionShell` and check access with `requirePlayerPage()`.
- Add a future section: a page under `(section)/`, an entry in `SECTIONS` (section-nav.tsx) and in
  the menu's `sections` array (summary + href); add a board color in `menu.tsx` `BOARD` if needed.
- Pop-ups are only for small things: confirmations, Share, calendar event editing, and the Team
  Budget's line-item Details and "Parent view" (user kept those as pop-ups). Big views get pages.
- Section names (user's wording): "{Name}'s Goals" (Harada Method), "{Name}'s Pop Report",
  "Mental GP", "Softball IQ" (renamed from "IQ Test"), "{Name}'s Trophy Room". Pop Report fields are placeholders until the user specifies them.
- TWIS = This Week in Softball: team practices/events (`team_events`) and games for the player's
  active teams, plus `player_activities`; check-offs in `twis_checks`. Weeks start Monday;
  "today" uses `APP_TIME_ZONE` (default America/New_York) in `src/lib/dates.ts`.
- Harada charts save through the `save_harada_plan` RPC (one transaction, RLS applies).
- The top of her Goals page (user, 2026-11-10): "The Best Version of You" (`src/lib/best-version.ts`, the user's own
  framework in our words): what she wants (her roadmap), what it will cost (her time), the price of admission, would I
  want to be my teammate, then the 15 Minutes a Day Personal Challenge (what she'll do on her off days, with ideas and the
  SafetyNote). Answers in `player_best_version` (she and coaches write; view-only staff and her mentors read). Shown
  read-only on the mentor's page.
- Measurements on her Pop Report (user, 2026-11-10; `src/lib/measurements.ts`, `measurements.tsx`): one row per
  measurement, a column for each season of the softball year (Fall Season Sep-Nov, Winter Offseason Dec-Feb, Spring Season
  Mar-May, Summer Season Jun-Aug; set by the date measured; latest value per season) and her best. Defaults for every
  player: time to first, first to second, first to home, overhand throwing speed, rotational acceleration, connection score,
  on-plane score; fastball speed for pitchers, pop time for catchers (primary or secondary position); her team's extras
  (`team_measurements`, chosen in Dugout → Training → Measurements); anything else she's been measured on. Coaches add and
  remove values on her Pop Report; earlier years by `?year=`. Rows are `measurements` (Testing results land there too).
- Goals have two methods, chosen per player in the Goals pop-up (`players.goal_method`):
  Harada (full chart) or SMART (lighter; rows in `development_goals` with specific/measurable/
  achievable/relevant + target_date, optionally a metric target tracked against measurements).
  Switching never deletes the other method's goals.
- Performance Training: routines are `player_activities` with a `category` (workout, stretching,
  hitting, fielding, pitching for P, catching for C) and optional `drill_id` from the shared
  `drills` library. They appear in TWIS; check-offs drive consistency and achievements.
  Rules live in `src/lib/achievements.ts` (no imports; unit-tested with `npm run test:unit`).
  Earned achievements are stored in `player_achievements` when a box is ticked and never removed.
- Softball IQ (board formerly "IQ Test"): shared `iq_questions` bank (topic general/hitting/pitching/position) with a starter
  set seeded by migration; `iq_answers` per player. Correct answers are checked server-side
  (`answerIqQuestion`) so quiz questions are sent to the browser without them.
- IQ playbook levels: tracks `defense` and `baserunning`, Levels 1–3, up to 30 questions each (the
  user's cap; a level may hold fewer when the playbook runs out of distinct decisions), written from
  the user's Softball IQ Defensive / Baserunning Playbooks (original wording, page refs in
  `playbook_ref`), each with a `hint` that points the way without giving the answer.
- Position IQ (Golden Glove): track `position`, one level, 21 questions per fielding position
  (`iq_questions.position`); the player picks her position from a list (defaults to her primary).
  80%+ earns that position's Golden Glove (`player_golden_gloves`).
- Extra Credit Library (track `extra`): questions on what the playbooks teach that no test asks,
  on shelves (`iq_questions.section`, e.g. "Defense · Vocabulary"). Questions with `playbook_page: null`
  are written for GGG.Cafe: 13 added 2026-11-10 for game situations the bank lacked or barely had, the
  user's picks from the situation checklist (Defense · Pickoffs and rundowns, Cutoffs and backups,
  Situations, Reading the play; Baserunning · Reading the play, Batter-runner). One run deals the whole
  library; she answers in any order (shelf chips), with a hint on any question (`hint_used`), and
  progress saves. A run is graded only once every question is answered (`finish_iq_level` raises
  P0003 before that); 80%+ earns the GGG Champions Trophy (table `player_world_series_trophies`, named for its
  original "World Series" name; the user renamed it).
- How to Keep the Book (user, 2026-11-07): interactive scorekeeping course on the Softball IQ page,
  above the Extra Credit Library, from the user's scorekeeping guide for first-timers (original
  wording, adapted to fastpitch; Chapter 6 adds what the guide skips). Six chapters, each its own page
  `/players/[id]/iq/scorebook/[n]`: step-through lessons with a progress bar, quick checks, tap-to-
  explore pictures and tap-the-fielders exercises (content and the pictures' specs in
  `src/lib/scorebook.ts`, no imports, unit-tested; drawings in `src/components/scorebook.tsx`: one
  box, a page of the book, the field with position numbers). Lesson progress in
  `player_scorebook_progress` (players keep their own; `completed_at` opens the quiz). Each chapter
  ends with a 5-question quiz (track `scorebook`, level = chapter) run through the shared test flow;
  `start_iq_level` raises P0005 until the lessons are done and P0001 until the previous chapter is
  complete. 80%+ earns that chapter's Manager of the Year (`player_manager_awards`, written only by
  `finish_iq_level`). Course quizzes earn no MVP badges.
- Keep the Book games (extra credit, user's easter eggs, 2026-11-07): after all six chapters, the course
  card's "XC" row opens `/players/[id]/iq/scorebook/game`, TEN two-inning games (15 batters each)
  between six made-up teams (`LEAGUE`, `GAMES` in `src/lib/scorebook-game.ts`), each at
  `/game/[n]`. She keeps the book: for each batter she marks the batter's box and every runner's box
  (box editor with a play keypad) and `score_game_play` grades it against
  `private.scorebook_game_key` (source `supabase/iq/scorebook-games.json`, migration from
  `scripts/iq/build-game-key.py`; the unit test replays every game against its play-by-play:
  batting order, runners, outs, slash, RBIs, walk-offs, line score). Runs in `scorebook_game_runs`
  (`game`, her book so far, first-try count; answer shown after 3 wrong tries). A clean book = 12+ of
  15 first try and the right line score (`finish_scorebook_game`); it opens the next game (P0004 until
  then) and games can be replayed. Hidden awards (`player_hidden_awards`): the first clean book earns
  the GGG World Series Trophy (`world-series`; art `world-series-trophy.webp`, the user's original
  WORLD SERIES render); clean books in all ten earn the GGG Dynasty Trophy (`all-ten`; placeholder
  name in `src/components/dynasty-trophy.tsx`, same art as the Champions Trophy, user's choice). The
  rewards are mysteries: nothing names or shows them before they're earned (no Trophy Room
  placeholder or count); once earned they get shelves after Manager of the Year. Runners who reached
  on an error or fielder's choice are never put out later in a game: a box has one play field.
- MVP badge (`player_mvp_badges`, one per test): earned when `iq_review_status` finds every missed
  question answered again, or outright for a perfect score. Drawn by `src/components/mvp-badge.tsx`.
- Stolen Base Leader plaques: one per Baserunning IQ level, earned with that level's ring (no table).
  `src/components/stolen-base-plaque.tsx` engraves name and number on the gold bar, with
  "BASERUNNING IQ · LEVEL n · {Rookie|Varsity|All-American}" beneath.
- Trophy Room (`trophy-room.tsx`, last menu board, `trophy` board variant), shelves top to bottom:
  championship rings, Stolen Base Leader plaques, Golden Gloves, MVP badges, Manager of the Year (one
  per course chapter, all six shown), the hidden GGG World Series Trophy (only once earned),
  Performance Training achievements, then the GGG Champions Trophy at the bottom (user's order).
  Unearned ones dim.
- Question source of truth: `supabase/iq/{defense,baserunning,positions,extra,scorebook}.json`. After
  editing, generate a NEW migration with `scripts/iq/build-playbook-migration.py` (validates everything,
  slugs each question `{track}-{level}-{nn}` / `position-{pos}-{nn}` / `scorebook-{chapter}-{nn}` and upserts on the slug, so
  append rather than insert mid-level; questions dropped from the files are hidden, not deleted).
- Test flow (both kinds share it): `start_iq_level` enforces unlocking and deals the questions in a
  saved random order (`question_order`), resuming the open test if there is one (one open test per
  level/position; restart discards it). Answers save as they go, so a player can stop and pick up
  later; the UI shows a progress bar. `finish_iq_level` grades against the dealt questions
  (unanswered = wrong, 80% passes) and awards the ring (`player_rings`) or Golden Glove. After a
  test, "Review missed" re-asks each missed question once (`iq_answers.review_of`, `hint_used`
  when she asked for the hint); `iq_review_status` sets `reviewed_at` once all are done.
- Award art is the user's own renders, cut out to transparent WebP in `public/awards/`:
  `champions-trophy.webp` (band re-lettered CHAMPIONS), `stolen-base-plaque.webp` (acrylic see-through),
  `championship-ring.webp` (the GGG championship ring, reflection removed; every ring uses it,
  unearned ones dimmed gray; `src/components/rings.tsx`) and `golden-glove.webp` (trophy;
  `src/components/golden-glove.tsx` engraves her name, number, position and year on the gold plate
  as SVG text over the image) and `manager-of-the-year.webp` (shield plaque cut out of its dark studio
  background, floor reflection removed; `src/components/manager-award.tsx` engraves the year and her
  name and number on the plate's YEAR and NAME lines). Team logos (`teams.logo_path`, private `team-logos` bucket) are no longer on
  the ring. Her team's logo sits at the top right of her menu, across from "← Players" (user,
  2026-11-13; `playerTeamLogo()` in lib/team-logos.ts: her first active team with a logo; a parent
  viewing as her gets it through `parent_team_logos()`). Every test question has a `diagram` drawn by `src/components/diamond.tsx` (course quizzes:
  a scorebook box, page or field, `{"kind": ...}`): it shows the situation only, never the answer.
- Coaches/admins fill dashboards in; players with an approved claim can open and edit their own (see
  docs/features/player-accounts.md).
- My Journal (user, 2026-11-12; migration 20261112132733): `/players/[id]/mental/my-journal`, opened from a "My Journal"
  pill at the top of Mental GP (her and her parents only; user, 2026-11-12: not its own section or menu board; the old
  `/players/[id]/journal` redirects there). It closes with Mental GP, and with its own Switchboard switch. Her notes from mentor sessions: day, who it was with (one of her mentors from `player_mentors()`, or someone
  else by name), what they worked on, notes, and an optional voice memo recorded in the browser (MediaRecorder; WebM/Ogg
  Opus or MP4/AAC on Safari; stops at 5 minutes; uploaded to the private bucket `journal-audio` as
  `<player id>/<uuid>.<ext>`, played through signed URLs). Table `player_journal_entries`. Hers (user's choice): she writes,
  edits, deletes and shares; her approved parents read it (View as); she can share an entry with that mentor; coaches and
  admins read nothing (exception to apply_staff_rls), and their page says it's private. Helpers and limits:
  `src/lib/journal.ts` (unit-tested); actions `journal-actions.ts`; form `journal-client.tsx`. DB tests:
  `tests/db/journal.test.sql`.
- Her Team page also shows the Team Hitting Philosophy and her group's Throwing Program (see offseason-training.md).
- Sections her head coach switched off (the Switchboard) leave her menu, the section bar and the strip; their pages send
  her (and her parents) back to the menu with a note. See switchboard.md.

## Video calls (user, 2026-11-12)
Coming calls a mentor or head coach booked with her show above her menu, with Join (the call page opens 10
minutes early). Players and parents get the notifications bell for calls booked or cancelled.
docs/features/video-calls.md.
