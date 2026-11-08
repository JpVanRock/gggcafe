# GGG.Cafe — Project Context

Softball player-development and game-strategy database with a Next.js site.
Unrelated to investment-os — none of that project's rules, sources or database apply here.

GITHUB:   https://github.com/JpVanRock/gggcafe (public repo — never commit secrets)
DATABASE: Supabase project `vhvjoigbkyuebsduonpf` (US East / Ohio), settings in `.env.local`
SITE:     Next.js 16 App Router + TypeScript + Tailwind, `src/`.
HOSTING:  Vercel team "GGG", project `gggcafe`, https://gggcafe.vercel.app. Every push to main
          deploys to production. Vercel env vars: NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (never the DB password). Optional, server-only, for
          emailing practice plans: RESEND_API_KEY + EMAIL_FROM (see src/lib/email.ts).

@AGENTS.md

## Layout
```
src/app/                 pages (App Router): /, /login and /register are public; /family is the parents' home,
                         /me the players' home (claims; then her dashboard at /players/[id])
src/app/(staff)/         signed-in area with shared nav: dashboard (own view per role), teams, players
                         (each feature folder has page.tsx, actions.ts, client forms)
src/components/ui.tsx    shared page/form/table building blocks
src/lib/auth.ts          getCurrentUser, requireStaffPage, canEdit, editorCheck, isHeadCoach, headCoachCheck
src/lib/roles.ts         staff roles (Head Coach / Assistant Coach / Admin / Viewer), Dugout tabs per role
src/lib/form.ts          FormData readers + friendlyDbError for server actions
src/lib/softball.ts      positions, bats/throws, formats, row types (must match DB enums)
src/lib/supabase/        server.ts (Server Components/Actions), client.ts (browser),
                         env.ts, database.types.ts (generated: npm run db:types)
src/components/main-nav.tsx  top menu: staff get Dashboard/Coaches Dugout (opens Roster)/Teams/Players on every page,
                         including /me and /family; players get "My profile"
src/proxy.ts             refreshes the Supabase auth session each request (Next 16 "proxy", formerly middleware)
supabase/migrations/     schema, applied in filename order
supabase/seed.sql        fictional sample data — local tests only, never pushed
tests/db/                SQL checks run by npm run db:test
scripts/                 db-test.sh, db-push.sh, db-check.sh, db-types.sh (+ lib/env.sh)
tests/unit/              node --test unit tests (npm run test:unit)
```

## Database rules
- Every new table: `select private.apply_staff_rls('public.<table>');` (staff read, coach/admin write).
  Exceptions need their own explicit policies and a reason.
- Every view: `with (security_invoker = true)`, so RLS applies to the caller.
- Security-definer helpers go in the `private` schema (not exposed by the API) with `set search_path = ''`.
- Run `npm run db:test` before `npm run db:push`. It checks stat math, RLS on every table,
  security_invoker on every view, and the viewer/coach/admin access rules.
- Never edit an applied migration; add a new one (`npm run db:new <name>`).
- Never print or commit `.env.local`. The database password lives only there.

## Player dashboard (`/players/[playerId]`, cafe-menu design)
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
  on shelves (`iq_questions.section`, e.g. "Defense · Vocabulary"). One run deals the whole
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
  name and number on the plate's YEAR and NAME lines). Team logos (`teams.logo_url`, `team-logos` bucket) are no longer on
  the ring. Every test question has a `diagram` drawn by `src/components/diamond.tsx` (course quizzes:
  a scorebook box, page or field, `{"kind": ...}`): it shows the situation only, never the answer.
- Coaches/admins fill dashboards in; players with an approved claim can open and edit their own (see
  Player accounts below).

