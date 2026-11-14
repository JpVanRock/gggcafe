# Video calls (Zoom, inside the site)

User, 2026-11-12. Mentors and head coaches book a Zoom call with one player. The call happens
on a GGG.Cafe page (`/calls/<id>`), not in a separate Zoom window, and her parents are invited
to every call.

## Who can do what
- **Site admins** turn video calls on or off for each team (Switchboard → Video calls (Zoom)).
  Every team starts off. While a team's calls are off, nobody on that team can book, start or
  join one, including calls already booked.
- **Head coaches**, once a site admin has turned calls on for their team:
  - book calls on Coaches Dugout → Calendar (pick a player);
  - can drop in on any call on the team;
  - can cancel any call;
  - decide whether mentors can book calls (Switchboard → Mentors → Video calls, off at first).
- **Mentors** book calls on a player's page (`/mentor/players/<id>`). This needs both the
  admin's switch and the head coach's switch to be on, for every one of her current teams.
- **The player and her approved parents** are told of every booking and cancellation (the bell).
  They see coming calls on her dashboard and on the family page, and join from the call page.
- **Assistants and viewers** see the calls on the Calendar but can't book or join them.
- **Which calendars show a call** (user, 2026-11-14; migration 20261114160922, `video_calls.calendars`):
  picked on the booking form's "Show on calendars" dropdown, all ticked to start: Her week (This Week on
  her player page), Her parents' calendar (the family Calendar) and, for a mentor's call, the Coaches
  Dugout calendar. The booker's own calendar always shows it: a head coach's is the Dugout calendar (the
  database requires `coaches` on a coach's call), a mentor's is their mentor calendar (every call they
  host). Each entry links to the call page (`src/lib/call-events.ts`; on her week, a "Video call" line
  with Open, not a check-off). It only changes the calendars: her parents are still told of every call,
  her dashboard and the family page still list her coming calls, and the Dugout's Video calls list has
  them all. Calls booked before it show on every calendar.
- **A player on more than one team** needs every one of her teams to allow calls. This is the
  same rule as the Switchboard.

## Safeguards
- **Parents:** her parents are invited to every call and told when one is booked or cancelled.
  Head coaches are told of every mentor's call and can drop in.
- **Waiting room:** it's on, and nobody gets in before the host. The host starts the call from
  the site; Zoom only gives the host's key (ZAK) to the person who booked it, while the call is
  open.
- **Recording:** none. Turn recording off in Zoom's account settings too (setup below).
- **What people see in the call:** no passcode, meeting number or invite link, only the topic,
  the host and who's there. Each person joins under their own name: "Name (parent)" or
  "Name (coach)".
- **What the database stores:** only Zoom's meeting number. The passcode and keys are fetched
  from Zoom when someone joins. The Zoom meeting's title names nobody ("GGG.Cafe video call").

## Rules
- A call is 15, 30, 45, 60 or 90 minutes long and is booked 5 minutes to 90 days ahead.
- Each person books at most 4 calls an hour (user, 2026-11-13), checked before the site asks Zoom
  and again in the database (migration 20261113130143).
- The call page opens 10 minutes before the start and closes 15 minutes after the planned end.
- **One call at a time across the whole site.** Every call is booked under one licensed Zoom
  user, and a Zoom user hosts one meeting at a time. The database refuses an overlapping
  booking. Allowing calls at the same time would need more licensed hosts and a code change.
- **Cancelling:** the host or a head coach cancels. The record stays and Zoom's meeting is
  deleted.

## How it's built
- **Database** (`supabase/migrations/20261113000035_video_calls.sql`):
  - `team_video_access`: a row means an admin turned the team on; `mentors_on` is the head
    coach's switch.
  - `video_calls`: the calls themselves.
  - `private.video_ok()` checks every one of her current teams.
  - Booking rules are RLS policies; a trigger enforces "one call at a time" and "not in the
    past".
  - Notices go into `notifications` (kind `video-call`).
  - `video_call_team()` (where a call with her goes, or null when calls are off) and
    `video_call_role()` (host, guest, cancelled or off).
  - Test: `tests/db/video_calls.test.sql`.
- **Zoom server code** (`src/lib/zoom.ts`, server-only): an access token from the
  Server-to-Server app; it books, reads and deletes meetings, and gets the host's key.
  `src/lib/zoom-signature.ts` signs each person in. Rules shared with the pages are in
  `src/lib/video-calls.ts`.
- **Actions** (`src/app/calls/actions.ts`): `scheduleVideoCall`, `cancelVideoCall`,
  `joinVideoCall`.
- **Call page** (`src/app/calls/[callId]`): `call-room.tsx` runs Zoom's web kit in a frame,
  `public/zoom-call.html`.
  - The kit is built on an older React than this site, so it's kept out of the site's code. It
    loads from Zoom's servers (`source.zoom.us`), version 6.10.0 pinned in that file.
  - Join details go to the frame by `postMessage`, same origin only.
  - Zoom draws a header bar above the video and its controls below it, inside the frame: the video is
    sized to the frame less 140px for the two (user, 2026-11-14: the controls were cut off), and is
    refitted when the window changes size (`updateVideoOptions`).
  - Zoom retires old web-kit versions, so update the six URLs together at least once a year.
- **Where calls show up:**
  - **Mentor's player page:** the Video calls panel, shown only when calls are on for her or
    calls already exist.
  - **Dugout Calendar:** the Video calls section, and on the month grid when booked to show there.
  - **Her week, the family Calendar, the mentor calendar:** see "Which calendars show a call" above.
  - **Player dashboard:** coming calls, above her menu.
  - **Family page:** a Video calls card.
  - **Switchboard:** the admin's switch and the mentors' switch.
  - **Notifications:** the bell is now in the players', parents' and mentors' menus too, and
    `/notifications` is open to every signed-in user.
- **Privacy notice:** Zoom is listed as a service provider (`src/lib/legal.ts`). It shipped with
  `TERMS_VERSION` 2026-11-13, so everyone agrees again.

## Setting it up (Zoom and Vercel)
Until all six keys are set, booking and joining say "Video calls aren't connected to Zoom yet",
and the Switchboard tells admins the same.

**1. A Zoom account on a paid plan** (Pro or higher; free meetings stop at 40 minutes).
- Pick or create the one licensed user every call is booked under, for example a club address.
  That user's email is `ZOOM_HOST_EMAIL`.

**2. Zoom account settings** (zoom.us → profile picture → Settings, as the account owner; user's screenshot,
2026-11-14: there is no Security tab, Security is a section of the **Meeting** tab, whose left menu lists the sections).
The site also asks for the waiting room, no join before host and no recording on every call it books; these stop
anything in Zoom undoing that.
- **Meeting → Security:** Waiting Room on; "Require a passcode when scheduling new meetings" on.
- **Meeting → Schedule Meeting:** "Allow participants to join before host" off.
- **Meeting → In Meeting (Basic):** "Meeting chat - Direct messages" off; Screen sharing on with "Who can share?"
  Host Only; "Allow removed participants to rejoin" off.
- **Recording tab:** local, cloud and automatic recording off.
- **Zoom AI tab → Meeting:** "Participants can request the host to start in-meeting AI features" off, "Allow users
  to ask questions in-meeting with AI" off, "Restrict Zoom AI features and transcription when external users join"
  on, any meeting summary or transcript setting off (calls include a minor; nothing is kept).
- Padlocks only matter when other people sign in to the Zoom account: the same settings under Admin → Account
  Management → Account Settings (newer menus: Admin Center → Settings), each locked with its padlock.

**3. App 1: Server-to-Server OAuth** (marketplace.zoom.us → Develop → Build App →
Server-to-Server OAuth). It books, reads and deletes meetings, and gets the host's key.
- Name it, for example "GGG.Cafe calls", and fill in the Information page.
- **Scopes → Add Scopes:**
  - Meeting: create a meeting for a user (`meeting:write:meeting:admin`)
  - Meeting: view a meeting (`meeting:read:meeting:admin`)
  - Meeting: delete a meeting (`meeting:delete:meeting:admin`)
  - User: view a user's token (`user:read:token:admin`)
- Activate the app.
- Copy its Account ID, Client ID and Client Secret: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID` and
  `ZOOM_CLIENT_SECRET`.
- If the Server-to-Server option is missing, the account owner turns on that permission in User
  Management → Roles.

**4. App 2: a General App with the Meeting SDK** (Build App → General App). It signs each person
into the call.
- In its settings, turn on the Meeting SDK (Features → Embed).
- Copy its Client ID and Client Secret (App Credentials): `ZOOM_SDK_KEY` and `ZOOM_SDK_SECRET`.
- It doesn't need to be published in Zoom's Marketplace, because every call is a meeting in your
  own account.
- If joining says the signature is invalid, check these two keys come from this app, not app 1.

**5. Vercel** (vercel.com → team GGG → project `gggcafe` → Settings → Environment Variables):
- Add the six variables for Production (and Preview if you want calls there), each marked
  Sensitive. Never give them a `NEXT_PUBLIC_` name, and never commit them.
- Then redeploy (Deployments → the latest production deployment → ⋯ → Redeploy): new variables
  apply only to new deployments.
- For localhost, put the same six in `.env.local`.

**6. Turn it on in GGG.Cafe:**
- A site admin opens the Switchboard for the team → Video calls (Zoom) → On.
- If mentors should book calls, the head coach turns on Mentors → Video calls.

**7. Test it:**
- Book a call 15 minutes ahead from the Dugout Calendar.
- 10 minutes before the start, open the call page and press Start the call.
- Join from a phone as the player's parent. The host lets them in from the waiting room.

## Not done
- (Done 2026-11-13: the job worker emails her approved parents when a call is booked or cancelled,
  once Resend and the jobs secret are set up; docs/architecture/jobs.md. A cancelled call's Zoom
  meeting is also deleted by a job, with retries.)
- Team-wide calls: every call is with one player.
- Calls at the same time (see "One call at a time" under Rules).
