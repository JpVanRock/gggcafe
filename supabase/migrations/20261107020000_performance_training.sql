-- =============================================================================
-- GGG.Cafe — Performance Training
--
-- Training routines are player activities with a training category, so they
-- show up in TWIS and their check-offs measure consistency. Pitching and
-- catching routines are for pitchers and catchers (enforced in the app).
-- Achievements unlock from consistency and are stored once earned, so they
-- never disappear even if old routines are later removed.
-- =============================================================================

create type public.training_category as enum
  ('workout', 'stretching', 'hitting', 'fielding', 'pitching', 'catching');

-- Library drills can be filed under a training category.
alter table public.drills
  add column category public.training_category;

-- A player activity with a category is a Performance Training routine.
alter table public.player_activities
  add column category public.training_category,
  add column drill_id uuid references public.drills (id) on delete set null;
create index player_activities_category_idx on public.player_activities (player_id, category)
  where category is not null;

create table public.player_achievements (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players (id) on delete cascade,
  achievement_key text not null check (achievement_key ~ '^[a-z0-9_]+$'),
  unlocked_on     date not null,
  created_at      timestamptz not null default now(),
  unique (player_id, achievement_key)
);
comment on table public.player_achievements is
  'Achievements a player has earned. Rules live in src/lib/achievements.ts.';

select private.apply_staff_rls('public.player_achievements');
