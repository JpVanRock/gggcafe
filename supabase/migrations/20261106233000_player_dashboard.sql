-- =============================================================================
-- GGG.Cafe — Player dashboard
--
-- TWIS (This Week in Softball): the team schedule (practices and other events
--   here; games come from public.games), activities each player commits to,
--   and check-offs for all of them.
-- Goals (Harada Method): one main goal, 8 supporting areas ("pillars"), and up
--   to 8 actions per area — the 64-square "Open Window 64" chart.
-- Mental Game Plan: one per player.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Team schedule (added by coaches/admins)
-- -----------------------------------------------------------------------------
create type public.team_event_kind as enum ('practice', 'workout', 'lesson', 'meeting', 'other');

create table public.team_events (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  kind       public.team_event_kind not null default 'practice',
  title      text,                 -- optional; the app falls back to the kind
  event_date date not null,
  start_time time,
  end_time   time,
  location   text,
  notes      text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);
create index team_events_team_date_idx on public.team_events (team_id, event_date);

-- -----------------------------------------------------------------------------
-- Goals: Harada Method
-- -----------------------------------------------------------------------------
create type public.plan_status as enum ('active', 'achieved', 'archived');

create table public.harada_plans (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  main_goal   text not null,
  purpose     text,                -- why this goal matters to the player
  target_date date,
  status      public.plan_status not null default 'active',
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index harada_plans_one_active_idx on public.harada_plans (player_id) where status = 'active';

create table public.harada_pillars (
  id       uuid primary key default gen_random_uuid(),
  plan_id  uuid not null references public.harada_plans (id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  title    text not null,
  unique (plan_id, position)
);

create table public.harada_actions (
  id        uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references public.harada_pillars (id) on delete cascade,
  position  smallint not null check (position between 1 and 8),
  title     text not null,
  done_on   date,                  -- null = not done yet
  unique (pillar_id, position)
);

create view public.harada_pillar_progress with (security_invoker = true) as
select
  p.plan_id,
  p.id        as pillar_id,
  p.position,
  p.title,
  count(a.id)::int      as actions,
  count(a.done_on)::int as done
from public.harada_pillars p
left join public.harada_actions a on a.pillar_id = p.id
group by p.plan_id, p.id, p.position, p.title;

-- Saves a whole Harada chart in one transaction. Runs with the caller's rights,
-- so RLS still decides who may write. Blank pillars/actions are removed;
-- existing ones keep their ids (and done dates) by position.
-- p_chart: {"main_goal", "purpose", "target_date",
--           "pillars": [{"position", "title", "actions": [{"position", "title"}]}]}
create function public.save_harada_plan(p_player_id uuid, p_chart jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_plan_id   uuid;
  v_pillar_id uuid;
  v_pillar    jsonb;
  v_action    jsonb;
  v_kept_pillars  smallint[] := '{}';
  v_kept_actions  smallint[];
begin
  if coalesce(trim(p_chart ->> 'main_goal'), '') = '' then
    raise exception 'main_goal is required' using errcode = '23514';
  end if;

  select id into v_plan_id from public.harada_plans
   where player_id = p_player_id and status = 'active';

  if v_plan_id is null then
    insert into public.harada_plans (player_id, main_goal, purpose, target_date)
    values (p_player_id, trim(p_chart ->> 'main_goal'),
            nullif(trim(p_chart ->> 'purpose'), ''), nullif(p_chart ->> 'target_date', '')::date)
    returning id into v_plan_id;
  else
    update public.harada_plans
       set main_goal = trim(p_chart ->> 'main_goal'),
           purpose = nullif(trim(p_chart ->> 'purpose'), ''),
           target_date = nullif(p_chart ->> 'target_date', '')::date
     where id = v_plan_id;
  end if;

  for v_pillar in select * from jsonb_array_elements(coalesce(p_chart -> 'pillars', '[]'::jsonb)) loop
    continue when coalesce(trim(v_pillar ->> 'title'), '') = '';
    insert into public.harada_pillars (plan_id, position, title)
    values (v_plan_id, (v_pillar ->> 'position')::smallint, trim(v_pillar ->> 'title'))
    on conflict (plan_id, position) do update set title = excluded.title
    returning id into v_pillar_id;
    v_kept_pillars := v_kept_pillars || (v_pillar ->> 'position')::smallint;

    v_kept_actions := '{}';
    for v_action in select * from jsonb_array_elements(coalesce(v_pillar -> 'actions', '[]'::jsonb)) loop
      continue when coalesce(trim(v_action ->> 'title'), '') = '';
      insert into public.harada_actions (pillar_id, position, title)
      values (v_pillar_id, (v_action ->> 'position')::smallint, trim(v_action ->> 'title'))
      on conflict (pillar_id, position) do update set title = excluded.title;
      v_kept_actions := v_kept_actions || (v_action ->> 'position')::smallint;
    end loop;
    delete from public.harada_actions
     where pillar_id = v_pillar_id and not (position = any (v_kept_actions));
  end loop;

  delete from public.harada_pillars
   where plan_id = v_plan_id and not (position = any (v_kept_pillars));

  return v_plan_id;
end;
$$;
revoke all on function public.save_harada_plan(uuid, jsonb) from public, anon;
grant execute on function public.save_harada_plan(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Activities a player commits to (shown in TWIS)
-- -----------------------------------------------------------------------------
create table public.player_activities (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  title      text not null,
  details    text,
  -- ISO weekdays, 1 = Monday ... 7 = Sunday. Empty = once a week, any day.
  days       smallint[] not null default '{}',
  starts_on  date not null default current_date,
  ends_on    date,                 -- null = ongoing
  pillar_id  uuid references public.harada_pillars (id) on delete set null,  -- goal area it supports
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  check (ends_on is null or ends_on >= starts_on)
);
create index player_activities_player_idx on public.player_activities (player_id, starts_on);

-- -----------------------------------------------------------------------------
-- TWIS check-offs: exactly one of activity / team event / game per row
-- -----------------------------------------------------------------------------
create table public.twis_checks (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players (id) on delete cascade,
  activity_id   uuid references public.player_activities (id) on delete cascade,
  team_event_id uuid references public.team_events (id) on delete cascade,
  game_id       uuid references public.games (id) on delete cascade,
  on_date       date not null,     -- day it was done (weekly items: the week's Monday)
  checked_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(activity_id, team_event_id, game_id) = 1),
  unique nulls not distinct (player_id, activity_id, team_event_id, game_id, on_date)
);
create index twis_checks_player_date_idx on public.twis_checks (player_id, on_date);

-- -----------------------------------------------------------------------------
-- Mental Game Plan
-- -----------------------------------------------------------------------------
create table public.mental_game_plans (
  id                    uuid primary key default gen_random_uuid(),
  player_id             uuid not null unique references public.players (id) on delete cascade,
  focus_words           text,      -- cue words to come back to
  pre_game_routine      text,
  pre_pitch_routine     text,      -- between pitches / before each at-bat
  reset_routine         text,      -- after a mistake
  confidence_statements text,
  pressure_plan         text,      -- big moments
  notes                 text,
  updated_by            uuid default auth.uid() references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Triggers + RLS
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.team_events
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.harada_plans
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.player_activities
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.mental_game_plans
  for each row execute function private.set_updated_at();

select private.apply_staff_rls('public.team_events');
select private.apply_staff_rls('public.harada_plans');
select private.apply_staff_rls('public.harada_pillars');
select private.apply_staff_rls('public.harada_actions');
select private.apply_staff_rls('public.player_activities');
select private.apply_staff_rls('public.twis_checks');
select private.apply_staff_rls('public.mental_game_plans');
