# State machines

Every thing in the app that moves through stages, where its stages are written down, and who moves it.
This is an inventory (2026-11-16). When you add or change a lifecycle, update the matching section here.

## The rule

A thing that moves through stages has **one declaration** and **one place that enforces it**:

| Kind | Declared in | Enforced by |
|---|---|---|
| Stored status (a `status` column) | `src/lib/lifecycles.ts` (`lifecycle({...})`) | the database, with a `private.guard_transition` trigger, when stale or wrong moves would do harm |
| Computed from rows or the clock | one pure function in `src/lib/` (e.g. `callState`, `chapterStatus`) | callers use that function and never re-derive the state |
| Inside one page (a runner, a wizard) | one `Phase` union in the component, with a comment drawing the moves | late server replies are checked against the current phase or attempt, then dropped if they're stale |

Checks that keep these in step:

- `tests/unit/lifecycles.test.ts`: every lifecycle is well formed, and each guarded one has the same edges as its database trigger.
- `tests/db/lifecycles.test.sql`: the guards refuse a second decision and allow the real flows.
- Status columns are typed from the database. Enums come from `Database["public"]["Enums"]`. A text column with `check (x in (...))` is typed as that list by `scripts/gen-types.py`. So a value the database won't take doesn't compile.

## 1. Stored lifecycles (`src/lib/lifecycles.ts`)

| Lifecycle | Column | States and moves | Who moves it | Guarded in DB |
|---|---|---|---|---|
| `PLAYER_CLAIM` | `player_claims.status` | pending → approved / declined; declined → pending (she asks again); approved → declined (consent withdrawn) | coach (`decidePlayerClaim`); player (`request_player_claim`); parent (`withdraw_parental_consent`) | yes |
| `PARENT_LINK` | `parent_links.status` | pending → approved / declined. Removing a parent deletes the row | head coach (`decideParentLink`); approve also `private.match_parent_link` (parent code + her name on the roster) | yes |
| `MENTOR_LINK` | `mentor_links.status` | pending → approved / declined | head coach (whole team), her parents (one player), admin: `decide_mentor_link` | yes |
| `STAFF_REQUEST` | `staff_requests.status` | pending → approved / declined | admin, or head coach for assistants: `decide_staff_request` | yes |
| `PARENTAL_CONSENT` | `parental_consents.status` | pending → verified / declined; pending or verified → withdrawn. A new request is a new row | admin (`review_parental_consent`); parent (`withdraw_parental_consent`) | yes |
| `PRACTICE_PLAN` | `practice_plans.status` | draft ⇄ final. Saving a final plan raises P0004 (`save_practice_plan`) | coach | no (both moves allowed) |
| `GAMEDAY_LINEUP` | `gameday_lineups.status` | draft ⇄ final. Sharing a draft finalizes it | coach | no |

Decisions are made **only from the move's `from` states**:

- Direct updates add `.in("status", X.moves.approve.from)` plus `.select("id")`. When no row comes back, the action shows `ALREADY_DECIDED` and doesn't refresh, so the message stays visible.
- Decide functions in the database raise P0002 on a request that isn't waiting. The actions turn that into the same message.
- Any status change outside the listed moves raises **P0010**. `friendlyDbError` says "This changed since the page loaded…".

Labels and badge tones for these states come from the lifecycle (`PARENT_LINK.label[s]`, `PARENT_LINK.tone[s]`). A page whose reader needs other words keeps its own copy, for example the mentor's "Waiting for her parents".

### Other stored states (simple, no declaration needed)

