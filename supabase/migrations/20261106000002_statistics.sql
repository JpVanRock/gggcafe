-- =============================================================================
-- GGG.Cafe — 002 Statistics
--
-- Two levels of detail:
--   1. Box-score lines (batting_lines, pitching_lines, fielding_lines): one row
--      per player per game. The source of truth for standard stats (AVG, OBP,
--      ERA, ...). Filled by hand or from GameChanger exports.
--   2. Play-by-play (plate_appearances, pitches): optional, for games charted
--      pitch by pitch. Feeds the strategy views: counts, pitch mix, spray,
--      situational splits.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Box-score lines
-- -----------------------------------------------------------------------------
create type public.stat_source as enum ('manual', 'gamechanger', 'play_by_play');

create table public.batting_lines (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  plate_appearances smallint not null default 0 check (plate_appearances >= 0),
  at_bats          smallint not null default 0 check (at_bats >= 0),
  runs             smallint not null default 0 check (runs >= 0),
  hits             smallint not null default 0 check (hits >= 0),
  doubles          smallint not null default 0 check (doubles >= 0),
  triples          smallint not null default 0 check (triples >= 0),
  home_runs        smallint not null default 0 check (home_runs >= 0),
  rbi              smallint not null default 0 check (rbi >= 0),
  walks            smallint not null default 0 check (walks >= 0),
  strikeouts       smallint not null default 0 check (strikeouts >= 0),
  hit_by_pitch     smallint not null default 0 check (hit_by_pitch >= 0),
  sac_bunts        smallint not null default 0 check (sac_bunts >= 0),
  sac_flies        smallint not null default 0 check (sac_flies >= 0),
  stolen_bases     smallint not null default 0 check (stolen_bases >= 0),
  caught_stealing  smallint not null default 0 check (caught_stealing >= 0),
  reached_on_error smallint not null default 0 check (reached_on_error >= 0),
  gidp             smallint not null default 0 check (gidp >= 0),
  source           public.stat_source not null default 'manual',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (game_id, player_id),
  check (hits <= at_bats),
  check (doubles + triples + home_runs <= hits),
  check (strikeouts <= at_bats),
  -- PA can exceed the sum (catcher interference, obstruction), never fall short of it
  check (plate_appearances >= at_bats + walks + hit_by_pitch + sac_bunts + sac_flies)
);
create index batting_lines_player_idx on public.batting_lines (player_id);

create table public.pitching_lines (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games (id) on delete cascade,
  team_id           uuid not null references public.teams (id) on delete cascade,
  player_id         uuid not null references public.players (id) on delete cascade,
  is_starter        boolean not null default false,
  outs_recorded     smallint not null default 0 check (outs_recorded >= 0),  -- IP x 3
  batters_faced     smallint not null default 0 check (batters_faced >= 0),
  hits_allowed      smallint not null default 0 check (hits_allowed >= 0),
  runs_allowed      smallint not null default 0 check (runs_allowed >= 0),
  earned_runs       smallint not null default 0 check (earned_runs >= 0),
  walks             smallint not null default 0 check (walks >= 0),
  strikeouts        smallint not null default 0 check (strikeouts >= 0),
  hit_batters       smallint not null default 0 check (hit_batters >= 0),
  home_runs_allowed smallint not null default 0 check (home_runs_allowed >= 0),
  wild_pitches      smallint not null default 0 check (wild_pitches >= 0),
  illegal_pitches   smallint not null default 0 check (illegal_pitches >= 0),
  pitches           smallint check (pitches >= 0),
  strikes           smallint check (strikes >= 0),
  decision          text check (decision in ('W', 'L', 'S')),
  source            public.stat_source not null default 'manual',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (game_id, player_id),
  check (earned_runs <= runs_allowed),
  check (home_runs_allowed <= hits_allowed),
  check (strikes is null or pitches is null or strikes <= pitches)
);
comment on column public.pitching_lines.outs_recorded is
  'Innings pitched stored as outs: 5.1 IP = 16 outs. Avoids the .1/.2 decimal trap.';
create index pitching_lines_player_idx on public.pitching_lines (player_id);

