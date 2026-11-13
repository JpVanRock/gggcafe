# Coaches Dugout (`/dugout`, nav "Coaches Dugout")
- Header tabs (`dugout/tabs.tsx`): Roster (`/dugout/roster`, first: user 2026-11-08), Culture (`/dugout`; Team Standards + Team Culture), Calendar (`/dugout/calendar`),
  Practice Plans (`/dugout/plans`), Training, GameDay (`/dugout/gameday`), Playbook (`/dugout/playbook`), Drill Library (`/dugout/drills`),
  Budget (`/dugout/budget`; the tab says just "Budget" so the row fits, user 2026-11-12), Parents (`/dugout/parents`).
- GameDay (tab renamed from "GameDay Prep"; from the user's Lineup + Defensive Rotations tabs): season player cards
  (`gameday_profiles`: hitting type power/contact/gap, base running pure/intelligent/average, typed
  AVG/OBP/K% used only until box scores exist, `batting_season` wins) and game lineups
  (`gameday_lineups`: batting order uuid[], `defense` {rotation: {player: P..RF|Sub}}, `pitching`
  {rotation: primary/secondary/chase[]}, 1-7 rotations). The pitcher of a rotation is whoever plays P.
  Builder `gameday/[lineupId]/builder.tsx` (autosave, drag order, rotation checks); Finalize & Print
  (`/dugout/gameday/[id]/pdf`, `src/lib/pdf/lineup-pdf.tsx`, landscape lineup card) / Finalize & Share
  (`shareLineup`, same email/mailto flow; `ShareButton` takes the action and return path). Helpers in
  `src/lib/gameday.ts` (no imports; unit-tested). Team pills (`?team=`) appear when there is more than one own team.
- Team Budget layout (user, 2026-11-12): left column = Registration costs (collapsible like the other sections; its
  summary shows the per-player total, and it opens until costs are set), "Add an expense", "Discount or extra charge
  for a player" and "Outstanding Reimbursements" (repaying out-of-pocket items); right column = money coming in
  ("Record a player payment", "Add fundraisers or other income"), then "Tournament credit won or used" and "Out of
  Pocket Expenses". The income total is labeled "Fundraisers or other income".
- Team Budget, per team and season (`?season=`): registration costs every player owes (`budget_fees`,
  saved by `save_budget_fees`), per-player discount/extra charge (`budget_adjustments`), and the ledger
  `budget_entries` (kind payment/income/expense). Money math in `src/lib/budget.ts` (cents; no
  imports; unit-tested). Head coaches/admins edit (user 2026-11-08: assistants view only; migration 20261109100000),
  other staff view. Income sources include Fundraiser, Sponsor, Donation and Reimbursement (money back to the team).
  Player payments have a category (user, 2026-11-12; migration 20261112001052): Registration, Equipment or Other
  (`PAYMENT_CATEGORIES`; older payments without one count as Registration, `paymentCategory`). Only Registration
  counts toward the registration fees a player owes (`playerBalances`; the player table shows equipment and other
  payments in their own column); the summary's "collected" is registration payments, and equipment/other player
  payments count as other income. "Record a player payment" has the category and a full-width note; each
  payment in the ledger has Edit (category, how it was paid, note; `updatePayment`) as well as Remove.
  User, 2026-11-11 (migration 20261111234239):
  - Tournament credits: credit the team wins toward future entry fees and credit it uses, entered with their own
    form ("Tournament credit won or used"). User, 2026-11-12: kept apart from the team ledger and balance, in their
    own table (`budget_credits`, kind won/used; migration 20261112001755 moved any credit lines out of the ledger).
    The Tournament credits card keeps their running balance across seasons (`creditLedger`); using more than the
    balance is refused. The staff page notes the credit balance under the summary. Migration 20261112003427 moved
    the credit lines the old form saved during that deploy (dropping one exact duplicate) and the team ledger now
    refuses tournament-credit lines (`budget_entries_no_tournament_credit_check`). `team_budget_summary()` returns
    the team's credits (all seasons) as `credits`, which parents see in their own Tournament credits section with
    its running balance (`CreditsSummary`, below the budget on the family page and in the coaches' Parent view).
  - Coaches' out-of-pocket ledger (`budget_coach_expenses`, same access as the budget): what a coach (or a
    volunteer) paid with their own money, kept apart from the team balance (only a repayment from team money is a
    team expense, because that money leaves the team), with spent / repaid / still owed, who is
    owed what, and a running "owed" column (`coachLedger`, `coachTotals`). "Repay a coach" marks checked items
    repaid (`reimburse_coach_expenses`, one transaction) and, by default, records one "Out-of-pocket reimbursement"
    expense for their total in the team ledger; removing that expense (or Undo) makes the items owed again
    (trigger `unmark_coach_reimbursement`).
  - User, 2026-11-12 (migration 20261112004649): out-of-pocket expenses can be a coach's or a parent's (`paid_by_role`,
    chosen in "Out of Pocket Expenses"; this team's approved parents are suggested); the repayment expense is
    "Out-of-pocket reimbursement" (was "Coach reimbursement"), with no names because parents see expenses.
  - The general expense/income form leaves out "Out-of-pocket reimbursement" (`ENTRY_FORM_CATEGORIES`): repayments come
    from the coaches' ledger. Parents' totals (`team_budget_summary`) include reimbursements as ordinary income and
    expenses; tournament credits and the coaches' ledger aren't shown to parents.
  - Last updated (user, 2026-11-12): `budget_changes` keeps, per team and season, when anything in the budget last
    changed (registration costs, discounts, ledger lines added, changed or removed), written only by the trigger
    `note_budget_change` (staff read it; nobody sets it). `team_budget_summary()` returns it as `updated_at`, and
    `BudgetSummary` shows "Last updated" at its top, so parents (and the coaches' Parent view) see it.
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
  them (RLS on team_events; the UI is read-only for viewers). "+ Event" sits just left of the month
  arrows (user, 2026-11-11; + on a day starts the same form on that day). An event is one time or
  repeats (`components/repeat-fields.tsx`, rules in `src/lib/recurrence.ts`, unit-tested): every day,
  every week or every 2 weeks on chosen days, or every month (a month without that day is skipped),
  through an "Ends on" date; at most `MAX_OCCURRENCES` (150) dates per save, and a live line says what
  will be added. Each date is its own row sharing `series_id`. Changing one can cover "This and later
  ones in the series" (they keep their own dates); removing can too. `updated_by` is set by trigger and
  shown as "Changed by". Event form parsing (`readEventForm`, `readRepeat`) is shared with the team
  page's "Add to schedule" form in `src/lib/team-events.ts`.
- Team Standards (ordered list, title + optional detail) and Team Culture (optional headline +
  description, blank line = new paragraph) per team; saved together by the `save_team_dugout` RPC.
  Players see them in the "From the Dugout" strip above TWIS (`components/dugout-strip.tsx`): Team
  Standards / Team Culture pill buttons open pop-ups, one section per active own team.
  Saving never drops a saved standard (user's report, 2026-11-11: adding one from an old page wiped the others).
  `save_team_dugout` (migration 20261111054114) keeps each standard by id: the form sends each row's id, its new ones,
  and the ids the coach removed (`standard_removed`); only those are deleted. A row without an id but with a saved
  title is that standard (no duplicates from an older form); saved standards the form didn't mention stay, after its
  list. As a second guard the form carries the version it loaded (`standards-version.ts`: a hash of the standards,
  headline and statement) and the save refuses an out-of-date form with "reload". The form is keyed by the version, so
  after a save it starts over from what's saved. No history is kept of earlier lists.
- Coach's Responsibilities (user, 2026-11-11, from the user's own sheet): the first pill on the strip at the bottom of
  the Coaches Dugout (`coachResponsibilities` prop), coaches only. Sixteen responsibilities and "Teaching Creates
  Understanding" in `src/lib/coach-responsibilities.ts` (`key: true` = the ones the user set in bold), then
  Coaching Etiquette ("Creating a Habit of Excellence", four points; the sheet's "11 Strong" title left out, user's call).
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
- Team admins (user, 2026-11-12): a parent the head coach names gets only Calendar, GameDay and Measurements
  (`/dugout/measurements`, the team measurement grid, also linked from Training → Measurements). See account-types.md.

## Video calls (user, 2026-11-12)
Calendar → Video calls (coaches only, not team admins): every call on the team from the last 30 days and ahead;
head coaches book one with a player, and can cancel any. Off until a site admin turns calls on for the team.
docs/features/video-calls.md.
