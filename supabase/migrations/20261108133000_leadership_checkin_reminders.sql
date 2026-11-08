-- =============================================================================
-- GGG.Cafe — Leadership Plan check-in reminders (user, 2026-11-08)
--
-- The check-in dates in her Leadership Plan become one-day activities in her
-- This Week in Softball (TWIS) on those dates, so she sees them coming and can
-- tick them off. Coaches see the upcoming ones on their dashboard. `source`
-- marks activities the app makes; the app keeps them in step with the plan
-- (they're left out of Manage activities, and never earn leaderboard points:
-- no training category).
-- =============================================================================

alter table public.player_activities
  add column source text check (source is null or source in ('leadership-checkin'));
comment on column public.player_activities.source is
  'Set when the app made the activity: leadership-checkin = a check-in date from her Leadership Plan (kept in step with the plan).';
create index player_activities_source_idx on public.player_activities (source, starts_on) where source is not null;
