# Mentors (user, 2026-11-08; approvals and coach notes 2026-11-11, migration 20261111222948)
- Mentors and skill coaches (pitching, hitting...) are NOT staff. They sign up at /register ("Mentor", the team code,
  optional specialty) and ask to work with ONE PLAYER (her name as on the roster) or THE WHOLE TEAM
  (`request_mentor(code, name)`; makes her `mentors` profile the first time; a request that didn't go at sign-up is
  sent from /mentor, filled in from her sign-up). User, 2026-11-11: the player's approved parents approve a one-player
  request (family page); a head coach approves a whole-team request (Coaches Dugout → Mentors); admins can approve
  either (`decide_mentor_link`). What she sees follows the approvals (`mentor_links`, status pending/approved/declined):
  a whole-team link = that team's current active roster; a player link = that player. `private.my_mentee_ids()`
  (used by every mentor read policy), `my_mentee_team_ids()`, `my_mentor_team_ids()` (whole-team links),
  `is_mentor()` (at least one approval). Whole-team requests count in the head coach's waiting count
  (`mentor_requests_waiting()`, also noted on the Roster tab). Her parents remove a one-player mentor; the head coach
  removes a whole-team one; admins remove a mentor account (Dugout → Mentors, "All mentor accounts").
- A mentor's home is `/mentor` (own layout): her requests (withdraw), each whole-team team with its roster
  (→ `/mentor/teams/[id]`: team focus areas, team notes, team training), her one-player players, training on their
  weeks, what she sent lately. `/mentor/players/[id]` (her players only, else 404): message her, working with her
  coaches (focus board + notes), her week (training), Goals, Pop Report (Movement Preferences only with G3
  Advanced) and Mental GP read-only, reusing the player-page components with canEdit=false. Helpers:
  `getMentor`, `getMentorAccess` (player ids, team ids, rosters, all mentee ids), `mentorCheck` in auth.ts;
  page pieces in `mentor/parts.tsx`.
- Messages (`mentor_messages`): text, a photo (private bucket `message-photos`, `<mentor uid>/<timestamp>.jpg`,
  shrunk to 1600px in the browser) and/or a drill (Drill Library `practice_drills`; she can add one first).
  The trigger sets sender name and copies the drill's name and video (players can't read the library). They
  show as "From your mentors" alerts at the top of the player's menu ("Got it" = read_at, only the player may
  change it) and on `/players/[id]/messages`. User, 2026-11-11: PRIVATE to the mentor, the player, her approved
  parents and admins unless the mentor shares it (`shared_with_coaches`, a box when she sends it, "Share with
  coaches" / "Stop sharing" after; only the sender changes it, guarded by a trigger). Coaches and view-only staff
  read shared messages only; head coaches remove a shared one, admins any.
- Working with the coaches (user, 2026-11-11), about one player or the whole team (whole-team mentors):
  `mentor_focus` (focus areas: "Working on" / "What's working", the mentor adds, moves and removes her own) and
  `mentor_notes` (a thread per mentor and player/team: discussion summaries with the day they talked, notes, and
  head coaches' replies; author name and role from the database). Coaches read every thread (Coaches Dugout →
  Mentors → a mentor's "Focus areas & notes", `/dugout/mentors/[mentorId]?team=`, with a reply box); her approved
  parents read the ones about their daughter (not whole-team ones); players never see them. Shared UI:
  `components/mentor-work.tsx` (FocusBoard, NotesThread, NoteForm, FocusForm).
- Training on her players' weeks (user, 2026-11-11: every mentor, no admin switch; `mentors.can_schedule` is gone):
  `player_activities` with `source = 'mentor'`, tagged "Mentor" in TWIS, for one player or every player she ticks
  (a team's roster, her one-player players), once or every week on chosen days through an end date (a year at
  most; `mentorTraining` in `src/lib/mentors.ts`, unit-tested). A session sent to a group comes off in one go.
- Parents (`/family`): a card per daughter with mentor requests (approve/decline), her mentors (remove one-player
  ones; whole-team ones are listed), and `/family/mentors?player=` with every message, focus area and note about her.
- DB tests: `tests/db/mentors.test.sql`. Sample data: the sample admin is a whole-team mentor (and parent of Maya and
  Emma) so the mentor, Dugout and family mentor pages render in the smoke test.
- Coaches Dugout → Mentors opens with the team motto (`team_culture.motto`, set in Culture) and five ways great mentors
  lead, drawn from the G3 Leadership Guide's lessons (`MENTOR_WAYS` in `dugout/mentors/page.tsx`: earn trust first,
  listen more than you talk, lift her higher, make the people around you better, train the next leader). The
  approval and privacy details sit under "How mentoring works" (user, 2026-11-12).
- My Journal (user, 2026-11-12): a player can share one of her journal entries (notes and/or a voice memo) with the
  mentor it's about; that mentor sees it on `/mentor/players/[id]` under "From her journal" (only while they still work
  with her). See player-dashboard.md.
- The Switchboard (user, 2026-11-12) can turn off, per team, Message players, Add training, Focus areas & notes, and what a
  mentor sees (Goals, Pop Report, Mental GP, shared journal entries). See switchboard.md.

## Video calls (user, 2026-11-12)
Where a site admin turned video calls on for her team and the head coach switched them on for mentors, the
player page has a Video calls panel: book a Zoom call with her, held on GGG.Cafe; her parents are told and can
join, and head coaches can drop in. Mentors get the notifications bell (a head coach cancelling one of their
calls). docs/features/video-calls.md.

## My roster and calendar (user, 2026-11-13)
- `/mentor` groups every player she mentors under "My roster" (by whole-team team, then One-on-one). Each tile opens the
  player's page and has links straight to her Goals, Pop Report and Mental GP (`MENTOR_SECTIONS` in `mentor/parts.tsx`,
  `#goals`, `#pop`, `#mental` on `/mentor/players/[id]`, which also has those links under her name). A link goes when
  the head coach turned that section off for mentors (`getPlayerFeaturesOff` per player).
- `/mentor/calendar` ("Calendar" in the mentor menu): her own month, view only, in the Dugout's `CalendarView`: the
  training she put on her players' weeks (`trainingDates` in `src/lib/mentors.ts`; a session sent to several players
  is one entry naming them) and the video calls she booked (`callDateAndClock` in `src/lib/video-calls.ts`), plus her
  players' team practices, events and games (user, 2026-11-13; migration 20261114010911). Mentors still can't read
  `team_events`, `games` or other teams: `mentor_calendar(from, to)` (definer, at most about two months) returns only the
  calendar rows for her players' current teams (whole-team links, and her one-on-one players' teams this season) with
  the opponent's name. The Switchboard's "See the team calendar" (`mentor.calendar`) hides a team's, in the database.
  DB tests: `tests/db/mentors.test.sql`.
