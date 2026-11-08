-- Mental game (Phase 1, user 2026-11-08): guided breathing and imagery sessions are
-- Performance Training routines in a new "mental" category. Its own migration
-- because a new enum value can't be used in the transaction that adds it.
alter type public.training_category add value if not exists 'mental';
