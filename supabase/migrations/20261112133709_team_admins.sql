-- Team admins (user, 2026-11-12): the head coach gives an approved parent of the team the
-- team admin role. A team admin edits, for that team only:
--   * the calendar (team_events);
--   * measurements on the players' Pop Reports (measurements);
--   * GameDay in the Coaches Dugout: lineups and player cards, the depth chart and box
--     scores (gameday_*, depth_chart, the box-score lines, the game's final score).
-- They stay parents, not staff: no other team data. Teammates' names come through
-- team_admin_roster() (name, number, positions), never the players table itself, so
-- coach notes and birth dates stay out of reach. The role lapses with the parent link.

create table public.team_admins (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  granted_by uuid default auth.uid() references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
comment on table public.team_admins is
  'Parents the head coach made team admin: they edit the calendar, measurements and GameDay for that team.';
create index team_admins_user_idx on public.team_admins (user_id);
-- Exception to apply_staff_rls (reason: changes go through set_team_admin(), which checks
-- the head coach and the parent link): staff read the list; a team admin reads their own rows.
alter table public.team_admins enable row level security;
grant select on public.team_admins to authenticated;
create policy "staff read team admins" on public.team_admins for select to authenticated
  using ((select private.is_staff()));
create policy "team admins read their own" on public.team_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- The teams the signed-in user is team admin of, while still an approved parent there
create function private.my_admin_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select a.team_id from public.team_admins a
   where a.user_id = (select auth.uid())
     and exists (select 1 from public.parent_links l
                  where l.parent_id = a.user_id and l.team_id = a.team_id and l.status = 'approved')
$$;
-- those teams' current rosters
create function private.my_admin_player_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.player_id from public.roster_entries r
   where r.team_id in (select private.my_admin_team_ids())
     and r.active and r.season_id = private.team_current_season(r.team_id)
$$;
create function private.is_team_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.my_admin_team_ids())
$$;
revoke all on function private.my_admin_team_ids(), private.my_admin_player_ids(), private.is_team_admin() from public;
grant execute on function private.my_admin_team_ids(), private.my_admin_player_ids(), private.is_team_admin() to authenticated;
-- the app asks which teams (the Dugout's team list, the family page)
select private.expose('private.my_admin_team_ids()');

-- The head coach turns the role on or off for one of the team's approved parents.
create function private.set_team_admin(p_team_id uuid, p_user_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_head_coach()) then
    raise exception 'only a head coach names team admins' using errcode = '42501';
  end if;
  if p_on then
    if not exists (select 1 from public.parent_links l
                    where l.parent_id = p_user_id and l.team_id = p_team_id and l.status = 'approved') then
      raise exception 'only an approved parent of the team can be its team admin' using errcode = 'P0006';
    end if;
    insert into public.team_admins (team_id, user_id) values (p_team_id, p_user_id) on conflict do nothing;
  else
    delete from public.team_admins where team_id = p_team_id and user_id = p_user_id;
  end if;
end $$;
select private.expose('private.set_team_admin(uuid, uuid, boolean)');

-- The team's roster for a team admin's pages (and staff): names, numbers and positions only.
create function private.team_admin_roster(p_team_id uuid, p_season_id uuid)
returns table (id uuid, first_name text, last_name text, preferred_name text,
               primary_position public.field_position, secondary_positions public.field_position[], jersey_number text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select private.is_staff()) or p_team_id in (select private.my_admin_team_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select p.id, p.first_name, p.last_name, p.preferred_name, p.primary_position, p.secondary_positions, r.jersey_number
      from public.roster_entries r
      join public.players p on p.id = r.player_id
     where r.team_id = p_team_id and r.active
       and r.season_id = coalesce(p_season_id, private.team_current_season(p_team_id));
end $$;
select private.expose('private.team_admin_roster(uuid, uuid)');

-- -----------------------------------------------------------------------------
-- What a team admin reads and writes, for their own teams
-- -----------------------------------------------------------------------------
create policy "team admins read their teams" on public.teams for select to authenticated
  using (id in (select private.my_admin_team_ids()));
create policy "team admins read the seasons" on public.seasons for select to authenticated
  using ((select private.is_team_admin()));
create policy "team admins read their rosters" on public.roster_entries for select to authenticated
  using (team_id in (select private.my_admin_team_ids()));

-- the calendar
create policy "team admins keep the calendar" on public.team_events for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));

-- GameDay: lineups and player cards, the depth chart, the staff duties it fills jobs from (read)
create policy "team admins keep GameDay lineups" on public.gameday_lineups for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));
create policy "team admins keep GameDay cards" on public.gameday_profiles for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));
create policy "team admins keep the depth chart" on public.depth_chart for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));
create policy "team admins read staff duties" on public.staff_duties for select to authenticated
  using (team_id in (select private.my_admin_team_ids()));

-- box scores: the team's lines and grades, and the game's final score
create policy "team admins read their games" on public.games for select to authenticated
  using (home_team_id in (select private.my_admin_team_ids()) or away_team_id in (select private.my_admin_team_ids()));
