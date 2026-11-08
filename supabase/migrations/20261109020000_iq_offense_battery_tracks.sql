-- Softball IQ: Offense IQ (SB Blueprint Phase 3) and Battery IQ (Phase 4) tracks.
-- Their own migration because new enum values can't be used in the transaction
-- that adds them. Both have Levels 1-3; passing a level (80%+) unlocks the next,
-- and the award is the MVP badge (user, 2026-11-08), not a ring.
alter type public.iq_track add value if not exists 'offense';
alter type public.iq_track add value if not exists 'battery';
