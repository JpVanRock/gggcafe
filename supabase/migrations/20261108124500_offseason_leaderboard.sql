-- =============================================================================
-- GGG.Cafe — Offseason Training Leaderboard and Player of the Week
--
-- Coaches set each team's offseason dates. Inside them, players earn points
-- (user, 2026-11-08):
--   3  per site unlock (ring, Golden Glove, MVP badge, Champions Trophy,
--      Manager of the Year, hidden award, training achievement)
--   3  per training session (tee work, bullpen...): a logged "training"
--      session, or a checked-off training routine other than a workout
--   5  per workout session (logged, or a checked-off workout routine)
--   7  per private lesson (logged)
-- The Leader Badge is not counted (only coaches and the player may know of it).
--
-- Player of the Week (Monday-Sunday, decided from the Tuesday after, so a
-- Sunday session logged late still counts): the most points that week wins,
-- with at least 10 points. Rounds: once a player is named, she can't win again
-- until every teammate on the roster has been named (unless nobody new
-- qualifies), and never within six weeks of her last win.
--
-- Teammates see each other only through public.team_leaderboard() (names,
-- jersey numbers, point totals), never the underlying rows. "Today" is the
-- team's day in America/New_York, matching APP_TIME_ZONE's default.
-- =============================================================================

-- Each team's offseason training window (no end date = still going).
create table public.team_offseason (
  team_id    uuid primary key references public.teams (id) on delete cascade,
  starts_on  date not null,
  ends_on    date,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
comment on table public.team_offseason is 'Offseason Training Leaderboard: the dates that count, per team (coaches set them).';
select private.apply_staff_rls('public.team_offseason');

create function private.team_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/New_York')::date
$$;

-- Sessions a player logs with + Activity (routines checked off in TWIS count on their own).
create type public.session_kind as enum ('training', 'workout', 'lesson');

create table public.training_logs (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  kind       public.session_kind not null,
  logged_on  date not null,
  note       text check (note is null or char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index training_logs_player_idx on public.training_logs (player_id, logged_on);
comment on table public.training_logs is
  'Sessions logged with + Activity: training (3 pts), workout (5), private lesson (7). Players log their own, up to 7 days back.';
select private.apply_staff_rls('public.training_logs');
create policy "player reads her own sessions" on public.training_logs for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player logs her own sessions" on public.training_logs for insert to authenticated
  with check (
    player_id in (select private.my_player_ids())
    and logged_on <= private.team_today()
    and logged_on >= private.team_today() - 7
  );
create policy "player removes her own sessions" on public.training_logs for delete to authenticated
  using (player_id in (select private.my_player_ids()));

-- Four sessions a day is plenty; keeps the board honest.
create function private.training_logs_daily_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.training_logs where player_id = new.player_id and logged_on = new.logged_on) >= 4 then
    raise exception 'Four sessions a day is the limit.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger training_logs_daily_cap before insert on public.training_logs
  for each row execute function private.training_logs_daily_cap();

-- Player of the Week, one row per team and week (player_id null: nobody qualified).
create table public.team_player_of_week (
  team_id    uuid not null references public.teams (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  player_id  uuid references public.players (id) on delete set null,
  points     integer not null default 0,
  round      integer not null default 1,
  decided_at timestamptz not null default now(),
  primary key (team_id, week_start)
);
comment on table public.team_player_of_week is
  'Player of the Week per team: written by public.team_leaderboard() once a week is over (rounds + six-week rule).';
select private.apply_staff_rls('public.team_player_of_week');

-- One player's points between two dates (inclusive).
create function private.offseason_tally(p_player_id uuid, p_from date, p_to date)
returns table (training integer, workouts integer, lessons integer, unlocks integer, points integer)
language sql stable security definer set search_path = '' as $$
  with sessions as (
    select l.kind::text as kind
      from public.training_logs l
     where l.player_id = p_player_id and l.logged_on between p_from and p_to
    union all
    select case when a.category = 'workout' then 'workout' else 'training' end
      from public.twis_checks c
      join public.player_activities a on a.id = c.activity_id
     where c.player_id = p_player_id and a.category is not null and c.on_date between p_from and p_to
  ),
  earned as (
    select count(*)::integer as n from (
      select earned_on as d from public.player_rings where player_id = p_player_id
      union all select earned_on from public.player_golden_gloves where player_id = p_player_id
      union all select earned_on from public.player_mvp_badges where player_id = p_player_id
      union all select earned_on from public.player_world_series_trophies where player_id = p_player_id
      union all select earned_on from public.player_manager_awards where player_id = p_player_id
      union all select earned_on from public.player_hidden_awards where player_id = p_player_id
      union all select unlocked_on from public.player_achievements where player_id = p_player_id
    ) u where u.d between p_from and p_to
  ),
  counts as (
    select count(*) filter (where kind = 'training')::integer as training,
           count(*) filter (where kind = 'workout')::integer as workouts,
           count(*) filter (where kind = 'lesson')::integer as lessons
      from sessions
  )
  select c.training, c.workouts, c.lessons, e.n,
         3 * c.training + 5 * c.workouts + 7 * c.lessons + 3 * e.n
    from counts c cross join earned e
$$;

-- The team's current roster (latest season, active spots).
create function private.team_roster(p_team_id uuid)
returns table (player_id uuid, jersey_number text)
language sql stable security definer set search_path = '' as $$
  select distinct on (r.player_id) r.player_id, r.jersey_number
    from public.roster_entries r
   where r.team_id = p_team_id and r.active and r.season_id = private.team_current_season(p_team_id)
   order by r.player_id
$$;

-- Decides every finished week that isn't decided yet (a week is decided from its Tuesday after).
create function private.decide_players_of_week(p_team_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_off    public.team_offseason;
  v_today  date := private.team_today();
  v_week   date;
  v_from   date;
  v_to     date;
  v_round  integer;
  v_roster uuid[];
  v_winner uuid;
  v_points integer;
begin
  select * into v_off from public.team_offseason where team_id = p_team_id;
  if not found then return; end if;
  select coalesce(array_agg(player_id), '{}') into v_roster from private.team_roster(p_team_id);
  v_week := v_off.starts_on - (extract(isodow from v_off.starts_on)::integer - 1);
  while v_week + 8 <= v_today and (v_off.ends_on is null or v_week <= v_off.ends_on) loop
    if not exists (select 1 from public.team_player_of_week where team_id = p_team_id and week_start = v_week) then
      v_from := greatest(v_week, v_off.starts_on);
      v_to := least(v_week + 6, coalesce(v_off.ends_on, v_week + 6));
      v_round := coalesce((select max(round) from public.team_player_of_week where team_id = p_team_id), 1);
      -- a round is over once everyone on the roster has been named in it
      if cardinality(v_roster) > 0 and not exists (
        select 1 from unnest(v_roster) as r(id)
         where not exists (select 1 from public.team_player_of_week w
                            where w.team_id = p_team_id and w.round = v_round and w.player_id = r.id)
      ) then
        v_round := v_round + 1;
      end if;
      v_winner := null;
      v_points := 0;
      select c.player_id, c.points into v_winner, v_points
        from (
          select r.id as player_id, t.points,
                 exists (select 1 from public.team_player_of_week w
                          where w.team_id = p_team_id and w.round = v_round and w.player_id = r.id) as named_this_round,
                 (select count(*) from public.team_player_of_week w where w.team_id = p_team_id and w.player_id = r.id) as times,
                 (select max(w.week_start) from public.team_player_of_week w where w.team_id = p_team_id and w.player_id = r.id) as last_week
            from unnest(v_roster) as r(id)
            cross join lateral private.offseason_tally(r.id, v_from, v_to) t
        ) c
       where c.points >= 10
         and (c.last_week is null or c.last_week <= v_week - 42)
       order by c.named_this_round, c.points desc, c.times, c.last_week nulls first, c.player_id
       limit 1;
      insert into public.team_player_of_week (team_id, week_start, player_id, points, round)
      values (p_team_id, v_week, v_winner, coalesce(v_points, 0), v_round)
      on conflict do nothing;
    end if;
    v_week := v_week + 7;
  end loop;
end $$;

-- Everything the Leaderboard page shows, for staff or a player on the team this season.
create function private.team_leaderboard(p_team_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_off   public.team_offseason;
  v_today date := private.team_today();
  v_to    date;
  v_week  date := private.team_today() - (extract(isodow from private.team_today())::integer - 1);
begin
  if not ((select private.is_staff()) or p_team_id in (select private.my_current_team_ids())) then
    raise exception 'You can only see your own team''s leaderboard.' using errcode = '42501';
  end if;
  select * into v_off from public.team_offseason where team_id = p_team_id;
  if not found then
    return jsonb_build_object('offseason', null, 'today', v_today);
  end if;
  perform private.decide_players_of_week(p_team_id);
  v_to := least(coalesce(v_off.ends_on, v_today), v_today);
  return jsonb_build_object(
    'offseason', jsonb_build_object('starts_on', v_off.starts_on, 'ends_on', v_off.ends_on),
    'today', v_today,
    'week_start', v_week,
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'player_id', r.player_id, 'jersey_number', r.jersey_number,
               'first_name', coalesce(p.preferred_name, p.first_name), 'last_name', p.last_name,
               'training', t.training, 'workouts', t.workouts, 'lessons', t.lessons, 'unlocks', t.unlocks, 'points', t.points,
               'week_points', w.points,
               'times_named', (select count(*) from public.team_player_of_week x where x.team_id = p_team_id and x.player_id = r.player_id),
               'last_named', (select max(x.week_start) from public.team_player_of_week x where x.team_id = p_team_id and x.player_id = r.player_id)
             )), '[]'::jsonb)
        from private.team_roster(p_team_id) r
        join public.players p on p.id = r.player_id
        cross join lateral private.offseason_tally(r.player_id, v_off.starts_on, v_to) t
        cross join lateral private.offseason_tally(r.player_id, greatest(v_week, v_off.starts_on),
                                                   least(v_today, coalesce(v_off.ends_on, v_today))) w
    ),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'week_start', x.week_start, 'player_id', x.player_id, 'points', x.points, 'round', x.round,
               'first_name', coalesce(p.preferred_name, p.first_name), 'last_name', p.last_name
             ) order by x.week_start desc), '[]'::jsonb)
        from public.team_player_of_week x
        left join public.players p on p.id = x.player_id
       where x.team_id = p_team_id
    )
  );
end $$;

revoke all on function private.team_today(), private.offseason_tally(uuid, date, date), private.team_roster(uuid),
  private.decide_players_of_week(uuid), private.team_leaderboard(uuid), private.training_logs_daily_cap() from public;
grant execute on function private.team_today(), private.offseason_tally(uuid, date, date), private.team_roster(uuid),
  private.decide_players_of_week(uuid), private.team_leaderboard(uuid) to authenticated;

create function public.team_leaderboard(p_team_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.team_leaderboard(p_team_id)
$$;
revoke all on function public.team_leaderboard(uuid) from public;
grant execute on function public.team_leaderboard(uuid) to authenticated;
