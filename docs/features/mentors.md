# Mentors (user, 2026-11-08; migration 20261108170000)
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
