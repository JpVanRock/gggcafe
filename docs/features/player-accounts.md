# Player accounts (claims) — user's choices: full edit, find her spot by name + jersey
- Teams have a coach `welcome_message` (team form). Players sign up at `/register` (account type Player and the
  team code, checked by `signup_team()`; the team is saved in her metadata), then `/me` shows the welcome message and "Claim my
  profile" (name + jersey; `request_player_claim()` matches her spot on the team's CURRENT season
  roster, else the coach matches it). Coaches approve on the team page (`teams/[teamId]/claims.tsx`,
  `team_player_claims()`); the nav shows a count and the dashboard a "Waiting for your approval" card
  (`pending_approvals()`, includes parent requests).
- Claims are per team + season (`player_claims`). A team's current season = its latest season with a
  roster (`private.team_current_season`). When a new season's roster starts, last season's claim stops
  giving access until she claims again (/me prompts her); her profile and history stay.
- An approved player (`private.my_player_ids()`) gets RLS access to her own data: reads her profile,
  roster history, teams + opponents, schedule, standards, measurements, evaluations, awards; full edit
  of her activities/routines, TWIS checks, Harada + SMART goals, Mental GP (goal method via
  `set_goal_method()`); she can't see teammates, coach notes, the Dugout or the staff list. Pages:
  `requirePlayerPage()` (staff or herself; `canAct` vs coach-only `canManage`), actions:
  `actForCheck(playerId)` / `actorCheck()` in `src/lib/auth.ts`.
- Softball IQ integrity: answer keys (`correct_index`, `explanation`) are not column-readable by anyone;
  `record_iq_answer()` grades and records every answer, `iq_answer_key()` returns keys (all for staff,
  answered ones for a player); `start_iq_level`/`finish_iq_level`/`iq_review_status` are private
  definer functions (behind `private.expose` wrappers) that check `private.can_act_for()`. Players can't write answers or awards directly.
- DB tests: `tests/db/players.test.sql`.
- Verified parental consent for players under 13 (COPPA; user, 2026-11-11; migration 20261111235221_parental_consent):
  a parent-made login, and any approved profile claim, for a player under 13 (by her profile's birth date) needs a
  verified `parental_consents` row first. On /family (`family/consent.tsx`) the parent downloads the consent form
  (`/family/consent/[playerId]/pdf`, `src/lib/pdf/consent-form-pdf.tsx`; words in `src/lib/legal.ts`: `CONSENT_NOTICE`,
  `CONSENT_STATEMENT`), signs it by hand and uploads a photo or scan (private bucket `consent-forms`, her own folder;
  images shrunk to 2000px), types her name and relationship and ticks the statement (`submit_parental_consent`); or asks
  for a video call. A GGG.Cafe admin checks it in the Roster tab's "Waiting for approval" (`pending_parental_consents`,
  `review_parental_consent`: a reason to decline, a note to verify a video call); it counts in `countWaiting`. Coaches never
  read consents or forms. The trigger `claims_need_consent` refuses approving a claim for an under-13 player without it
  (P0008, shown in `decidePlayerClaim`). The parent can cancel or withdraw on /family (`withdraw_parental_consent`: her
  parent-made login is deleted and approved claims are declined). Status per daughter: `parent_consent_status`,
  `consentStep()` in `src/lib/consent.ts`. DB tests: `tests/db/parental_consent.test.sql`.
