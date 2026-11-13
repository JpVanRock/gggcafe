-- Video call bookings: at most 4 an hour per person (user, 2026-11-13; was 12, migration
-- 20261113041701). The site checks the same limit before it asks Zoom for a meeting
-- (src/app/calls/actions.ts). Joining a call keeps its own limit (30 every 10 minutes).
create or replace function private.limit_video_calls() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('video_calls.book', 4, 3600);
  return new;
end $$;
