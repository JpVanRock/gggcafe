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
  card asks the parent to have the head coach add it.
