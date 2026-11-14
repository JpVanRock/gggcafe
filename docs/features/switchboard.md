# Switchboard (user, 2026-11-12; migration 20261112134451)
- A pill under the main menu (`components/switchboard-pill.tsx`, staff layout), head coaches and admins only, opens
  `/switchboard?team=`: per team, three groups (Players, Parents, Mentors) of on/off switches, "All on" / "All off" per
  group, the "Always on" items and why, and the team-code sign-up status (changed on the Roster tab).
- Keys, labels and groups: `src/lib/switchboard.ts` (`SWITCHES`, `ALWAYS_ON`, `SECTION_SWITCH`; unit-tested). Table
  `team_features_off` (a row = off; head-coach writes; staff read; players, parents (both ways) and mentors read their teams').
  Everything is on until switched off. Off hides it on the site and stops new posts; nothing saved is deleted.
- A player on several teams loses a feature when any of her current teams switches it off: `player_features_off(player)`
  (her, her parents, her mentors, staff), `private.feature_off_for_player()`. Coaches and admins always see everything.
- Where it applies:
  - Players: `requirePlayerPage(playerId, key)` on every section page sends a player or parent back to her menu
    (`?off=key`, which says so); the menu boards, the section bar and the From the Dugout strip leave out what's off.
  - Parents: the family page (budget, packet, questionnaire, View as, Yearbook, and since 2026-11-13 Calendar, Team
    Standards & Culture and Her goals; `requirePlayerPage` also sends a parent home when View as player is off), the family
    Yearbook and Calendar pages and the Yearbook's menu link. Her goals also hide when Goals is off for players.
  - Mentors: the mentor player and team pages hide the panels; the mentor actions refuse (`switchedOff()` in auth.ts); the
    database also refuses mentor messages and mentor training when off (restrictive policies on `mentor_messages` and
    `player_activities`).
- Always on (not switchable): TWIS, messages from mentors (set by Message players), the medical card, her login and
  parental consent, parents' oversight of mentors.
- DB tests: `tests/db/switchboard.test.sql`.

## Video calls (user, 2026-11-12)
Not a `team_features_off` switch. Above the three groups, site admins turn video calls on or off for the team
(`team_video_access`; head coaches see the state). Under Mentors, the head coach's "Video calls" switch
(`mentors_on`, off at first) shows once an admin has turned calls on. "All on" and "All off" leave it alone.
docs/features/video-calls.md.
