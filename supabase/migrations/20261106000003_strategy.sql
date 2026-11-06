-- =============================================================================
-- GGG.Cafe — 003 Game strategy intelligence
-- Scouting reports on opponents, per-game plans and reviews, the team playbook,
-- and a log of plays called in games so we can see what actually works.
-- =============================================================================

create type public.scouting_category as enum (
  'pitcher_tendencies', 'hitter_tendencies', 'defense', 'baserunning',
  'signs_and_signals', 'coaching_tendencies', 'team_overview', 'other'
);

create table public.scouting_reports (
  id                uuid primary key default gen_random_uuid(),
  subject_team_id   uuid not null references public.teams (id) on delete cascade,
  subject_player_id uuid references public.players (id) on delete cascade,  -- null = whole team
  game_id           uuid references public.games (id) on delete set null,   -- game it was observed in
  category          public.scouting_category not null,
  title             text not null,
  body              text not null,
  confidence        smallint check (confidence between 1 and 5),  -- 1 = hunch, 5 = seen repeatedly
  tags              text[] not null default '{}',
  observed_on       date,
  author_id         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index scouting_reports_team_idx on public.scouting_reports (subject_team_id, category);
create index scouting_reports_player_idx on public.scouting_reports (subject_player_id);
create index scouting_reports_tags_idx on public.scouting_reports using gin (tags);

create table public.game_plans (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references public.games (id) on delete cascade,
  team_id             uuid not null references public.teams (id) on delete cascade,  -- our team
  starting_pitcher_id uuid references public.players (id) on delete set null,
  pitching_plan       text,
  defensive_plan      text,
  offensive_plan      text,
  baserunning_plan    text,
  key_matchups        text,
  postgame_review     text,   -- what worked, what didn't, what to practice
  author_id           uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (game_id, team_id)
);

create type public.play_category as enum (
  'bunt_defense', 'first_and_third', 'pickoff', 'cutoff_relay', 'rundown',
  'short_game_offense', 'baserunning', 'defensive_alignment', 'pitch_calling', 'other'
);

create table public.playbook_plays (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references public.teams (id) on delete cascade,  -- null = all our teams
  name        text not null,
  category    public.play_category not null,
  situation   text,          -- when to call it
  description text not null,
  diagram_url text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index playbook_plays_name_idx
  on public.playbook_plays (coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

create type public.play_outcome as enum ('success', 'partial', 'failure');

create table public.play_calls (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references public.games (id) on delete cascade,
  play_id             uuid not null references public.playbook_plays (id) on delete cascade,
  plate_appearance_id uuid references public.plate_appearances (id) on delete set null,
  inning              smallint check (inning >= 1),
  outs                smallint check (outs between 0 and 2),
  outcome             public.play_outcome not null,
  notes               text,
  created_at          timestamptz not null default now()
);
create index play_calls_play_idx on public.play_calls (play_id);

-- How often each play works.
create view public.play_effectiveness with (security_invoker = true) as
select
  p.id   as play_id,
  p.team_id,
  p.name,
  p.category,
  count(c.id)::int                                       as times_called,
  count(c.id) filter (where c.outcome = 'success')::int  as successes,
  count(c.id) filter (where c.outcome = 'partial')::int  as partials,
  count(c.id) filter (where c.outcome = 'failure')::int  as failures,
  round(100.0 * count(c.id) filter (where c.outcome = 'success') / nullif(count(c.id), 0), 1) as success_pct,
  max(g.game_date)                                       as last_called
from public.playbook_plays p
left join public.play_calls c on c.play_id = p.id
left join public.games g on g.id = c.game_id
group by p.id, p.team_id, p.name, p.category;

create trigger set_updated_at before update on public.scouting_reports
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.game_plans
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.playbook_plays
  for each row execute function private.set_updated_at();

select private.apply_staff_rls('public.scouting_reports');
select private.apply_staff_rls('public.game_plans');
select private.apply_staff_rls('public.playbook_plays');
select private.apply_staff_rls('public.play_calls');
