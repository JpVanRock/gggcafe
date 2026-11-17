# Family & roster (SB Blueprint Phase 6, user 2026-11-08; migration 20261109050000)
- Medical & emergency card (`medical_cards`): ONLY head coaches/admins and her approved parents (user's rule; RLS exception,
  not assistants, viewers, mentors, teammates or the player). Parents use `parent_medical_card` / `save_parent_medical_card`
  on /family; head coaches see the team at `/dugout/roster/medical` (game-day quick view, "Medical cards →" on Roster).
- Preseason questionnaire (`player_questionnaires`, per team and current season: sizes for jersey/top, pants and socks,
  top three numbers, positions she wants, experience, goals). Parents only (user, 2026-11-10): filled in on /family through
  `parent_questionnaire` / `save_parent_questionnaire`; coaches see the team table on the Roster tab. Not on her Pop
  Report any more; teammates never. Jacket and hat sizes were dropped for socks (migration 20261111043342).
- Parent welcome packet (`parent_packet_items` letter/policy/tip, head-coach writes on the Parents tab with starter tips
  `PACKET_STARTERS`; `parent_packet_reads` per parent): approved parents read it on /family and mark items read
  (`private.my_parent_team_ids()`). Shared forms: `src/components/family-forms.tsx` (take the saving action as a prop).
  Logic: `src/lib/family.ts` (unit-tested). DB tests: `tests/db/family.test.sql`.
- Her mentors (user, 2026-11-11): a card per daughter on /family (approve or decline a mentor's request, remove one) and
  `/family/mentors` (every message, focus area and note about her). See `mentors.md`.
- Her login card on /family also carries verified parental consent for a daughter under 13 (signed form upload or a video
  call, checked by an admin; withdraw deletes her login): see player-accounts.md. Without a birth date on her profile the
  card asks the parent for it (user, 2026-11-16; `set_daughter_birth_date`: an approved parent, only while it's missing,
  4 to 25 years ago; a date already there stays the coach's to change). Making her login has no email and no confirmation.
- The team on /family (user, 2026-11-13), each behind its own parent switch (the Switchboard):
  - Coming up (`parent.calendar`): the next 8 team events and games in three weeks, by day (`loadComingUp` in
    `family/team-data.ts`, `comingUp`/`byDay` in `src/lib/family.ts`), and "Full calendar →" `/family/calendar`: the
    Dugout's month calendar (`CalendarView`) read only, one approved team at a time (`?team=`, `?month=`).
  - Team Standards & Culture (`parent.team`): standards, the culture statement and season goals, as on her Team page.
  - Her goals (`parent.goals`, and off when Goals is off for players): her dashboard's goal summary (Harada or SMART)
    and her commitment to each team (pledge line, signed or not), with "All her goals →" unless View as player is off.
  Parents read all of it through the "(parent view)" rules (no new access). Sections: `family/team-sections.tsx`.
- The family menu (user, 2026-11-13: cleaner and organized like the player dashboard's menu). /family is the media-day
  header (`MenuHeader`: "Family menu", their name, the team logo), the Yearbook banner first (user's choice), "Needs you"
  (`NeedsYou`: her consent, the medical card, the questionnaire, unread packet items, mentor requests, each linking to
  where it's done), video calls, Coming up, then numbered boards (`MenuPanel`): her goals (one per daughter), Team
  Standards & Culture, Team Budget, Mentors, Welcome packet, Team admin. Season forms and Logins & teams are in the page's
  hamburger menu, top left (`PageMenu` in `components/page-menu.tsx`, a badge when they need the parent; user, same
  day), and the header's menu no longer lists the Yearbook (its banner tops the page). Each board shows a
  short summary and opens its own page: `/family/team`, `/family/budget`, `/family/forms` (questionnaire and medical
  card), `/family/packet`, `/family/logins` (her login and consent, their teams; "Go to my dashboard →" right of the title, user
  2026-11-16), `/family/join` (Join another team: in the hamburger menu since 2026-11-16), `/family/mentors`
  (now with approving or declining a mentor's request at the top). Shared: `family/family-data.ts` (`loadFamily`: links,
  daughters, approved teams, switches; once per request) and `family/shell.tsx` (`FamilyShell`, `SectionTitle`, whose
  `action` sits right of the title). A parent with no team yet still sees the join form on /family.
- Joining (user, 2026-11-16: "If they have a team code they should not also need coach confirmation"; migration
  20261117010048). Parents join with the parent code (`team_parent_codes`, see account-types.md) and the daughter's name.
  `loadFamily` sends player accounts to /me (metadata role `player` or a player-login address: players see only the player
  view) and, on a parent's first visit (no `parent_accounts` row yet), joins with the code and name from sign-up, so
  there's no second form. A request that's still waiting shows "Waiting to join" on /family (`waiting-requests.tsx`):
  with the parent code, a form to fix her name to match the roster (`rematchParentLink`); for an old request made with
  the retired team code, a link to join again with the parent code. Since 2026-11-16 sign-up asks for no code: the
  family page's join form is where parents enter it.
- Her login from the dashboard (user, 2026-11-16: "Create a button on parent dashboard to 'Create Player Login'. Once
  created they should have a toggle view between parent view and player view"). The family page's header has a
  "Create Player Login" button per daughter on the current roster without a login ("Create Maya's Login" when there are
  several daughters), opening her card on Logins & Teams; the menu's Logins & Teams carries a "Her login" badge. Once she
  has a login, `ParentPlayerToggle` (`components/parent-player-toggle.tsx`, `loadPlayerViews`) shows "Parent view |
  Player view" ("Maya's view" per daughter when there are several): Player view is her pages read only (View as player),
  and the banner on her pages (`parent-view-banner.tsx`) carries the same toggle back. Not shown when View as player is
  off for her team. The parents' top menu says "Family menu" (it said Home), and sign-in sends parents straight to
  /family (`signIn` in `login/actions.ts` picks each account's home: staff /dashboard, parents /family, mentors
  /mentor, players /me).
