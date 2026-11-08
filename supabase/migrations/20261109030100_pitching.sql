-- =============================================================================
-- Pitching & catching (SB Blueprint Phase 4, user 2026-11-08)
--   96 Battery IQ: questions in supabase/iq/battery.json (migration 20261109030000);
--      the track works like Offense IQ (MVP badges, no ring).
--   97 Scripted bullpens: coaches write scripts per team (pitch, target zone, intent,
--      count); she throws one and taps hit or miss on each pitch (bullpen_sessions);
--      command % by pitch type (src/lib/bullpen.ts). A team routine can carry a
--      script, so it shows in TWIS with "Start".
--   99 Pitcher's game plan: before a game her plan (first pitch, out pitch, reset,
--      hitters to watch); after it a look-back (pitcher_game_plans).
-- =============================================================================

create table public.bullpen_scripts (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  notes      text check (char_length(notes) <= 300),
  pitches    jsonb not null check (jsonb_typeof(pitches) = 'array' and jsonb_array_length(pitches) between 1 and 80),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bullpen_scripts_team_idx on public.bullpen_scripts (team_id);
select private.apply_staff_rls('public.bullpen_scripts');
create policy "player reads her team's scripts" on public.bullpen_scripts for select to authenticated
  using (team_id in (select private.my_current_team_ids()));

create table public.bullpen_sessions (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  script_id  uuid references public.bullpen_scripts (id) on delete set null,
  thrown_on  date not null,
  results    jsonb not null check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) between 1 and 80),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index bullpen_sessions_player_idx on public.bullpen_sessions (player_id, thrown_on desc);

create table public.pitcher_game_plans (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  game_id     uuid references public.games (id) on delete set null,
  plan_date   date not null,
  opponent    text check (char_length(opponent) <= 80),
  first_pitch text check (char_length(first_pitch) <= 300),
  out_pitch   text check (char_length(out_pitch) <= 300),
  reset       text check (char_length(reset) <= 300),
  watch       text check (char_length(watch) <= 500),
  worked      text check (char_length(worked) <= 500),
  fix         text check (char_length(fix) <= 500),
  strike_pct  smallint check (strike_pct between 0 and 100),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (player_id, game_id)
);
create index pitcher_game_plans_player_idx on public.pitcher_game_plans (player_id, plan_date desc);

do $$
declare
  t text;
begin
  foreach t in array array['bullpen_sessions', 'pitcher_game_plans'] loop
    perform private.apply_staff_rls(format('public.%I', t)::regclass);
    execute format('create policy "player manages her own" on public.%I for all to authenticated
                      using (player_id in (select private.my_player_ids()))
                      with check (player_id in (select private.my_player_ids()))', t);
    execute format('create policy "mentor reads her players''" on public.%I for select to authenticated
                      using (player_id in (select private.my_mentee_ids()))', t);
  end loop;
end $$;

-- A routine can carry a bullpen script (TWIS shows "Start" on it)
alter table public.team_routines
  add column bullpen_script_id uuid references public.bullpen_scripts (id) on delete set null;
alter table public.player_activities
  add column bullpen_script_id uuid references public.bullpen_scripts (id) on delete set null;

-- Team routine copies carry the script too
create or replace function private.sync_team_routine(p_routine_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r       public.team_routines;
  v_today date := private.team_today();
  v_added integer;
begin
  select * into r from public.team_routines where id = p_routine_id;
  if not found then
    return 0;
  end if;
  insert into public.player_activities (player_id, title, details, days, starts_on, ends_on, category, drill_id, bullpen_script_id, source, team_routine_id, created_by)
  select tr.player_id, r.title, r.details, r.days, r.starts_on, r.ends_on, r.category, r.drill_id, r.bullpen_script_id, 'coach', r.id, r.created_by
    from private.team_roster(r.team_id) tr
   where not exists (select 1 from public.player_activities a where a.team_routine_id = r.id and a.player_id = tr.player_id);
  get diagnostics v_added = row_count;
  update public.player_activities a
     set title = r.title, details = r.details, days = r.days, starts_on = r.starts_on, ends_on = r.ends_on,
         category = r.category, drill_id = r.drill_id, bullpen_script_id = r.bullpen_script_id
   where a.team_routine_id = r.id and a.player_id in (select tr.player_id from private.team_roster(r.team_id) tr);
  update public.player_activities a
     set ends_on = greatest(a.starts_on, least(coalesce(a.ends_on, v_today), v_today))
   where a.team_routine_id = r.id
     and a.player_id not in (select tr.player_id from private.team_roster(r.team_id) tr)
     and (a.ends_on is null or a.ends_on > v_today);
  return v_added;
end;
$$;
