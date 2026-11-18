# Account types (user, 2026-11-08; migrations 20261108210000 + 20261108210100)
- Four sign-ups at /register, each confirms its email first (Supabase Auth "Confirm email" is on; keep it on), each with
  its own home: Head Coach (staff role `coach`, an admin approves) and Assistant Coach (role `assistant`, a head coach or
  admin approves) → /dashboard; Parent → /family; Mentor → /mentor. Players don't sign up (user, 2026-11-16): a parent
  makes every player's login (below); players who signed up earlier keep /me. Admin (`admin`) isn't a sign-up: head
  coach + staff, mentors, G3 Advanced, FAQ. `viewer` stays as read-only staff (admins set it).
- Every sign-up checks the Terms of Service box; accounts without an agreement are asked once on /terms/accept
  (`docs/features/legal.md`).
- One code to join, entered after signing in (user, 2026-11-16: "Lets go with one code the parents code to join a team.
  Players will never be given this code"; "It just needs to be when you are first logged in and joining a team";
  migrations 20261117010048 + 20261117013057). Sign-up asks for no code. The team's one code is the parent code
  (`team_parent_codes`: one per team, 6 characters, no 0/O/1/I; staff read it, head coaches change it on the Parents and
  Roster tabs, `setParentCode`, `ParentCodeCard` in `dugout/team-code.tsx`; players never see it). Parents enter it with
  the daughter's name on /family (in at once on a name match, below), assistant coaches on /dashboard
  (`requestAssistantAccess`: `signup_parent_team(code)` finds the team, then `request_staff_access`), mentors on /mentor
  (`request_mentor`). Never give it to players: anyone with it can join as a parent of a girl on the roster.
  `signup_parent_team` is callable signed out, like `signup_team` (one team for a right code, nothing for a wrong one;
  there's no team list).
- The team code (`teams.team_code`, user 2026-11-09) is retired: players had it, so migration 20261117013057 cleared
  every team's, and the app no longer makes one (`setTeamCode`, `TeamCodeCard`, /me's `findTeam` are gone). The column,
  `signup_team` and the team-code branches in `request_parent_link` / `request_mentor` stay for the database tests; a
  code is never both (`guard_signup_code`).
- Parent code matching (user, 2026-11-16, migration 20261117010048: "If they have a team code they should not also need
  coach confirmation"). `request_parent_link` marks a request `via_parent_code`, and
  `private.match_parent_link` approves it at once when the daughter's name (`private.name_key`: case, accents,
  apostrophes and spacing ignored; first or preferred name + last name) matches exactly one player on the team's current
  roster, and notifies head coaches and admins (`parent-joined`, the bell). Everything else waits for the head coach: no
  match or two, or a parent declined on that team before. At most 6 requests per parent per team (54000).
  Player accounts (a player login, or a claim that isn't declined) can't join as parents (P0011). `rematch_parent_link`:
  a parent fixes the name on a waiting request. Removing a wrong parent: Remove access, and make a new parent code.
  DB tests: `tests/db/parent_codes.test.sql`.
- Coach sign-ups: metadata `role` head-coach/assistant-coach (+ `note`; older accounts `team`); the first /dashboard visit
  after confirming calls `request_staff_access()` (table `staff_requests`; an assistant with no team yet gets the
  "Join your team" code form, `AssistantJoin`, first); `staff_requests_to_decide()` /
  `decide_staff_request()` (admins any, head coaches assistants) add the `staff` row. Roster tab: "Coaches signing up"
  plus "Coaching staff" (admins change roles/remove, `roster/actions.ts`). Counts in `countWaiting()` (approvals.ts).
  The sign-up page (`NotStaff` in dashboard/page.tsx) shows where the request stands: waiting, not approved, or
  "No coach access" (approved, then removed from the staff: the request row stays approved). Every request is
  decided once (`STAFF_REQUEST` in `src/lib/lifecycles.ts`, guarded in the database; docs/architecture/state-machines.md).
- Assistants: `private.can_edit()` includes them, `private.is_head_coach()` doesn't. Head-coach-only writes
  (`private.apply_head_coach_writes`): team_culture/standards, gameday_*, the Team Budget (budget_*); parent links, parent emails
  (`team_parent_links`), the parent code (`team_parent_codes`), approving whole-team mentors (`decide_mentor_link`; a player's parents approve one for her, see mentors.md). Practice plans: everyone reads; assistants
  change only plans they created (`private.can_edit_plan`, `canEditPlanRole`); others show "View only".
  App: `src/lib/roles.ts` (labels, `dugoutTabsFor` hides Culture/GameDay/Parents/Mentors from assistants),
  `requireHeadCoachPage()` (404 for assistants) and `headCoachCheck()` in auth.ts. Bell: head coaches/admins only.
- Parent-made player logins (no email): on /family an approved parent creates a username + password for a daughter on
  the team's current roster (`create_player_login`: auth user at `<username>@player.gggcafe.invalid`, confirmed, plus an
  approved claim; `player_logins`). She signs in with the username (`signInEmail()` in `src/lib/player-logins.ts`);
  her parent or a head coach resets it (`reset_player_password`); forgot-password sends usernames to the parent.
  Her birth date must be on her profile (P0009; her parent adds it when it's missing, `set_daughter_birth_date`), and
  under 13 the parent's verified consent must be on file first (P0008;
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
- Parent View and Mentor View (user, 2026-11-14): on the Dugout's Parents and Mentors tabs admins get a "Preview as
  parent →" ("Preview as mentor →") link (`ViewToggle` in `view-as/parts.tsx`; a switch until the 2026-11-18 design audit),
  opening the team's first approved parent (working mentor) with `?team=`; a picker switches between that team's parents
  (mentors), and "← Back to the Coach view" goes back. The
  View as pages now draw the page the way the person sees it: the Parent View with the family page's own builder
  (`familyMenu` in `family/menu-content.tsx`, `preview`: labels without links), the Mentor View in the mentor menu's
  layout (`view-as/mentor/preview.tsx`, shared). The account and troubleshooting facts follow under "Behind the page".
  A team with no mentors yet (user, 2026-11-14: "the toggle for mentor view does not work") gets an example instead of a
  dead toggle: `/view-as/mentor/example?team=` draws a whole-team mentor's page with the team's real roster and schedule.
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