## Access FAQ (`/faq`, admins only, user 2026-11-08)
- Every player feature side by side for Standard Access (approved claim) and Advanced Access (G3
  Advanced), marked with softballs (`components/softball-icon.tsx`: included / not included / "Coach's
  OK" when a coach or admin must also pick or confirm her), then common questions. Content in
  `src/lib/access-faq.ts` (unit-tested): update it whenever a feature or its access changes. Admins
  get an FAQ link in the top menu; everyone else gets a 404.

## Account types (user, 2026-11-08; migrations 20261108210000 + 20261108210100)
- Five sign-ups at /register, each confirms its email first (Supabase Auth "Confirm email" is on; keep it on), each with
  its own home: Head Coach (staff role `coach`, an admin approves) and Assistant Coach (role `assistant`, picks the team,
  a head coach or admin approves) → /dashboard; Player → /me; Parent → /family; Mentor → /mentor. Admin (`admin`) isn't
  a sign-up: head coach + staff, mentors, G3 Advanced, FAQ. `viewer` stays as read-only staff (admins set it).
- Coach sign-ups: metadata `role` head-coach/assistant-coach (+ `team`, `note`); the first /dashboard visit after
  confirming calls `request_staff_access()` (table `staff_requests`); `staff_requests_to_decide()` /
  `decide_staff_request()` (admins any, head coaches assistants) add the `staff` row. Roster tab: "Coaches signing up"
  plus "Coaching staff" (admins change roles/remove, `roster/actions.ts`). Counts in `countWaiting()` (approvals.ts).
- Assistants: `private.can_edit()` includes them, `private.is_head_coach()` doesn't. Head-coach-only writes
  (`private.apply_head_coach_writes`): team_culture/standards, gameday_*, mentor_players; parent links, parent emails
  (`team_parent_links`), the team code (trigger), mentor message removal. Practice plans: everyone reads; assistants
  change only plans they created (`private.can_edit_plan`, `canEditPlanRole`); others show "View only".
  App: `src/lib/roles.ts` (labels, `dugoutTabsFor` hides Culture/GameDay/Parents/Mentors from assistants),
  `requireHeadCoachPage()` (404 for assistants) and `headCoachCheck()` in auth.ts. Bell: head coaches/admins only.
- Parent-made player logins (no email): on /family an approved parent creates a username + password for a daughter on
  the team's current roster (`create_player_login`: auth user at `<username>@player.gggcafe.invalid`, confirmed, plus an
  approved claim; `player_logins`). She signs in with the username (`signInEmail()` in `src/lib/player-logins.ts`);
  her parent or a head coach resets it (`reset_player_password`); forgot-password sends usernames to the parent.
- Admin FAQ second page `/faq/accounts` (content `src/lib/account-types.ts`, unit-tested; `FaqNav` links both pages):
  update it with any access change. DB tests: `tests/db/account_types.test.sql`.

## Team Yearbook (G3 Advanced, user 2026-11-08; migration 20261108190000)
- Season photos per team (`yearbook_photos`, tags `yearbook_photo_tags`). `private.yearbook_access(team)`:
  coaches/admins manage; view-only staff view; a parent whose approved daughter on the team has G3 Advanced
  adds (and edits/removes her own uploads); a player on the team with G3 Advanced views.
- Private bucket `yearbook-photos`, `<team>/<season>/<timestamp>-<random>.jpg` + `_t.jpg` thumbnail; the browser
  shrinks to 1600px and 480px before upload. Players and parents can't read other players' rows, so names
  (tags, roster for search) come only through `public.team_yearbook(team, season)`.
- One viewer for everyone, `components/yearbook-view.tsx` (+ `src/lib/yearbook.ts`, unit-tested): a cover,
  month-by-month spreads (feature photo, wide/tall tiles), a Thumbnails view, search by player, a full-screen
  view with caption, tags and edit/remove. Pages: `/players/[id]/yearbook` (the Yearbook pill between Team
  Culture and Leaderboard, only with G3 Advanced), `/dugout/yearbook` (from the Culture tab's "What players
  see" strip), `/family/yearbook` (a main menu item and a home card for parents with access).
- Storage (suggested to the user, not built yet): ~300 KB per photo with its thumbnail. Ideas: a storage meter
  and per-team/season cap in the Dugout; archive finished seasons (download a zip, then move originals to cheap
  object storage such as Cloudflare R2, keep thumbnails); WebP/AVIF; hash uploads to skip duplicates.

## Mentors (user, 2026-11-08; migration 20261108170000)
- Mentors and skill coaches (pitching, hitting...) are NOT staff. They sign up at /register ("Mentor", optional
  specialty in user metadata); an admin approves them (`mentors`, `pending_mentors()`); coaches/admins assign
  players (`mentor_players`). Coaches Dugout → Mentors (`dugout/mentors`): approve, calendar on/off and remove
  (admins), assign/unassign players and read/remove every message (coaches/admins).
- A mentor's home is `/mentor` (own layout); `/mentor/players/[id]` (her players only, else 404) shows Goals,
  Pop Report (Movement Preferences only if the player has G3 Advanced) and Mental GP read-only, reusing the
  player-page components with canEdit=false. RLS: `private.my_mentee_ids()` read policies on exactly those
  tables (+ teams, seasons, metrics, measurements, evaluations, photos). `getMentor`/`mentorCheck` in auth.ts.
- Messages (`mentor_messages`): text, a photo (private bucket `message-photos`, `<mentor uid>/<timestamp>.jpg`,
  shrunk to 1600px in the browser) and/or a drill (Drill Library `practice_drills`; she can add one first).
  The trigger sets sender name and copies the drill's name and video (players can't read the library). They
  show as "From your mentors" alerts at the top of the player's menu ("Got it" = read_at, the only column a
  player may change) and on `/players/[id]/messages`. Staff read all (oversight); coaches/admins remove.
