# Account types (user, 2026-11-08; migrations 20261108210000 + 20261108210100)
- Five sign-ups at /register, each confirms its email first (Supabase Auth "Confirm email" is on; keep it on), each with
  its own home: Head Coach (staff role `coach`, an admin approves) and Assistant Coach (role `assistant`, a head coach or
  admin approves) → /dashboard; Player → /me; Parent → /family; Mentor → /mentor. Admin (`admin`) isn't
  a sign-up: head coach + staff, mentors, G3 Advanced, FAQ. `viewer` stays as read-only staff (admins set it).
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
  (`private.apply_head_coach_writes`): team_culture/standards, gameday_*, mentor_players, the Team Budget (budget_*); parent links, parent emails
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
