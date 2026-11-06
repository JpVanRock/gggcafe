-- =============================================================================
-- GGG.Cafe — 004 Player development
-- Measurable metrics over time (exit velo, pop time, ...), coach skill
-- evaluations, development goals, coach notes, and drill assignments.
-- =============================================================================

create type public.skill_area as enum (
  'hitting', 'short_game', 'pitching', 'catching', 'infield', 'outfield',
  'baserunning', 'mental', 'strength_conditioning', 'other'
);
create type public.better_direction as enum ('higher', 'lower');

-- -----------------------------------------------------------------------------
-- Metric definitions (reference data, editable)
-- -----------------------------------------------------------------------------
create table public.metrics (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  name        text not null,
  unit        text not null,
  better      public.better_direction not null,
  area        public.skill_area not null,
  description text
);

insert into public.metrics (key, name, unit, better, area, description) values
  ('exit_velo_tee',         'Exit velocity (tee)',           'mph', 'higher', 'hitting',   'Max of 5 swings off a tee'),
  ('exit_velo_toss',        'Exit velocity (front toss)',    'mph', 'higher', 'hitting',   'Max of 5 swings, front toss'),
  ('bat_speed',             'Bat speed',                     'mph', 'higher', 'hitting',   'Swing sensor peak hand/bat speed'),
  ('pitch_velo_fastball',   'Fastball velocity',             'mph', 'higher', 'pitching',  'Max of 5 pitches'),
  ('changeup_differential', 'Changeup speed differential',   'mph', 'higher', 'pitching',  'Fastball avg minus changeup avg'),
  ('spin_rate',             'Spin rate',                     'rpm', 'higher', 'pitching',  'Primary breaking pitch'),
  ('throw_velo_infield',    'Throwing velocity (infield)',   'mph', 'higher', 'infield',   'Across the diamond'),
  ('throw_velo_outfield',   'Throwing velocity (outfield)',  'mph', 'higher', 'outfield',  'Crow hop to target'),
  ('pop_time',              'Pop time',                      'sec', 'lower',  'catching',  'Glove to glove at 2B'),
  ('home_to_first',         'Home to first',                 'sec', 'lower',  'baserunning','Contact to bag, full swing'),
  ('home_to_first_slap',    'Home to first (slap)',          'sec', 'lower',  'baserunning','Contact to bag, slap'),
  ('sixty_yard',            '60-yard dash',                  'sec', 'lower',  'baserunning', null),
  ('vertical_jump',         'Vertical jump',                 'in',  'higher', 'strength_conditioning', null);

-- -----------------------------------------------------------------------------
-- Measurements
-- -----------------------------------------------------------------------------
create table public.measurements (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  metric_key  text not null references public.metrics (key) on update cascade,
  measured_on date not null default current_date,
  value       numeric(8,3) not null,
  context     text,           -- 'Fall showcase', 'Pocket Radar', ...
  notes       text,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index measurements_player_metric_idx on public.measurements (player_id, metric_key, measured_on);

-- First, latest and best value per player per metric.
create view public.player_metric_progress with (security_invoker = true) as
with ranked as (
  select
    m.*,
    mt.name as metric_name,
    mt.unit,
    mt.better,
    row_number() over (partition by m.player_id, m.metric_key order by m.measured_on, m.created_at)            as first_rank,
    row_number() over (partition by m.player_id, m.metric_key order by m.measured_on desc, m.created_at desc) as latest_rank,
    row_number() over (partition by m.player_id, m.metric_key
                       order by case when mt.better = 'higher' then m.value else -m.value end desc)          as best_rank
  from public.measurements m
  join public.metrics mt on mt.key = m.metric_key
)
select
  player_id,
  metric_key,
  max(metric_name)                              as metric_name,
  max(unit)                                     as unit,
  max(better::text)                             as better,
  count(*)::int                                 as measurements,
  max(value) filter (where first_rank = 1)      as first_value,
  max(measured_on) filter (where first_rank = 1) as first_measured_on,
  max(value) filter (where latest_rank = 1)     as latest_value,
  max(measured_on) filter (where latest_rank = 1) as latest_measured_on,
  max(value) filter (where best_rank = 1)       as best_value,
  max(value) filter (where latest_rank = 1) - max(value) filter (where first_rank = 1) as change,
  -- positive = improving, whichever direction "better" is
  case when max(better::text) = 'higher'
       then max(value) filter (where latest_rank = 1) - max(value) filter (where first_rank = 1)
       else max(value) filter (where first_rank = 1) - max(value) filter (where latest_rank = 1)
  end                                           as improvement
from ranked
group by player_id, metric_key;

-- -----------------------------------------------------------------------------
-- Coach evaluations (1-5 per skill area)
-- -----------------------------------------------------------------------------
create table public.skill_evaluations (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players (id) on delete cascade,
  area         public.skill_area not null,
  rating       smallint not null check (rating between 1 and 5),
  evaluated_on date not null default current_date,
  comments     text,
  evaluator_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index skill_evaluations_player_idx on public.skill_evaluations (player_id, area, evaluated_on);

-- -----------------------------------------------------------------------------
-- Development goals
-- -----------------------------------------------------------------------------
create type public.goal_status as enum ('active', 'achieved', 'missed', 'dropped');

create table public.development_goals (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players (id) on delete cascade,
  season_id      uuid references public.seasons (id) on delete set null,
  area           public.skill_area not null,
  title          text not null,
  description    text,
  metric_key     text references public.metrics (key) on update cascade,  -- optional measurable target
  baseline_value numeric(8,3),
  target_value   numeric(8,3),
  target_date    date,
  status         public.goal_status not null default 'active',
  achieved_on    date,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (target_value is null or metric_key is not null)
);
create index development_goals_player_idx on public.development_goals (player_id, status);

-- -----------------------------------------------------------------------------
-- Coach notes
-- -----------------------------------------------------------------------------
create table public.coach_notes (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  game_id    uuid references public.games (id) on delete set null,
  area       public.skill_area not null,
  note       text not null,
  author_id  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_notes_player_idx on public.coach_notes (player_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Drills and assignments
-- -----------------------------------------------------------------------------
create table public.drills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  area        public.skill_area not null,
  description text not null,
  equipment   text,
  video_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.drill_assignments (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players (id) on delete cascade,
  drill_id     uuid not null references public.drills (id) on delete cascade,
  goal_id      uuid references public.development_goals (id) on delete set null,
  prescription text,          -- '3x15, 3 days/week'
  assigned_on  date not null default current_date,
  due_on       date,
  completed_on date,
  notes        text,
  created_at   timestamptz not null default now()
);
create index drill_assignments_player_idx on public.drill_assignments (player_id, completed_on);

-- -----------------------------------------------------------------------------
-- Triggers + RLS
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.development_goals
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.coach_notes
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.drills
  for each row execute function private.set_updated_at();

select private.apply_staff_rls('public.metrics');
select private.apply_staff_rls('public.measurements');
select private.apply_staff_rls('public.skill_evaluations');
select private.apply_staff_rls('public.development_goals');
select private.apply_staff_rls('public.coach_notes');
select private.apply_staff_rls('public.drills');
select private.apply_staff_rls('public.drill_assignments');