- Calendar dates (only if `mentors.can_schedule`): one-day `player_activities` with `source = 'mentor'`,
  tagged "Mentor" in TWIS. Helpers in `src/lib/mentors.ts` (no imports, unit-tested). DB tests:
  `tests/db/mentors.test.sql`.

## Offseason Training Leaderboard and + Activity (user, 2026-11-08)
- The "From the Dugout" strip on her dashboard has two more pills: Leaderboard
  (`/players/[id]/leaderboard?team=`) and + Activity (`/players/[id]/log`, log a session in a few taps).
- Points (user's system): 3 per site unlock (rings, Golden Gloves, MVP badges, Champions Trophy,
  Manager of the Year, hidden awards, training achievements; NOT the Leader Badge, which is private),
  3 per training session, 5 per workout, 7 per private lesson. Sessions = `training_logs` (+ Activity:
  her own, last 7 days, 4 a day; coaches remove any) plus checked-off TWIS routines with a training
  category (workout = 5, other categories = 3). Only dates inside the team's offseason count
  (`team_offseason`, coaches set it in Coaches Dugout → Calendar, user 2026-11-08; the grid marks the window).
- Player of the Week (`team_player_of_week`): Monday-Sunday, decided from the Tuesday after by
  `private.decide_players_of_week` (run inside `team_leaderboard()`): most points with at least 10;
  rounds, so nobody wins twice until everyone on the roster has been named (unless nobody new
  qualifies); never within six weeks of her last win. The user's goal: every player named at least once.
- Teammates see each other only through `public.team_leaderboard(team)` (definer; staff or a player on
  the team this season): names, numbers, points, weekly points, Players of the Week. Points and rules are
  in SQL (migration 20261108124500) and mirrored in `src/lib/leaderboard.ts` (no imports, unit-tested):
  change both together. DB tests: `tests/db/leaderboard.test.sql`.
- Page (user, 2026-11-08: "meant to be fun"): "Be the Best Version of You" header; standings end with
  Total (cumulative offseason points), no Player of the Week count column. The offseason dates appear only
  at the very top (subtitle); no links to change them on this page.
- Notifications (`notifications`, migration 20261108150000): each user sees and marks read only their own;
  only the database writes them. A new Player of the Week notifies every coach and admin. Coaches/admins
  get a bell with the unread count in the top menu (`unread_notifications()`, which first decides finished
  weeks for every team in its offseason) and the list at `/notifications` (opening it marks them read).

## G3 Advanced (Level 2, `/players/[id]/advanced`)
- The advanced tier (user, 2026-11-07): admin-approved per player now, a paid subscription later
  (`player_advanced_access`, one row per player who has it, `source` admin|subscription; only admins
  insert/delete; `private.has_advanced()`). Until unlocked NOTHING about it shows: no menu board, no
  section-menu entry, pages 404 for non-admins. Admins see a slim "Unlock G3 Advanced" strip under a
  locked player's menu boards, and "Turn off" at the bottom of her book (her work is kept).
