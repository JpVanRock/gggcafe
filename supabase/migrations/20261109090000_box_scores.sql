-- =============================================================================
-- Game-day production, part 2 (SB Blueprint Phase 9, user 2026-11-08)
--   Box-score entry: save_box_score() writes a team's batting, pitching and fielding
--      lines for one game in one transaction (RLS applies) and sets the final score.
--   95 "How it's figured": players read their own lines now, so her stats card can
--      show them (the season views are security_invoker).
--   21 Quality at-bats and BP production: a 0-5 grade per plate appearance
--      (pa_grades, entered with the box score) and per BP swing (bp_rounds);
--      qab_season sums them; team_bp_leaders() shows the team's top BP production
--      on the Leaderboard.
-- =============================================================================

-- Her own box-score lines (and so her season stats through the invoker views)
create policy "player reads her batting lines" on public.batting_lines for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her pitching lines" on public.pitching_lines for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player reads her fielding lines" on public.fielding_lines for select to authenticated
  using (player_id in (select private.my_player_ids()));

-- -----------------------------------------------------------------------------
-- Quality at-bat grades and BP rounds
-- -----------------------------------------------------------------------------
create table public.pa_grades (
  game_id   uuid not null references public.games (id) on delete cascade,
  team_id   uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  pa_no     smallint not null check (pa_no between 1 and 15),
  grade     smallint not null check (grade between 0 and 5),
  primary key (game_id, player_id, pa_no)
);
select private.apply_staff_rls('public.pa_grades');
create policy "player reads her grades" on public.pa_grades for select to authenticated
  using (player_id in (select private.my_player_ids()));

create table public.bp_rounds (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  round_date date not null,
  grades     smallint[] not null check (cardinality(grades) between 1 and 100 and 0 <= all (grades) and 5 >= all (grades)),
  note       text check (char_length(note) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index bp_rounds_player_idx on public.bp_rounds (player_id, round_date desc);
select private.apply_staff_rls('public.bp_rounds');
create policy "player reads her BP rounds" on public.bp_rounds for select to authenticated
  using (player_id in (select private.my_player_ids()));

create view public.qab_season with (security_invoker = true) as
select
  g.season_id,
  q.team_id,
  q.player_id,
  count(*)::int                                   as graded,
  count(*) filter (where q.grade >= 3)::int       as quality,
  round(100.0 * count(*) filter (where q.grade >= 3) / count(*), 1) as qab_pct,
  round(avg(q.grade), 2)                          as production
from public.pa_grades q
join public.games g on g.id = q.game_id
group by g.season_id, q.team_id, q.player_id;

-- -----------------------------------------------------------------------------
-- Save a box score (one team's side of one game)
-- -----------------------------------------------------------------------------
create function public.save_box_score(p_game_id uuid, p_team_id uuid, p_box jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_game public.games%rowtype;
  v_us   int := (p_box ->> 'us')::int;
  v_them int := (p_box ->> 'them')::int;
begin
  if not (select private.can_edit()) then
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
revoke all on function public.save_box_score(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_box_score(uuid, uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- BP production leaders for the Leaderboard (teammates can't read bp_rounds)
-- -----------------------------------------------------------------------------
create function private.team_bp_leaders(p_team_id uuid)
returns table (player_id uuid, first_name text, last_name text, jersey_number text, swings int, production numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_off  public.team_offseason;
  v_from date;
  v_to   date := private.team_today();
begin
  if not ((select private.is_staff()) or p_team_id in (select private.my_current_team_ids())) then
    raise exception 'You can only see your own team''s leaderboard.' using errcode = '42501';
  end if;
  select * into v_off from public.team_offseason where team_id = p_team_id;
  v_from := coalesce(v_off.starts_on, v_to - 60);
  if v_off.ends_on is not null and v_off.ends_on < v_to then
    v_to := v_off.ends_on;
  end if;
  return query
    select r.player_id, coalesce(p.preferred_name, p.first_name), p.last_name, r.jersey_number,
           sum(cardinality(b.grades))::int,
           round(sum((select sum(g) from unnest(b.grades) g))::numeric / sum(cardinality(b.grades)), 2)
      from private.team_roster(p_team_id) r
      join public.players p on p.id = r.player_id
      join public.bp_rounds b on b.player_id = r.player_id and b.round_date between v_from and v_to
     group by r.player_id, p.preferred_name, p.first_name, p.last_name, r.jersey_number
    having sum(cardinality(b.grades)) >= 20
     order by 6 desc, 5 desc
     limit 5;
end $$;
revoke all on function private.team_bp_leaders(uuid) from public;
grant execute on function private.team_bp_leaders(uuid) to authenticated;
create function public.team_bp_leaders(p_team_id uuid)
returns table (player_id uuid, first_name text, last_name text, jersey_number text, swings int, production numeric)
language sql stable security invoker set search_path = '' as $$ select * from private.team_bp_leaders(p_team_id) $$;
revoke all on function public.team_bp_leaders(uuid) from public, anon;
grant execute on function public.team_bp_leaders(uuid) to authenticated;