create table public.fielding_lines (
  id                   uuid primary key default gen_random_uuid(),
  game_id              uuid not null references public.games (id) on delete cascade,
  team_id              uuid not null references public.teams (id) on delete cascade,
  player_id            uuid not null references public.players (id) on delete cascade,
  primary_position     public.field_position,
  putouts              smallint not null default 0 check (putouts >= 0),
  assists              smallint not null default 0 check (assists >= 0),
  errors               smallint not null default 0 check (errors >= 0),
  double_plays         smallint not null default 0 check (double_plays >= 0),
  -- catcher-only
  passed_balls         smallint not null default 0 check (passed_balls >= 0),
  stolen_bases_allowed smallint not null default 0 check (stolen_bases_allowed >= 0),
  runners_caught_stealing smallint not null default 0 check (runners_caught_stealing >= 0),
  source               public.stat_source not null default 'manual',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (game_id, player_id)
);
create index fielding_lines_player_idx on public.fielding_lines (player_id);

-- -----------------------------------------------------------------------------
-- Play-by-play
-- -----------------------------------------------------------------------------
create type public.pa_result as enum (
  'single', 'double', 'triple', 'home_run',
  'walk', 'intentional_walk', 'hit_by_pitch',
  'strikeout_swinging', 'strikeout_looking', 'dropped_third_strike',
  'groundout', 'flyout', 'lineout', 'popout',
  'sacrifice_bunt', 'sacrifice_fly', 'fielders_choice', 'reached_on_error',
  'double_play', 'triple_play', 'catcher_interference', 'other'
);
create type public.batted_ball_type as enum
  ('ground_ball', 'line_drive', 'fly_ball', 'popup', 'bunt', 'slap');
create type public.pitch_type as enum
  ('fastball', 'changeup', 'drop', 'rise', 'curve', 'screw', 'drop_curve', 'rise_curve', 'knuckle', 'other');
create type public.pitch_result as enum
  ('ball', 'intentional_ball', 'called_strike', 'swinging_strike', 'foul', 'foul_tip', 'in_play', 'hit_by_pitch');

create table public.plate_appearances (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games (id) on delete cascade,
  seq              smallint not null check (seq >= 1),      -- order within the game
  inning           smallint not null check (inning >= 1),
  half             text not null check (half in ('top', 'bottom')),
  batting_team_id  uuid not null references public.teams (id) on delete cascade,
  batter_id        uuid not null references public.players (id) on delete cascade,
  pitcher_id       uuid references public.players (id) on delete set null,
  outs_before      smallint not null default 0 check (outs_before between 0 and 2),
  runner_on_first  boolean not null default false,
  runner_on_second boolean not null default false,
  runner_on_third  boolean not null default false,
  result           public.pa_result not null,
  batted_ball      public.batted_ball_type,
  fielded_by       public.field_position,       -- who fielded / where it went
  spray_x          numeric(4,3) check (spray_x between 0 and 1),  -- 0 = LF line, 1 = RF line
  spray_y          numeric(4,3) check (spray_y between 0 and 1),  -- 0 = home plate, 1 = fence
  exit_velo_mph    numeric(4,1) check (exit_velo_mph > 0),
  rbi              smallint not null default 0 check (rbi between 0 and 4),
  outs_on_play     smallint not null default 0 check (outs_on_play between 0 and 3),
  notes            text,
  created_at       timestamptz not null default now(),
  unique (game_id, seq)
);
create index plate_appearances_batter_idx on public.plate_appearances (batter_id);
create index plate_appearances_pitcher_idx on public.plate_appearances (pitcher_id);

create table public.pitches (
  id                  uuid primary key default gen_random_uuid(),
  plate_appearance_id uuid not null references public.plate_appearances (id) on delete cascade,
  seq                 smallint not null check (seq >= 1),   -- pitch number within the PA
  pitch_type          public.pitch_type,
  velocity_mph        numeric(4,1) check (velocity_mph > 0),
  result              public.pitch_result not null,
  zone                smallint check (zone between 1 and 9 or zone between 11 and 14),
  created_at          timestamptz not null default now(),
  unique (plate_appearance_id, seq)
);
comment on column public.pitches.zone is
  '1-9 = strike zone grid from catcher view (1 top-left, 9 bottom-right); 11-14 = outside quadrants (11 up-left, 12 up-right, 13 down-left, 14 down-right).';