| Thing | Where | States |
|---|---|---|
| Install checklist item | `install_items.status`, `src/lib/install.ts` (`INSTALL_STATUSES`, `nextInstallStatus`) | not started → taught → repped → game-ready (a coach may set any) |
| SMART goal | `development_goals.status` (`goal_status`) | active ⇄ achieved (`missed` and `dropped` exist in the enum and aren't used yet) |
| Team goal | `team_goals.achieved_at` | open ⇄ achieved |
| Team quiz | `team_quizzes.published_at` | draft ⇄ published |
| Mentor focus | `mentor_focus.status` | working_on ⇄ working |
| Notifications, mentor messages | `read_at` | unread → read (a mentor's message: the player, or for the parents thread any of her parents; an answer: the mentor; `private.guard_mentor_message_update`) |
| Games | `games.status` (`game_status`) | scheduled, in_progress, final, suspended, cancelled (saving a box score marks the game final) |
| Video call | `video_calls.cancelled_at` | booked → cancelled (`cancelVideoCall` only while not cancelled) |
| Job (outbox) | `private.jobs`: `locked_at`, `done_at`, `outcome` | waiting → running → done / skipped, or back to waiting with a retry time, then dead. All in SQL (`jobs_claim`, `jobs_finish`, `jobs_fail`; a check keeps `done_at` and `outcome` together). See `jobs.md` |
| Error group | `private.error_groups.resolved_at` | open → resolved; a new occurrence reopens it (`report_error`) |
| Terms agreement | `terms_acceptances` row + the account's `terms_version` | needs to agree → agreed (`src/proxy.ts` checks the token; `/terms/accept`) |
| Leadership program | `player_leadership_access`, lessons' `completed_at`, plan `committed_at`, review `signed_at`, certificate `awarded_at` | picked → lessons done → plan committed → signed off → certificate. Switching program clears the commitment and sign-off but keeps the certificate (`leadership-actions.ts`) |

## 2. Computed from rows or the clock

Each of these has one function. Use it rather than re-deriving the state.

| State | Function | States |
|---|---|---|
| Video call | `callState` (`src/lib/video-calls.ts`) | cancelled / upcoming / open (10 min before to 15 min after) / over. The call page and `joinVideoCall` both decide from it |
| IQ rings and badges | `buildTracks`, `buildBadgeTracks` (`players/[playerId]/iq.tsx`) | earned / open / locked |
| Scorebook chapter | `chapterStatus` (`src/lib/scorebook.ts`) | locked / new / reading / quiz / complete |
| Scorebook game | `gameStatuses` (`src/lib/scorebook-game.ts`) | locked / open / playing / clean |
| Player of the Week race | `weekRace` (`src/lib/leaderboard.ts`) | eligible / named-this-round / cooldown. Ties are broken the way the database's pick breaks them |
| Mental zone | `zoneStatus` (`src/lib/mental.ts`) | under / in / over |
| Account home | `/dashboard` (`NotStaff` in `dashboard/page.tsx`) | player → /me, mentor → /mentor, parent → /family, coach sign-up → waiting / not approved / no coach access (approved, then removed from staff). Pages that turn someone away send them to `/dashboard`, which routes them home |

## 3. Inside a page

| Runner | File | Phases and guards |
|---|---|---|
| IQ level tests | `players/[playerId]/iq-tests-client.tsx` | picker → question ⇄ feedback → all answered → grading → result; review mode. `live` holds the attempt on screen, and a reply for any other attempt is dropped. `clearRun` blanks everything when a test or review starts or ends, so Start over looks like a test never started. Leaving refreshes the cards as a transition, so their buttons wait for the fresh state. `nextOpen` never reads past the last question |
| Video call room | `calls/[callId]/call-room.tsx` + `public/zoom-call.html` | idle → asking → connecting → in; any → left / error. `attempt` drops a join reply that arrives after Leave |
| Practice quiz | `players/[playerId]/iq-quiz-client.tsx` | list → question → feedback → score. Stop shows after an error too. `runs` drops an answer's reply that lands after Stop |
| Scorebook chapter | `scorebook-client.tsx` (`ChapterRunner`) | lesson → ready → quiz → result. `openQuiz` is the page-load `quizOpen` until a quiz starts here, then open until it's graded, so Save & exit offers Resume and Start over |
| Scorebook game | `GameRunner` | intro → play → line → result. A start or restart clears the line score and its "doesn't match" note |
| Guided mental session | `session-client.tsx` | intro → run → done |
| Course, team quiz, bullpen | `course-client.tsx`, `playbook-client.tsx`, bullpen runner | step index plus shown/answered flags |

## Adding a lifecycle

1. Declare it in `src/lib/lifecycles.ts`: states typed from the database, a label and tone for each state, and moves that say who makes them.
2. If a stale or wrong move would do harm, guard it in a new migration with `private.guard_transition('status', 'from>to', ...)` and set `guarded: true`. The unit test then holds both lists together.
3. Server actions move from `X.moves.m.from` and write `X.moves.m.to`. Report a row that has moved on; never succeed silently.
4. Add a row to this page.

## Known edges, left as they are (product decisions)

- **Leadership:**
  - Reopening a lesson after sign-off leaves the sign-off and certificate in place.
  - Saving a committed plan doesn't re-check that it's complete.
  - The menu's "leader" comes from the certificate, while the coach view goes by the sign-off. They differ after a program switch, by design: the certificate stays.
- **Scorebook:**
  - A clean game that's being replayed shows as clean, not playing.
  - "All chapters done" is computed in four places (`scorebook.tsx`, `game/page.tsx`, `game/[n]/page.tsx`, `player-menu.tsx`). One helper would be better.
