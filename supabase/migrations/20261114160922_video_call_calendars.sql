-- Which calendars show a video call (user, 2026-11-14): picked when it's booked. The person who
-- booked it always has it on their own calendar (a head coach: the Coaches Dugout calendar; a mentor:
-- their mentor calendar, which shows every call they host). The choices:
--   player   her week (This Week on her player page; her parents viewing as her see it too)
--   family   her parents' calendar (the family page's Calendar)
--   coaches  the Coaches Dugout calendar (always, for a head coach's own call)
-- Only where the call shows on a calendar: who can read, join or hear about a call doesn't change
-- (her parents are still told of every call; the Dugout's Video calls list still has them all).
-- Calls booked before this show on all three.
alter table public.video_calls
  add column calendars text[] not null default array['player', 'family', 'coaches']::text[];
alter table public.video_calls
  add constraint video_calls_calendars_check
  check (calendars <@ array['player', 'family', 'coaches']::text[] and (host_kind <> 'coach' or 'coaches' = any (calendars)));
comment on column public.video_calls.calendars is
  'Calendars that show the call besides the host''s own: player (her week), family (her parents'' calendar), coaches (the Dugout calendar; always for a head coach''s call).';
