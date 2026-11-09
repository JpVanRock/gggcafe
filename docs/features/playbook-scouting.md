# Team playbook & scouting (SB Blueprint Phase 8, user 2026-11-08; migration 20261109070000)
- Depth chart (`/dugout/gameday/depth`, GameDay sub-menu `gameday/nav.tsx`; head-coach writes like GameDay): `depth_chart`
  (team, position P..RF, player, rank). "Start from player positions" seeds it from primary then secondary positions.
  The lineup builder's "Depth chart" button under each rotation fills it with `suggestDefense()` (scarce positions
  first, best available, the rest Sub; batting order if set, else everyone).
- Coaches Dugout → Playbook (`/dugout/playbook`, all coaches incl. assistants; sub-menu `playbook/nav.tsx`):
  - Call sheet: `playbook_plays` (team_id null = organization playbook for all our teams). `call_sheet` plays are
    readable by players on that team (RLS); "+ Install checklist" adds the play to the install list
    (`install_items.play_id`). Never store how signs are given (no field; `SIGN_RULE` reminder on the form).
  - Team quizzes (`/dugout/playbook/quizzes`): `team_quizzes` (draft until `published_at`), `team_quiz_questions`
    (staff only), `team_quiz_answers` (written only by `answer_team_quiz`: first answer = score, later tries update the
    latest). Players get questions through `team_quiz_for` (no key until answered) and their list through
    `team_quizzes_for`. No awards or points.
  - Scouting (`/dugout/playbook/scouting?opp=`): the guided fastpitch checklist (`SCOUT_PROMPTS`: slappers, short game,
    catcher back-picks, first-and-third, pitch mix...) saves each answer as a `scouting_reports` row (tags `checklist` +
    key, confidence 1-5); free notes too. No prompts about the opponent's signs. Staff only.
- Player side: Softball IQ page card → `/players/[id]/iq/playbook` (flashcards `Flashcards`, quiz list) and
  `/iq/playbook/[quizId]` (`TeamQuizRunner`): files `playbook-data.ts`, `playbook-client.tsx`, `playbook-actions.ts`.
- Logic in `src/lib/playbook.ts` (no imports, unit-tested). DB tests: `tests/db/playbook_scouting.test.sql`.