- It's her book on how to compete: default title "How to Cook" (user's choice; she can rename it,
  `player_advanced_books`), theme line "How to Compete". Content in `src/lib/advanced-book.ts`, which
  is paid content: import it from server code only, never from a "use client" file (client pieces
  get one chapter as props). Introduction "It Starts with Good Habits", then chapters from the user's
  "How to Compete?" sheet (Pre-Game, Between Innings, On-Deck Reps, Response to Failure,
  Communication, Regardless of Circumstances), then "coming" chapters (My Position, Hitting
  Approach, Mental Toughness: content later). ALWAYS leave room for more chapters: add an entry to
  `CHAPTERS` with a new permanent slug (numbers come from order; her work is keyed by slug).
- Each chapter: the question, why it matters, a pre-filled foundation of habits she marks "I own
  this", then she builds on it (her own habits, notes) and marks it complete
  (`player_advanced_chapters`). Players keep their own book only while they have access (RLS).
  Menu board variant `advanced`, placed before the Trophy Room; section menu entry after Softball IQ.
- Position chapters (user, 2026-11-07): a chapter with `requires: { position }` is only in the book
  of a player a coach has confirmed at that position (`player_confirmed_positions`; coaches/admins
  confirm on her book page, "Coaches · position chapters"; the player can read, not change, it).
  For everyone else it isn't listed, numbered, counted or readable (404), and saves are refused.
  Always build her book with `visibleChapters(book.confirmed)`. First one: "Pitching: My Best Is
  Better" (Focused Skill), from the user's pitching sheet, Chapter 7 for confirmed pitchers.

## G3 Leadership Guide (`/players/[id]/advanced/leadership`)
- Part of G3 Advanced, AND a coach/admin picks the player to train as a leader (user, 2026-11-08):
  `player_leadership_access`; `private.has_leadership()` = both. Coaches pick on her book page
  ("Train {name} as a leader"). Without both, players get 404s; staff see why it's closed.