-- -----------------------------------------------------------------------------
-- Plate-appearance classification (used by the play-by-play views)
-- -----------------------------------------------------------------------------
create function public.pa_is_at_bat(r public.pa_result) returns boolean
language sql immutable set search_path = '' as $$
  select r not in ('walk', 'intentional_walk', 'hit_by_pitch', 'sacrifice_bunt',
                   'sacrifice_fly', 'catcher_interference', 'other')
$$;

create function public.pa_total_bases(r public.pa_result) returns smallint
language sql immutable set search_path = '' as $$
  select (case r when 'single' then 1 when 'double' then 2
                 when 'triple' then 3 when 'home_run' then 4 else 0 end)::smallint
$$;

create function public.pa_is_hit(r public.pa_result) returns boolean
language sql immutable set search_path = '' as $$
  select r in ('single', 'double', 'triple', 'home_run')
$$;

create function public.pa_on_base(r public.pa_result) returns boolean
language sql immutable set search_path = '' as $$
  select r in ('single', 'double', 'triple', 'home_run', 'walk', 'intentional_walk', 'hit_by_pitch')
$$;

-- -----------------------------------------------------------------------------
-- Season stat views (security_invoker: callers only see rows RLS allows)
-- Softball ERA and per-7 rates use 7-inning games.
-- -----------------------------------------------------------------------------
create view public.batting_season with (security_invoker = true) as
select
  g.season_id,
  b.team_id,
  b.player_id,
  count(*)::int                      as games,
  sum(b.plate_appearances)::int      as pa,
  sum(b.at_bats)::int                as ab,
  sum(b.runs)::int                   as r,
  sum(b.hits)::int                   as h,
  sum(b.doubles)::int                as doubles,
  sum(b.triples)::int                as triples,
  sum(b.home_runs)::int              as hr,
  sum(b.rbi)::int                    as rbi,
  sum(b.walks)::int                  as bb,
  sum(b.strikeouts)::int             as so,
  sum(b.hit_by_pitch)::int           as hbp,
  sum(b.sac_bunts)::int              as sac,
  sum(b.sac_flies)::int              as sf,
  sum(b.stolen_bases)::int           as sb,
  sum(b.caught_stealing)::int        as cs,
  sum(b.hits + b.doubles + 2 * b.triples + 3 * b.home_runs)::int as tb,
  round(sum(b.hits)::numeric / nullif(sum(b.at_bats), 0), 3) as avg,
  round(sum(b.hits + b.walks + b.hit_by_pitch)::numeric
        / nullif(sum(b.at_bats + b.walks + b.hit_by_pitch + b.sac_flies), 0), 3) as obp,
  round(sum(b.hits + b.doubles + 2 * b.triples + 3 * b.home_runs)::numeric
        / nullif(sum(b.at_bats), 0), 3) as slg,
  round(coalesce(sum(b.hits + b.walks + b.hit_by_pitch)::numeric
        / nullif(sum(b.at_bats + b.walks + b.hit_by_pitch + b.sac_flies), 0), 0)
      + coalesce(sum(b.hits + b.doubles + 2 * b.triples + 3 * b.home_runs)::numeric
        / nullif(sum(b.at_bats), 0), 0), 3) as ops,
  round(sum(b.doubles + 2 * b.triples + 3 * b.home_runs)::numeric
        / nullif(sum(b.at_bats), 0), 3) as iso,
  round(sum(b.hits - b.home_runs)::numeric
        / nullif(sum(b.at_bats - b.strikeouts - b.home_runs + b.sac_flies), 0), 3) as babip,
  round(100.0 * sum(b.strikeouts) / nullif(sum(b.plate_appearances), 0), 1) as k_pct,
  round(100.0 * sum(b.walks) / nullif(sum(b.plate_appearances), 0), 1)      as bb_pct
from public.batting_lines b
join public.games g on g.id = b.game_id
group by g.season_id, b.team_id, b.player_id;

