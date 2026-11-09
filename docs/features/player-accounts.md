# Player accounts (claims) — user's choices: full edit, find her spot by name + jersey
- Teams have a coach `welcome_message` (team form). Players sign up at `/register` (Player/Parent toggle;
  players pick their team from `signup_teams()`), then `/me` shows the welcome message and "Claim my
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