- User's rules (2026-11-08): no quotes, simple, voice of a strong female athlete (never name or
  quote the athletes the user mentioned for the voice). No reference to any outside course, program
  or author anywhere on the site, in the code, comments or docs. Real people named in lesson
  examples are fine (user's choice). No trust falls in team-building (injury risk). Tailored to
  fastpitch (user, 2026-11-08): innings, at-bats, the dugout, the circle, bullpens and tee work, never
  halves, courts, shots or locker-room-only settings; examples from other sports get a softball version.
- Plan check-in dates become one-day TWIS activities (`player_activities.source = 'leadership-checkin'`,
  tag "Leadership"), kept in step whenever she saves or commits her plan (`syncCheckIns`: adds new dates,
  removes dropped ones, keeps the rest so check-offs stay). Left out of Manage activities; no points.
  Coaches/admins see the next two weeks of check-ins on their dashboard.
- Content in `src/lib/leadership-guide.ts` (paid content: server only, no imports, unit-tested):
  25 core lessons in parts (`CORE_PARTS`), 22 Extra Reps on shelves (`BONUS_SHELVES`, optional, any
  order, own progress, "X01"...), tools (`roles` 7 kinds of leaders, `engagement` five levels, `starters`,
  `habits` 44 grouped, `scenarios` 32 grouped with "A leader's move", `rubric` 13 areas rated 1-5 by
  her and her coach), My Leadership Plan (`/plan`), coach notes. Her work is keyed by lesson slug
  (`player_leadership_lessons`; slugs must never be "plan" or "certificate", which are pages).
- Completion (user, 2026-11-08): every core lesson complete + plan committed, then the coach signs
  off on the plan page, which awards the Certificate of Leadership and the Leader Badge
  (`player_leadership_certificates`: team at the time for the logo, coach's printed name).
  Taking the sign-off back removes both. Certificate page `/advanced/leadership/certificate`
  (`components/leadership-certificate.tsx`, printable: globals.css `.certificate-print` prints only the
  sheet, letter landscape). Team logo in the seal, GGG logo when the team has none. A blank line
  is left for the head coach to sign by hand (user, 2026-11-08), with the printed name under it.
- Leader Badge (`components/leader-badge.tsx`, hexagon, pink edge, neon chevrons) shows next to her name
  on her dashboard and next to her name on the Dugout roster. Visible ONLY to coaches/admins ("head
  coach") and the player herself: the certificates table is an RLS exception (no view-only staff).
- DB tests: `tests/db/leadership.test.sql`.

## Players page and intake (`/players`)
- Age-group tabs (All, 8U, 10U, 11U, 12U, 13U, 14U, 15U, 16U, 17U, 18U; `?age=16U`, keeps `?q=`) above the
  search. A player's age group is her current team's age group (user's rule): active roster entry in
  the latest season, `teams.age_group` read by `ageGroupOf()` in `src/lib/softball.ts`. The team form's
  Age group is a dropdown of the same groups so they stay consistent.
- Player intake (user, 2026-11-07: on the team, not the Players page): our team's page has a
  "Player intake →" button to `/teams/[teamId]/intake?season=` (also where a new own team lands right
  after it's created). New player: `players/intake-form.tsx` (name, date of birth, jersey number, class
  year, batting/throwing hand, positions; optional profile picture and up to three walk-up songs).
  Returning player: add her existing profile to this season (keeps history). Opponent teams keep the
  short roster form. "Edit profile" (Pop Report) uses the same fields (`player-fields.tsx`); coaches can
  also "Move to another team" (`move-form.tsx`): her active spots go inactive (history) and she gets a
  spot on the new team/organization.
- Profile pictures: PRIVATE bucket `player-photos` (photos of minors): staff read, coaches write;
  shown through signed URLs (`src/lib/player-photos.ts`). The browser shrinks photos to 900px JPEG
  before upload; replaced photos are deleted. Photo and walk-up songs show in the dashboard header.

## Movement Preferences and Preferred Hitting Style (Pop Report)
- Movement Preferences is a G3 Advanced feature (user, 2026-11-08): shown (Pop Report section, dashboard
  summary line, move dial, at-bat focus tip) and saved only for players with G3 Advanced; the player's
  read policy needs `private.has_advanced`. Without it nothing shows (admins see a slim locked note in her
  Pop Report); saved versions are kept. Preferred Hitting Style stays Standard.
- Background is the user's movement-preference booklet (2026-11-07): use its ideas, never name it or its
  company, never show testing steps, and write for a 10-year-old. Categories/choices come from the
  user's sheet (POP tab, column A); labels and plain-language text live in `src/lib/movement.ts`
  (`MOVEMENT`, `HITTING`; `coach` = the testing term coaches see in the editor).
- Movement Preferences: coaches set them (`movement_preferences`, versioned: every save is a new row,
  newest = current, history shown to coaches); players read. The move dial (`components/move-dial.tsx`,
  `moveDial()`): both feet, toes up; #1 = her strongest spot (from dial_one, else bouncy+leg = toes /
  grounded+leg = heel); #4 = heel behind a toes #1, or the other foot's toes for a heel #1; #2/#3 from
  space + breath (close+in or wide+out = #2 on the heel side), else "2/3". Breath also gives the at-bat
  focus tip (out = scarlet red, big picture first; in = royal blue, zoom in first).
- Preferred Hitting Style: the player herself or a coach changes it (`hitting_styles`, versioned; the
  player can only add rows in her own name; history shows who changed what).
- Pop Report coach notes (players.notes) are shown to coaches only.

## Dugout Roster tab (`/dugout/roster`)
- "Waiting for approval" first (player claims + parent requests for the team, approve/decline in place),
  then the season's roster with each player's account status (Claimed / Waiting) and approved parents,
  then player accounts (remove access). Player intake button. The Roster tab, the Coaches Dugout nav link and
  the dashboard card show the waiting count (`pending_approvals()`). Shared pieces:
  `src/lib/approvals.ts` (loadTeamApprovals) and `dugout/approvals.tsx` (also used by the team page and
  the Parents tab).

## Player accounts (claims) — user's choices: full edit, find her spot by name + jersey
- Teams have a coach `welcome_message` (team form). Players sign up at `/register` (Player/Parent toggle;
  players pick their team from `signup_teams()`), then `/me` shows the welcome message and "Claim my
  profile" (name + jersey; `request_player_claim()` matches her spot on the team's CURRENT season
  roster, else the coach matches it). Coaches approve on the team page (`teams/[teamId]/claims.tsx`,
  `team_player_claims()`); the nav shows a count and the dashboard a "Waiting for your approval" card
  (`pending_approvals()`, includes parent requests).
- Claims are per team + season (`player_claims`). A team's current season = its latest season with a
  roster (`private.team_current_season`). When a new season's roster starts, last season's claim stops
  giving access until she claims again (/me prompts her); her profile and history stay.
- An approved player (`private.my_player_ids()`) gets RLS access to her own data: reads her profile,
  roster history, teams + opponents, schedule, standards, measurements, evaluations, awards; full edit
  of her activities/routines, TWIS checks, Harada + SMART goals, Mental GP (goal method via
  `set_goal_method()`); she can't see teammates, coach notes, the Dugout or the staff list. Pages:
  `requirePlayerPage()` (staff or herself; `canAct` vs coach-only `canManage`), actions:
  `actForCheck(playerId)` / `actorCheck()` in `src/lib/auth.ts`.
- Softball IQ integrity: answer keys (`correct_index`, `explanation`) are not column-readable by anyone;
  `record_iq_answer()` grades and records every answer, `iq_answer_key()` returns keys (all for staff,
  answered ones for a player); `start_iq_level`/`finish_iq_level`/`iq_review_status` are definer
  wrappers that check `private.can_act_for()`. Players can't write answers or awards directly.
- DB tests: `tests/db/players.test.sql`.

## Coaches Dugout (`/dugout`, nav "Coaches Dugout")
- Header tabs (`dugout/tabs.tsx`): Roster (`/dugout/roster`, first: user 2026-11-08), Culture (`/dugout`; Team Standards + Team Culture), Calendar (`/dugout/calendar`),
  Practice Plans (`/dugout/plans`), GameDay (`/dugout/gameday`), Drill Library (`/dugout/drills`),
  Team Budget (`/dugout/budget`), Parents (`/dugout/parents`).
- GameDay (tab renamed from "GameDay Prep"; from the user's Lineup + Defensive Rotations tabs): season player cards
  (`gameday_profiles`: hitting type power/contact/gap, base running pure/intelligent/average, typed
  AVG/OBP/K% used only until box scores exist, `batting_season` wins) and game lineups
  (`gameday_lineups`: batting order uuid[], `defense` {rotation: {player: P..RF|Sub}}, `pitching`
  {rotation: primary/secondary/chase[]}, 1-7 rotations). The pitcher of a rotation is whoever plays P.
  Builder `gameday/[lineupId]/builder.tsx` (autosave, drag order, rotation checks); Finalize & Print
  (`/dugout/gameday/[id]/pdf`, `src/lib/pdf/lineup-pdf.tsx`, landscape lineup card) / Finalize & Share
  (`shareLineup`, same email/mailto flow; `ShareButton` takes the action and return path). Helpers in
  `src/lib/gameday.ts` (no imports; unit-tested). Team pills (`?team=`) appear when there is more than one own team.
- Team Budget, per team and season (`?season=`): registration costs every player owes (`budget_fees`,
  saved by `save_budget_fees`), per-player discount/extra charge (`budget_adjustments`), and the ledger
  `budget_entries` (kind payment/income/expense). Money math in `src/lib/budget.ts` (cents; no
  imports; unit-tested). Coaches/admins edit, other staff view.
- Parents (user's choice: sign-in accounts, team totals only): parents sign up at `/register` (name,
  email, password, team code, daughter's name) and land on `/family`. A coach turns on a 6-character
  team code (`teams.parent_code`, Dugout → Parents) and approves each request by matching it to a
  player (`parent_links`, status pending/approved/declined). Parents are not staff and can read no
  app tables; they get data only through security-definer functions: `parent_home()` (their links)
  and `team_budget_summary()` (staff, or approved parents of that team), which returns team totals,
  expenses/income and player payments as daily totals with no names. `components/budget-summary.tsx`
  draws it for parents and as the coaches' summary/"Parent view", with "Details" pop-ups listing each
  expense / income line item by category. Non-staff parents signing in are sent from /dashboard to
  /family (players to /me).
- Calendar: month grid Monday–Sunday (`?month=2026-11`; day-by-day list on phones) of `team_events`
  plus games (read-only; games are managed on the team page). These are the same events TWIS shows,
  so anything entered here appears in each player's TWIS. Only coaches/admins add, change or remove
  them (RLS on team_events; the UI is read-only for viewers). Weekly repeats share `series_id`
  ("This and later weeks" removes the rest); `updated_by` is set by trigger and shown as "Changed by".
  Event form parsing is shared with the team page in `src/lib/team-events.ts`.
- Team Standards (ordered list, title + optional detail) and Team Culture (optional headline +
  description, blank line = new paragraph) per team; saved together by the `save_team_dugout` RPC.
  Players see them in the "From the Dugout" strip above TWIS (`components/dugout-strip.tsx`): Team
  Standards / Team Culture pill buttons open pop-ups, one section per active own team.
- Drill library: `practice_drills` (shared by all teams), tags `drill_tag` (labels in `src/lib/dugout.ts`,
  user's list: infield, outfield, defense, catchers, pitchers, catchers & pitchers, warm-up routine,
  throwing routine), optional usual equipment and video link (`video_url`, https) copied into plans;
  "Watch the drill" shows in the library, builder, final plan and PDF.
- Practice plans: setup (date, start time, indoor/outdoor, total time, location, focus), then the
  builder (`plans/[planId]/builder.tsx`, @dnd-kit): drag library drills into the timeline (or + Add),
  reorder, each drill needs a time limit (required to finalize), coaches (staff coaches/admins or a
  typed name) and optional equipment; custom blocks (water break) have no drill_id. Drills are
  copied into the plan (`practice_plan_drills`) so printed plans don't change with the library.
  Field: drag players from the team's active roster (latest season) to positions, or tap a player
  then a position; several players can share a position and one player can be in several spots.
  Autosaves through the `save_practice_plan` RPC (one transaction; final plans raise P0004).
- Finalize & Print: finalizes, opens `/dugout/plans/[id]/pdf` (@react-pdf/renderer, `src/lib/pdf/`,
  DM Sans + Jost WOFF files and the logo PNG traced in via next.config.ts). Finalize & Share: pick
  coaches (`coaching_staff()` RPC: coach/admin emails, coaches only), emails the PDF through Resend;
  without RESEND_API_KEY/EMAIL_FROM it opens the coach's email app (mailto) instead.
  Final plans are read-only (`sheet.tsx`) until "Reopen to edit".
- Practice-plan math (clock times, totals, equipment checklist, finalize checks) lives in
  `src/lib/dugout.ts` (no imports; unit-tested). Field layout `FIELD_SPOT` is shared by web and PDF.

## Softball conventions
- Default format is fastpitch; `teams.format` allows slowpitch.
- Innings pitched are stored as outs (`outs_recorded`); display as `x.y` where y is 0–2.
- ERA and per-7 rates use 7-inning games: ERA = 7 × ER / IP.
- Box-score lines (`batting_lines` etc.) are the source of truth for standard stats.
  Play-by-play (`plate_appearances`, `pitches`) is optional detail for strategy views.
- Pitch zones: 1–9 strike-zone grid from the catcher's view, 11–14 outside quadrants.

## Design audience (user feedback, 2026-11-06)
Players are teenage girls (around 16). Everything must look age-appropriate: sleek and athletic,
like a sports brand or media-day graphics. Never childish or preschool.
- No cartoon doodles or clip-art (the hand-drawn bat/softball/star doodles were removed for this).
- No gold stars, stickers or emoji-style rewards; achievements use the hexagon badge.
- Prefer: outlined numerals (`OutlineText`, e.g. jersey number, section 01–05), thin speed stripes
  (`SpeedStripes`), sharp type, progress bars, real stats. Both live in `src/components/athletic.tsx`.
- Corners: `rounded-2xl` at most for boards and cards; no bubbly 2rem radii or dashed "craft" borders on
  boards (a dashed outline is fine for an empty-state placeholder).
- Copy: direct and confident, like a coach talking to a varsity athlete. No cutesy phrasing.
- The cafe-menu concept stays (numbered menu boards, "Full details →"), executed in this style.

## Brand
- Logo: `public/brand/ggg-cafe-logo.webp` (use `<Logo>` from `src/components/brand.tsx`);
  favicon/icons in `src/app/` are generated from it.
- Type logo "GGG.CAFE": `public/brand/ggg-cafe-wordmark.png` (transparent, `<Wordmark>`). It sits
  bottom-right on every page via `<SiteFooter>` in the root layout; keep pages from covering it. The logo lettering is Montecatini Pro
  (Louise Fili, commercial) and only appears as the image.
- Fonts (next/font/google, user's choice after a side-by-side test, 2026-11-07): DM Sans (`font-sans`,
  brand kit) for body and interface (text, buttons, navigation, forms, captions). Jost
  (`font-display`) for h1/h2 titles, tables, `dd` values, anything `tabular-nums`, outlined numerals
  and the award engravings: DM Sans has no tabular figures, so numbers wouldn't line up. The
  Jost rule lives in `@layer base` in globals.css, so `font-mono` (Space Mono) still wins.
- Brand kit (Edition 03, from the user; not in the repo): colors Navy #000A2D, Neon Yellow #E7FB06,
  Neon Pink #FE1F7C, White. The site tokens (`navy-950`, `neon`, `pink`) use exactly these values;
  hard-coded glows use the same RGB (0 10 45 / 231 251 6 / 254 31 124). Tagline "Elevate Together": use ONLY the supplied artwork
  (`public/brand/elevate-together-yellow.png`, `<Tagline>` in `src/components/brand.tsx`; custom
  lighter Permanent Marker), never retype it in the font, never lock it up with a logo, don't
  stretch/outline/add effects/recolor. Sign-in page: logo 8.4rem, tagline, "Good Vibes Only".
- Night Game (dark, default) / Day Game (white) switch at the top right (`src/components/theme-toggle.tsx`,
  `html[data-theme="day"]`, saved in localStorage `ggg-theme`, applied before paint by a script in the
  root layout). Day Game only re-maps tokens in `globals.css`, so use tokens by ROLE:
  `text-highlight` for emphasis text (neon at night, navy by day; never `text-neon`),
  `text-on-accent` for text on neon/pink fills (never `text-navy-950`), `bg-neon`/`bg-pink` for fills.
  `keep-night` keeps a piece in night colors (the field diagram; the navy chip behind the footer
  wordmark, which the brand kit approves only over navy). `day:` variant for Day-only tweaks.
  The sign-in tagline swaps to `elevate-together-navy.png` (same artwork, ink recolored to brand navy)
  in Day Game, with no panel behind it (user's choice).
- Text sizes (user, 2026-11-07): body text is one notch larger than Tailwind's defaults
  (`text-xs` 13px, `text-sm` 15px, base 17px; set in globals.css @theme). Titles (text-lg and up)
  are unchanged. Small headers (card section labels, DetailHeading, table headers) pin 12px with
  `text-[0.75rem] leading-4`.
- Use the tokens from `src/app/globals.css`, never zinc/gray or `dark:` classes:
  `navy-950` page, `navy-900` cards, `navy-800` hover/inputs, `navy-700/600` borders,
  `ink` text, `muted` secondary text, `neon` (brand yellow) primary-button fills, `highlight` titles/numbers,
  `pink` (logo pink) links/focus/selected/accents, `danger` errors.
- Page titles: uppercase, letter-spaced, neon, with a short pink rule (see `PageHeader`).

## Next.js 16 notes
- `middleware.ts` is now `proxy.ts` (export `proxy`).
- `cacheComponents` is on: anything reading cookies (any Supabase server query) must sit inside `<Suspense>`.
- Server-side Supabase `createClient()` calls `connection()` first, because Supabase's token-expiry
  check uses `Date.now()`, which Cache Components rejects during prerender/prefetch. Keep it.
- Password reset: /forgot-password emails a link (`resetPasswordForEmail`, redirect to
  /auth/confirm?next=/reset-password); /auth/confirm (route handler) signs her in from `?code=` or
  `?token_hash=&type=`; /reset-password sets the new password. Supabase Auth URL config: Site URL
  https://gggcafe.vercel.app, Redirect URLs https://gggcafe.vercel.app/** (localhost isn't listed).
- Auth: `getCurrentUser()` in `src/lib/auth.ts` (verified claims + staff record). `src/proxy.ts`
  redirects signed-out visitors away from `/dashboard`; pages still check staff access themselves.
- Read `node_modules/next/dist/docs/` before using an unfamiliar API.