create view public.pitching_season with (security_invoker = true) as
select
  g.season_id,
  p.team_id,
  p.player_id,
  count(*)::int                          as games,
  count(*) filter (where p.is_starter)::int as games_started,
  count(*) filter (where p.decision = 'W')::int as wins,
  count(*) filter (where p.decision = 'L')::int as losses,
  count(*) filter (where p.decision = 'S')::int as saves,
  sum(p.outs_recorded)::int              as outs,
  (sum(p.outs_recorded) / 3)::text || '.' || (sum(p.outs_recorded) % 3)::text as ip,
  round(sum(p.outs_recorded) / 3.0, 3)   as ip_decimal,
  sum(p.batters_faced)::int              as bf,
  sum(p.hits_allowed)::int               as h,
  sum(p.runs_allowed)::int               as r,
  sum(p.earned_runs)::int                as er,
  sum(p.walks)::int                      as bb,
  sum(p.strikeouts)::int                 as so,
  sum(p.hit_batters)::int                as hbp,
  sum(p.home_runs_allowed)::int          as hr,
  sum(p.wild_pitches)::int               as wp,
  sum(p.pitches)::int                    as pitches,
  round(21.0 * sum(p.earned_runs) / nullif(sum(p.outs_recorded), 0), 2) as era,
  round(3.0 * sum(p.walks + p.hits_allowed) / nullif(sum(p.outs_recorded), 0), 3) as whip,
  round(21.0 * sum(p.strikeouts) / nullif(sum(p.outs_recorded), 0), 2) as k_per_7,
  round(21.0 * sum(p.walks) / nullif(sum(p.outs_recorded), 0), 2) as bb_per_7,
  round(sum(p.strikeouts)::numeric / nullif(sum(p.walks), 0), 2) as k_bb,
  round(100.0 * sum(p.strikes) / nullif(sum(p.pitches), 0), 1) as strike_pct
from public.pitching_lines p
join public.games g on g.id = p.game_id
group by g.season_id, p.team_id, p.player_id;
comment on view public.pitching_season is
  'ERA = 7 x ER / IP (softball). ip is display form (12.1 = 12 1/3); use ip_decimal for math.';

create view public.fielding_season with (security_invoker = true) as
select
  g.season_id,
  f.team_id,
  f.player_id,
  count(*)::int                       as games,
  sum(f.putouts)::int                 as po,
  sum(f.assists)::int                 as a,
  sum(f.errors)::int                  as e,
  sum(f.double_plays)::int            as dp,
  sum(f.passed_balls)::int            as pb,
  sum(f.stolen_bases_allowed)::int    as sb_allowed,
  sum(f.runners_caught_stealing)::int as cs,
  round(sum(f.putouts + f.assists)::numeric
        / nullif(sum(f.putouts + f.assists + f.errors), 0), 3) as fpct,
  round(100.0 * sum(f.runners_caught_stealing)
        / nullif(sum(f.stolen_bases_allowed + f.runners_caught_stealing), 0), 1) as cs_pct
from public.fielding_lines f
join public.games g on g.id = f.game_id
group by g.season_id, f.team_id, f.player_id;

-- -----------------------------------------------------------------------------
-- Play-by-play views for strategy
-- -----------------------------------------------------------------------------

-- Every charted pitch with the count it was thrown in.
create view public.pitch_log with (security_invoker = true) as
select
  pt.id                  as pitch_id,
  pa.game_id,
  pa.id                  as plate_appearance_id,
  pa.inning,
  pa.half,
  pa.pitcher_id,
  pa.batter_id,
  bat.bats               as batter_bats,
  pit.throws             as pitcher_throws,
  pt.seq                 as pitch_number,
  pt.pitch_type,
  pt.velocity_mph,
  pt.result,
  pt.zone,
  -- count before this pitch. Fouls stop adding strikes at 2, which a cap at 2 reproduces.
  coalesce(count(*) filter (where pt.result in ('ball', 'intentional_ball'))
    over w, 0)::smallint as balls_before,
  least(2, coalesce(count(*) filter (where pt.result in ('called_strike', 'swinging_strike', 'foul', 'foul_tip'))
    over w, 0))::smallint as strikes_before,
  pa.result              as pa_result
