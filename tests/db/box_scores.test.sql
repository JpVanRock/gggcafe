-- Box scores (Phase 9): save_box_score writes one team's lines for a game in one
-- transaction (all or nothing) and sets the final score; she reads her own lines,
-- grades and BP rounds; teammates see BP production only through team_bp_leaders().
-- Seed: team b1 (season a1) = c1 Avery #7, c2 Jordan #21; team b2 is an opponent.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;
create function pg_temp.err(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return '';
exception when others then
  return sqlstate;
end $$;
grant execute on function pg_temp.err(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('e5e5e5e5-0000-0000-0000-000000000001', 'coach-bx@example.test', '{}'),
  ('e5e5e5e5-0000-0000-0000-000000000002', 'avery-bx@example.test', '{"role": "player"}'),
  ('e5e5e5e5-0000-0000-0000-000000000003', 'jordan-bx@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values ('e5e5e5e5-0000-0000-0000-000000000001', 'BX Coach', 'coach');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'e5e5e5e5-0000-0000-0000-000000000002', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'e5e5e5e5-0000-0000-0000-000000000003', r.team_id, r.season_id, r.id, 'Jordan Kim', '21', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c2';
insert into public.games (id, season_id, game_date, home_team_id, away_team_id)
values ('e5e5e5e5-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '2027-04-01',
        '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000001"}', false);
select public.save_box_score('e5e5e5e5-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', $j${
  "us": 6, "them": 2,
  "batting": [
    {"player_id": "00000000-0000-0000-0000-0000000000c1", "pa": 4, "ab": 3, "r": 2, "h": 2, "d": 1, "t": 0, "hr": 0, "rbi": 1, "bb": 1, "so": 0, "hbp": 0, "sac": 0, "sf": 0, "sb": 1, "cs": 0},
    {"player_id": "00000000-0000-0000-0000-0000000000c2", "pa": 3, "ab": 3, "r": 0, "h": 0, "d": 0, "t": 0, "hr": 0, "rbi": 0, "bb": 0, "so": 2, "hbp": 0, "sac": 0, "sf": 0, "sb": 0, "cs": 0}
  ],
  "pitching": [{"player_id": "00000000-0000-0000-0000-0000000000c2", "starter": true, "outs": 21, "bf": 26, "h": 4, "r": 2, "er": 1, "bb": 2, "so": 9, "hbp": 0, "hr": 0, "wp": 1, "pitches": 98, "strikes": 64, "decision": "W"}],
  "fielding": [{"player_id": "00000000-0000-0000-0000-0000000000c1", "po": 2, "a": 4, "e": 1, "dp": 1, "pb": 0, "sba": 0, "cs": 0}],
  "grades": [
    {"player_id": "00000000-0000-0000-0000-0000000000c1", "pa_no": 1, "grade": 5},
    {"player_id": "00000000-0000-0000-0000-0000000000c1", "pa_no": 2, "grade": 3},
    {"player_id": "00000000-0000-0000-0000-0000000000c1", "pa_no": 3, "grade": 1},
    {"player_id": "00000000-0000-0000-0000-0000000000c1", "pa_no": 4, "grade": 4}
  ]
}$j$::jsonb);
-- a bad line (more hits than at-bats) saves nothing
select pg_temp.expect('bad box rolls back', pg_temp.err($q$select public.save_box_score('e5e5e5e5-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
  '{"batting": [{"player_id": "00000000-0000-0000-0000-0000000000c1", "pa": 1, "ab": 1, "r": 0, "h": 2, "d": 0, "t": 0, "hr": 0, "rbi": 0, "bb": 0, "so": 0, "hbp": 0, "sac": 0, "sf": 0, "sb": 0, "cs": 0}]}')$q$), '23514');
select pg_temp.expect('not a team in the game', pg_temp.err($q$select public.save_box_score('e5e5e5e5-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '{}')$q$), '22023');
insert into public.bp_rounds (player_id, round_date, grades)
values ('00000000-0000-0000-0000-0000000000c1', current_date, array_fill(4::smallint, array[24])),
       ('00000000-0000-0000-0000-0000000000c2', current_date, array_fill(2::smallint, array[10]));
select pg_temp.expect('swing grades 0-5', pg_temp.err($q$insert into public.bp_rounds (player_id, round_date, grades) values ('00000000-0000-0000-0000-0000000000c1', current_date, '{6}')$q$), '23514');
reset role;

select pg_temp.expect('score set (away team)', (select away_score::text || '-' || home_score || ' ' || status from public.games where id = 'e5e5e5e5-0000-0000-0000-0000000000a1'), '6-2 final');
select pg_temp.expect('lines kept', (select count(*) from public.batting_lines where game_id = 'e5e5e5e5-0000-0000-0000-0000000000a1'), 2::bigint);
select pg_temp.expect('ERA on 7', (select era from public.pitching_season s join public.pitching_lines l on l.player_id = s.player_id and l.game_id = 'e5e5e5e5-0000-0000-0000-0000000000a1' where s.season_id = '00000000-0000-0000-0000-0000000000a1' and s.player_id = '00000000-0000-0000-0000-0000000000c2' limit 1) is not null, true);

-- Avery reads her own lines and grades, not Jordan's; she can't save a box score
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('her line', (select hits from public.batting_lines where game_id = 'e5e5e5e5-0000-0000-0000-0000000000a1'), 2::smallint);
select pg_temp.expect('her QAB', (select qab_pct::text || ' ' || production from public.qab_season where player_id = '00000000-0000-0000-0000-0000000000c1'), '75.0 3.25');
select pg_temp.expect('no teammate pitching', (select count(*) from public.pitching_lines), 0::bigint);
select pg_temp.expect('her BP only', (select count(*) from public.bp_rounds), 1::bigint);
select pg_temp.expect('BP leaders: 20+ swings only', (select string_agg(first_name || ' ' || production, ',') from public.team_bp_leaders('00000000-0000-0000-0000-0000000000b1')), 'Avery 4.00');
select pg_temp.expect('players can''t save box scores', pg_temp.err($q$select public.save_box_score('e5e5e5e5-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '{}')$q$), '42501');
select pg_temp.expect('no other team''s BP leaders', pg_temp.err($q$select * from public.team_bp_leaders('00000000-0000-0000-0000-0000000000b2')$q$), '42501');
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.bp_rounds where player_id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2') and round_date = current_date;
delete from public.games where id = 'e5e5e5e5-0000-0000-0000-0000000000a1';
delete from public.player_claims where user_id::text like 'e5e5e5e5-%';
delete from public.staff where user_id::text like 'e5e5e5e5-%';
delete from auth.users where id::text like 'e5e5e5e5-%';
