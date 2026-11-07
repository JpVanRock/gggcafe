-- =============================================================================
-- GGG.Cafe — Extra Credit Library track
-- In its own migration: a new enum value can't be used in the same transaction
-- that adds it, and the next migration's constraints use it.
-- =============================================================================

alter type public.iq_track add value if not exists 'extra';