from public.pitches pt
join public.plate_appearances pa on pa.id = pt.plate_appearance_id
join public.players bat on bat.id = pa.batter_id
left join public.players pit on pit.id = pa.pitcher_id
window w as (partition by pt.plate_appearance_id order by pt.seq
             rows between unbounded preceding and 1 preceding);

-- Pitcher tendencies: what they throw in each count situation.
create view public.pitcher_pitch_mix with (security_invoker = true) as
with situations as (
  select *,
    case
      when strikes_before = 2 then 'two_strikes'
      when balls_before > strikes_before then 'behind'
      when strikes_before > balls_before then 'ahead'
      else 'even'
    end as count_situation
  from public.pitch_log
  where pitcher_id is not null
)
select
  pitcher_id,
  count_situation,
  coalesce(pitch_type::text, 'unknown') as pitch_type,
  count(*)::int as pitches,
  round(100.0 * count(*) / sum(count(*)) over (partition by pitcher_id, count_situation), 1) as usage_pct,
  round(100.0 * count(*) filter (where result <> 'ball' and result <> 'intentional_ball' and result <> 'hit_by_pitch')
        / count(*), 1) as strike_pct,
  round(100.0 * count(*) filter (where result = 'swinging_strike')
        / nullif(count(*) filter (where result in ('swinging_strike', 'foul', 'foul_tip', 'in_play')), 0), 1) as whiff_pct,
  round(avg(velocity_mph), 1) as avg_velo
from situations
group by pitcher_id, count_situation, coalesce(pitch_type::text, 'unknown');

-- Hitter splits from charted plate appearances.
create view public.batter_splits with (security_invoker = true) as
with pa as (
  select
    pa.*,
    pit.throws as pitcher_throws,
    (pa.runner_on_second or pa.runner_on_third) as risp
  from public.plate_appearances pa
  left join public.players pit on pit.id = pa.pitcher_id
),
tagged as (
  select pa.*, s.split
  from pa
  cross join lateral (values
    ('overall', true),
    ('vs_rhp', pa.pitcher_throws = 'R'),
    ('vs_lhp', pa.pitcher_throws = 'L'),
    ('risp', pa.risp),
    ('two_outs', pa.outs_before = 2),
    ('bases_empty', not (pa.runner_on_first or pa.runner_on_second or pa.runner_on_third))
  ) as s(split, applies)
  where s.applies
)
select
  batter_id,
  split,
  count(*)::int                                            as pa,
  count(*) filter (where public.pa_is_at_bat(result))::int as ab,
  count(*) filter (where public.pa_is_hit(result))::int    as h,
  count(*) filter (where result in ('strikeout_swinging', 'strikeout_looking', 'dropped_third_strike'))::int as so,
  count(*) filter (where result in ('walk', 'intentional_walk'))::int as bb,
  round(count(*) filter (where public.pa_is_hit(result))::numeric
        / nullif(count(*) filter (where public.pa_is_at_bat(result)), 0), 3) as avg,
  round(count(*) filter (where public.pa_on_base(result))::numeric
        / nullif(count(*) filter (where public.pa_is_at_bat(result)
                                   or result in ('walk', 'intentional_walk', 'hit_by_pitch', 'sacrifice_fly')), 0), 3) as obp,
  round(sum(public.pa_total_bases(result))::numeric
        / nullif(count(*) filter (where public.pa_is_at_bat(result)), 0), 3) as slg,
  round(100.0 * count(*) filter (where batted_ball = 'ground_ball') / nullif(count(batted_ball), 0), 1) as gb_pct,
  round(100.0 * count(*) filter (where batted_ball in ('bunt', 'slap')) / nullif(count(batted_ball), 0), 1) as short_game_pct,
  round(avg(exit_velo_mph), 1) as avg_exit_velo
from tagged
group by batter_id, split;

-- -----------------------------------------------------------------------------
-- Triggers + RLS
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.batting_lines
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.pitching_lines
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fielding_lines
  for each row execute function private.set_updated_at();

select private.apply_staff_rls('public.batting_lines');
select private.apply_staff_rls('public.pitching_lines');
select private.apply_staff_rls('public.fielding_lines');
select private.apply_staff_rls('public.plate_appearances');
select private.apply_staff_rls('public.pitches');
