-- =============================================================================
-- GGG.Cafe — 001 Foundation
-- Access control (staff + RLS helpers), teams, seasons, players, rosters,
-- games and lineups.
--
-- Security model: every table has Row Level Security on. Signed-out visitors
-- (anon) see nothing. Signed-in users see nothing either until an admin adds
-- them to public.staff:
--   viewer -> read everything
--   coach  -> read + write everything except staff
--   admin  -> coach + manage staff
-- =============================================================================

-- Helpers live in a schema the API does not expose (only public is exposed).
create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Staff (who may use the app)
-- -----------------------------------------------------------------------------
create type public.staff_role as enum ('viewer', 'coach', 'admin');

create table public.staff (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role         public.staff_role not null default 'viewer',
  created_at   timestamptz not null default now()
);
comment on table public.staff is
  'Signed-in users allowed into the app. Add the first admin from the SQL editor (see README).';

create function private.staff_role() returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select role from public.staff where user_id = (select auth.uid())
$$;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()))
$$;

create function private.can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.staff_role() in ('coach', 'admin'), false)
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.staff_role() = 'admin', false)
$$;

revoke all on function private.staff_role(), private.is_staff(),
  private.can_edit(), private.is_admin() from public;
grant execute on function private.staff_role(), private.is_staff(),
  private.can_edit(), private.is_admin() to authenticated;

-- Standard policy set for app tables: staff read, coaches/admins write.
-- Call it for every new table:  select private.apply_staff_rls('public.my_table');
create function private.apply_staff_rls(tbl regclass) returns void
language plpgsql as $$
begin
  execute format('alter table %s enable row level security', tbl);
  execute format(
    'create policy "staff can read" on %s for select to authenticated using ((select private.is_staff()))', tbl);
  execute format(
    'create policy "coaches can insert" on %s for insert to authenticated with check ((select private.can_edit()))', tbl);
  execute format(
    'create policy "coaches can update" on %s for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()))', tbl);
  execute format(
    'create policy "coaches can delete" on %s for delete to authenticated using ((select private.can_edit()))', tbl);
end;
$$;
revoke all on function private.apply_staff_rls(regclass) from public;

-- Staff table: you can always see your own row; only admins manage staff.
alter table public.staff enable row level security;
create policy "see self or staff can read" on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "admins can insert" on public.staff for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins can update" on public.staff for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins can delete" on public.staff for delete to authenticated
  using ((select private.is_admin()));

-- updated_at maintenance
create function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Shared enums
-- -----------------------------------------------------------------------------
create type public.game_format as enum ('fastpitch', 'slowpitch');
create type public.bats_hand as enum ('R', 'L', 'S');
create type public.throws_hand as enum ('R', 'L');
-- DP/FLEX: fastpitch designated player and flex. EH: extra hitter.
create type public.field_position as enum
  ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DP', 'FLEX', 'EH');
create type public.game_type as enum
  ('league', 'tournament_pool', 'tournament_bracket', 'showcase', 'scrimmage', 'exhibition');
create type public.game_status as enum
  ('scheduled', 'in_progress', 'final', 'suspended', 'cancelled');

-- -----------------------------------------------------------------------------
-- Teams (our teams and opponents)
-- -----------------------------------------------------------------------------
create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  short_name   text,
  organization text,
  age_group    text,                       -- '12U', '14U', 'Varsity', ...
  format       public.game_format not null default 'fastpitch',
  is_own_team  boolean not null default false,  -- false = opponent
  home_field   text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (name, age_group)
);
comment on column public.teams.is_own_team is 'true for teams we coach; false for opponents we scout.';

-- -----------------------------------------------------------------------------
-- Seasons
-- -----------------------------------------------------------------------------
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,          -- 'Fall 2026'
  start_date date,
  end_date   date,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- -----------------------------------------------------------------------------
-- Players (ours and opponents')
-- -----------------------------------------------------------------------------
create table public.players (
  id                  uuid primary key default gen_random_uuid(),
  first_name          text not null,
  last_name           text not null,
  preferred_name      text,
  bats                public.bats_hand,
  throws              public.throws_hand,
  grad_year           smallint check (grad_year between 2000 and 2100),
  primary_position    public.field_position,
  secondary_positions public.field_position[] not null default '{}',
  is_slapper          boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index players_name_idx on public.players (last_name, first_name);

-- -----------------------------------------------------------------------------
-- Rosters: which players are on which team in which season
-- -----------------------------------------------------------------------------
create table public.roster_entries (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  season_id     uuid not null references public.seasons (id) on delete cascade,
  player_id     uuid not null references public.players (id) on delete cascade,
  jersey_number text,                     -- text so '0' and '00' differ
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (team_id, season_id, player_id)
);
create index roster_entries_player_idx on public.roster_entries (player_id);

-- -----------------------------------------------------------------------------
-- Games
-- -----------------------------------------------------------------------------
create table public.games (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid references public.seasons (id) on delete set null,
  game_date         date not null,
  start_time        time,
  home_team_id      uuid not null references public.teams (id) on delete restrict,
  away_team_id      uuid not null references public.teams (id) on delete restrict,
  venue             text,
  event_name        text,                   -- tournament / showcase name
  game_type         public.game_type not null default 'league',
  scheduled_innings smallint not null default 7 check (scheduled_innings between 1 and 15),
  home_score        smallint check (home_score >= 0),
  away_score        smallint check (away_score >= 0),
  status            public.game_status not null default 'scheduled',
  conditions        text,                   -- weather, field, umpire notes
  notes             text,
  external_id       text unique,            -- e.g. GameChanger game id, for imports
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create index games_season_idx on public.games (season_id, game_date);
create index games_home_idx on public.games (home_team_id);
create index games_away_idx on public.games (away_team_id);

-- -----------------------------------------------------------------------------
-- Lineups
-- -----------------------------------------------------------------------------
create table public.lineup_entries (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games (id) on delete cascade,
  team_id           uuid not null references public.teams (id) on delete cascade,
  player_id         uuid not null references public.players (id) on delete cascade,
  batting_order     smallint check (batting_order between 1 and 20),  -- null = defense only (e.g. FLEX)
  starting_position public.field_position,
  is_starter        boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (game_id, player_id)
);
create index lineup_entries_game_idx on public.lineup_entries (game_id, team_id);

-- -----------------------------------------------------------------------------
-- Triggers + RLS
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.teams
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.players
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.games
  for each row execute function private.set_updated_at();

select private.apply_staff_rls('public.teams');
select private.apply_staff_rls('public.seasons');
select private.apply_staff_rls('public.players');
select private.apply_staff_rls('public.roster_entries');
select private.apply_staff_rls('public.games');
select private.apply_staff_rls('public.lineup_entries');