create policy "team admins score their games" on public.games for update to authenticated
  using (home_team_id in (select private.my_admin_team_ids()) or away_team_id in (select private.my_admin_team_ids()))
  with check (home_team_id in (select private.my_admin_team_ids()) or away_team_id in (select private.my_admin_team_ids()));
create policy "team admins keep batting lines" on public.batting_lines for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));
create policy "team admins keep pitching lines" on public.pitching_lines for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));
create policy "team admins keep fielding lines" on public.fielding_lines for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));
create policy "team admins keep plate-appearance grades" on public.pa_grades for all to authenticated
  using (team_id in (select private.my_admin_team_ids()))
  with check (team_id in (select private.my_admin_team_ids()));

-- measurements on the Pop Report, for the team's current roster
create policy "team admins read the metric list" on public.metrics for select to authenticated
  using ((select private.is_team_admin()));
create policy "team admins read their teams' measurement lists" on public.team_measurements for select to authenticated
  using (team_id in (select private.my_admin_team_ids()));
create policy "team admins keep measurements" on public.measurements for all to authenticated
  using (player_id in (select private.my_admin_player_ids()))
  with check (player_id in (select private.my_admin_player_ids()));

-- Box scores: a team admin saves the team's box score like a coach does.
create or replace function public.save_box_score(p_game_id uuid, p_team_id uuid, p_box jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_game public.games%rowtype;
  v_us   int := (p_box ->> 'us')::int;
  v_them int := (p_box ->> 'them')::int;
begin
  if not ((select private.can_edit()) or p_team_id in (select private.my_admin_team_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'unknown game' using errcode = 'P0002';
  end if;
  if p_team_id is distinct from v_game.home_team_id and p_team_id is distinct from v_game.away_team_id then
    raise exception 'that team isn''t in this game' using errcode = '22023';
  end if;

  delete from public.pa_grades where game_id = p_game_id and team_id = p_team_id;
  delete from public.batting_lines where game_id = p_game_id and team_id = p_team_id;
  delete from public.pitching_lines where game_id = p_game_id and team_id = p_team_id;
  delete from public.fielding_lines where game_id = p_game_id and team_id = p_team_id;

  insert into public.batting_lines (game_id, team_id, player_id, plate_appearances, at_bats, runs, hits, doubles, triples,
                                    home_runs, rbi, walks, strikeouts, hit_by_pitch, sac_bunts, sac_flies, stolen_bases, caught_stealing)
  select p_game_id, p_team_id, x.player_id, x.pa, x.ab, x.r, x.h, x.d, x.t, x.hr, x.rbi, x.bb, x.so, x.hbp, x.sac, x.sf, x.sb, x.cs
    from jsonb_to_recordset(coalesce(p_box -> 'batting', '[]')) as x(
      player_id uuid, pa smallint, ab smallint, r smallint, h smallint, d smallint, t smallint, hr smallint, rbi smallint,
      bb smallint, so smallint, hbp smallint, sac smallint, sf smallint, sb smallint, cs smallint);

  insert into public.pitching_lines (game_id, team_id, player_id, is_starter, outs_recorded, batters_faced, hits_allowed, runs_allowed,
                                     earned_runs, walks, strikeouts, hit_batters, home_runs_allowed, wild_pitches, pitches, strikes, decision)
  select p_game_id, p_team_id, x.player_id, coalesce(x.starter, false), x.outs, x.bf, x.h, x.r, x.er, x.bb, x.so, x.hbp, x.hr, x.wp,
         x.pitches, x.strikes, x.decision
    from jsonb_to_recordset(coalesce(p_box -> 'pitching', '[]')) as x(
      player_id uuid, starter boolean, outs smallint, bf smallint, h smallint, r smallint, er smallint, bb smallint, so smallint,
      hbp smallint, hr smallint, wp smallint, pitches smallint, strikes smallint, decision text);

  insert into public.fielding_lines (game_id, team_id, player_id, putouts, assists, errors, double_plays, passed_balls,
                                     stolen_bases_allowed, runners_caught_stealing)
  select p_game_id, p_team_id, x.player_id, x.po, x.a, x.e, x.dp, x.pb, x.sba, x.cs
    from jsonb_to_recordset(coalesce(p_box -> 'fielding', '[]')) as x(
      player_id uuid, po smallint, a smallint, e smallint, dp smallint, pb smallint, sba smallint, cs smallint);

  insert into public.pa_grades (game_id, team_id, player_id, pa_no, grade)
  select p_game_id, p_team_id, x.player_id, x.pa_no, x.grade
    from jsonb_to_recordset(coalesce(p_box -> 'grades', '[]')) as x(player_id uuid, pa_no smallint, grade smallint);

  if v_us is not null and v_them is not null then
    update public.games
       set home_score = case when home_team_id = p_team_id then v_us else v_them end,
           away_score = case when home_team_id = p_team_id then v_them else v_us end,
           status = 'final'
     where id = p_game_id;
  end if;
end $$;
