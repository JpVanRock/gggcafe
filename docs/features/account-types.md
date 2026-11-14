# Account types (user, 2026-11-08; migrations 20261108210000 + 20261108210100)
- Five sign-ups at /register, each confirms its email first (Supabase Auth "Confirm email" is on; keep it on), each with
  its own home: Head Coach (staff role `coach`, an admin approves) and Assistant Coach (role `assistant`, a head coach or
  admin approves) → /dashboard; Player → /me; Parent → /family; Mentor → /mentor. Admin (`admin`) isn't
  a sign-up: head coach + staff, mentors, G3 Advanced, FAQ. `viewer` stays as read-only staff (admins set it).
- Every sign-up checks the Terms of Service box, and players confirm they're 13 or older (younger players get a
  parent-made login); accounts without an agreement are asked once on /terms/accept (`docs/features/legal.md`).
- Account type is a dropdown (players and parents first). Team code (user, 2026-11-09; migration 20261109140000): one
  6-character code per team (`teams.team_code`, unique, no 0/O/1/I; `CODE_TYPES` in account-types.ts). Players, parents
  and assistant coaches enter it at sign-up; the action checks it with `signup_team(code)` (the only function signed-out
  visitors call: returns that one team, nothing for a wrong code; there's no team list) and saves the team in the
  account's metadata (`team`; parents also `team_code` + `child`, which fill in the /family join form). Coaches see the
  code on the Roster and Parents tabs (`dugout/team-code.tsx`); head coaches make a new one or turn sign-up off
  (`setTeamCode`, guarded by the `guard_team_code` trigger). Players without a team enter the code on /me (`findTeam`).
- Coach sign-ups: metadata `role` head-coach/assistant-coach (+ `team`, `note`); the first /dashboard visit after
  confirming calls `request_staff_access()` (table `staff_requests`); `staff_requests_to_decide()` /
  `decide_staff_request()` (admins any, head coaches assistants) add the `staff` row. Roster tab: "Coaches signing up"
  plus "Coaching staff" (admins change roles/remove, `roster/actions.ts`). Counts in `countWaiting()` (approvals.ts).
- Assistants: `private.can_edit()` includes them, `private.is_head_coach()` doesn't. Head-coach-only writes
  (`private.apply_head_coach_writes`): team_culture/standards, gameday_*, the Team Budget (budget_*); parent links, parent emails
  (`team_parent_links`), the team code (trigger), approving whole-team mentors (`decide_mentor_link`; a player's parents approve one for her, see mentors.md). Practice plans: everyone reads; assistants
  change only plans they created (`private.can_edit_plan`, `canEditPlanRole`); others show "View only".
  App: `src/lib/roles.ts` (labels, `dugoutTabsFor` hides Culture/GameDay/Parents/Mentors from assistants),
  `requireHeadCoachPage()` (404 for assistants) and `headCoachCheck()` in auth.ts. Bell: head coaches/admins only.
- Parent-made player logins (no email): on /family an approved parent creates a username + password for a daughter on
  the team's current roster (`create_player_login`: auth user at `<username>@player.gggcafe.invalid`, confirmed, plus an
  approved claim; `player_logins`). She signs in with the username (`signInEmail()` in `src/lib/player-logins.ts`);
  her parent or a head coach resets it (`reset_player_password`); forgot-password sends usernames to the parent.
  Her birth date must be on her profile (P0009), and under 13 the parent's verified consent must be on file first (P0008;
  see "Verified parental consent" in player-accounts.md).
- Admin FAQ second page `/faq/accounts` (content `src/lib/account-types.ts`, unit-tested; `FaqNav` links both pages):
  update it with any access change. DB tests: `tests/db/account_types.test.sql`.
- Admins' "View as" (user, 2026-11-12; migration 20261112011925): `/view-as` lists every parent and mentor, and
  Coaches Dugout → Parents / Mentors link each approved parent and working mentor. `/view-as/parent/[userId]` and
  `/view-as/mentor/[userId]` show that person's family page or mentor home, read only, from one call
  (`admin_view_parent` / `admin_view_mentor`, security invoker): after checking the caller is an admin it sets
  `request.jwt.claims` to that person for the rest of the call, so their own access rules and functions answer,
  then puts the setting back. Nobody signs in as anyone and nothing can be changed. `admin_account(user)` (definer,
  admins only) adds email, sign-up type, account and confirmation dates and last sign-in. `tests/db/admin_view_as.test.sql`.
- Parent View and Mentor View (user, 2026-11-14): on the Dugout's Parents and Mentors tabs admins get a "Coach view |
  Parent view" ("Mentor view") toggle (`ViewToggle` in `view-as/parts.tsx`), opening the team's first approved parent
  (working mentor) with `?team=`; a picker switches between that team's parents (mentors), and Coach view goes back. The
  View as pages now draw the page the way the person sees it: the Parent View with the family page's own builder
  (`familyMenu` in `family/menu-content.tsx`, `preview`: labels without links), the Mentor View in the mentor menu's
  layout. The account and troubleshooting facts follow under "Behind the page".
- Coaches who are parents (user, 2026-11-12; migration 20261112133311): coach sign-ups can tick "I'm also a parent" and
  name their daughter (metadata `coach_child`). The dashboard's "Also a parent on the team?" claims her from our current
  rosters (`claim_my_daughter`: makes the parent profile and a parent link per team; a head coach's or admin's is approved
  at once, an assistant's waits for the head coach). A coach with any parent link gets the Coach / Parent switch
  (`components/role-switch.tsx`) in the header: Coach = /dashboard, Parent = /family with the parents' menu. DB tests:
  `tests/db/coach_parents.test.sql`.
- Team admins (user, 2026-11-12; migration 20261112133709): the head coach makes an approved parent the team admin
  (Coaches Dugout → Parents, `set_team_admin`; table `team_admins`; `private.my_admin_team_ids()` needs the parent link
  still approved). They stay parents: a Coaches Dugout with three tabs (`TEAM_ADMIN_TABS`): Calendar, GameDay (all but
  sharing a lineup with the staff) and Measurements (`/dugout/measurements`, one measurement for the whole roster; staff
  use it too). Pages use `requireDugoutPage(area)` / `dugoutCanEdit`, actions `dugoutCheck(area, teamId)`; rosters come from
  `team_admin_roster()` (names, numbers, positions only: `loadRoster(..., { teamAdmin: true })`), never the players table.
  Team-admin policies cover team_events, gameday_*, depth_chart, the box-score lines and the game's score
  (`save_box_score` lets them), measurements for the team's current roster, and reads of the team, its roster, seasons,
  metrics and staff duties. The family page has a Team admin card; their menus get "Coaches Dugout". DB tests:
  `tests/db/team_admins.test.sql`.
