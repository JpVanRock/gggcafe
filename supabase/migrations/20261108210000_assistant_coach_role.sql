-- Assistant Coach (user, 2026-11-08): a staff role between viewer and coach.
-- Its own migration because a new enum value can't be used in the transaction
-- that adds it. What assistants may do is in 20261108210100_account_types.sql.
-- Roles now: viewer (read only), assistant (Assistant Coach), coach (Head Coach),
-- admin (site admin: everything a head coach has, plus staff, mentors, G3 Advanced).
alter type public.staff_role add value if not exists 'assistant' after 'viewer';
