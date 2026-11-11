# Coaches Dugout (`/dugout`, nav "Coaches Dugout")
- Header tabs (`dugout/tabs.tsx`): Roster (`/dugout/roster`, first: user 2026-11-08), Culture (`/dugout`; Team Standards + Team Culture), Calendar (`/dugout/calendar`),
  Practice Plans (`/dugout/plans`), Training, GameDay (`/dugout/gameday`), Playbook (`/dugout/playbook`), Drill Library (`/dugout/drills`),
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
  imports; unit-tested). Head coaches/admins edit (user 2026-11-08: assistants view only; migration 20261109100000),
  other staff view.
- Parents (user's choice: sign-in accounts, team totals only): parents sign up at `/register` (name,
  email, password, team code, daughter's name) and land on `/family`. A head coach turns on the team's
  6-character team code (`teams.team_code`, Dugout → Roster or Parents; players and assistant coaches use the
  same code, see account-types.md) and approves each request by matching it to a
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
- Coach's Responsibilities (user, 2026-11-11, from the user's own sheet): the first pill on the strip at the bottom of
  the Coaches Dugout (`coachResponsibilities` prop), coaches only. Sixteen responsibilities and "Teaching Creates
  Understanding" in `src/lib/coach-responsibilities.ts` (`key: true` = the ones the user set in bold).
- Drill library: `practice_drills` (shared by all teams), tags `drill_tag` (labels in `src/lib/dugout.ts`,
  user's list: infield, outfield, defense, catchers, pitchers, catchers & pitchers, warm-up routine,
  throwing routine), optional usual equipment and video link (`video_url`, https) copied into plans;
  "Watch the drill" shows in the library, builder, final plan and PDF.
- Practice plans: setup (date, start time, indoor/outdoor, total time, location, focus), then the
  builder (`plans/[planId]/builder.tsx` with its parts `builder-library`, `builder-timeline`, `builder-field`, `builder-shared`; @dnd-kit): drag library drills into the timeline (or + Add),
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
