-- Game-day production (Phase 9): DP/FLEX, jobs and the sub log on GameDay lineups;
-- the staff duty matrix and staff standards are head-coach written, read by every coach.
-- Seed: team b1 (season a1) = c1 Avery, c2 Jordan, c3, c4.
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
  ('d9d9d9d9-0000-0000-0000-000000000001', 'head-gp@example.test', '{}'),
  ('d9d9d9d9-0000-0000-0000-000000000002', 'assist-gp@example.test', '{}');
insert into public.staff (user_id, display_name, role) values
  ('d9d9d9d9-0000-0000-0000-000000000001', 'GP Head', 'coach'),
  ('d9d9d9d9-0000-0000-0000-000000000002', 'GP Assistant', 'assistant');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9d9d9d9-0000-0000-0000-000000000001"}', false);
insert into public.gameday_lineups (id, team_id, game_date, batting_order, dp_player_id, flex_player_id, jobs, sub_log)
values ('d9d9d9d9-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '2027-03-20',
        '{00000000-0000-0000-0000-0000000000c1,00000000-0000-0000-0000-0000000000c2}',
        '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3',
        '[{"job": "Keep the book", "who": "Pat"}]', '[{"inning": 3, "spot": 3, "in": "00000000-0000-0000-0000-0000000000c4"}]');
select pg_temp.expect('DP and FLEX differ', pg_temp.err($$update public.gameday_lineups set flex_player_id = dp_player_id where id = 'd9d9d9d9-0000-0000-0000-0000000000a1'$$), '23514');
select pg_temp.expect('jobs is a list', pg_temp.err($$update public.gameday_lineups set jobs = '{}' where id = 'd9d9d9d9-0000-0000-0000-0000000000a1'$$), '23514');
insert into public.staff_duties (team_id, phase, duty, owner) values ('00000000-0000-0000-0000-0000000000b1', 'game', 'Keep the book', 'Pat');
select pg_temp.expect('bad phase', pg_temp.err($$insert into public.staff_duties (team_id, phase, duty) values ('00000000-0000-0000-0000-0000000000b1', 'halftime', 'x')$$), '23514');
insert into public.staff_standards (team_id, commitment, pre_practice) values ('00000000-0000-0000-0000-0000000000b1', '{"On time"}', '{"Field checked"}');
select pg_temp.expect('commitment up to 12 lines', pg_temp.err($$update public.staff_standards set commitment = array_fill('x'::text, array[13]) where team_id = '00000000-0000-0000-0000-0000000000b1'$$), '23514');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9d9d9d9-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant reads the matrix', (select owner from public.staff_duties where team_id = '00000000-0000-0000-0000-0000000000b1' and duty = 'Keep the book'), 'Pat');
select pg_temp.expect('assistant reads the standards', (select pre_practice[1] from public.staff_standards where team_id = '00000000-0000-0000-0000-0000000000b1'), 'Field checked');
select pg_temp.expect('assistant can''t add duties', pg_temp.err($$insert into public.staff_duties (team_id, phase, duty) values ('00000000-0000-0000-0000-0000000000b1', 'game', 'Video')$$), '42501');
select pg_temp.expect('assistant can''t change the sub log', pg_temp.err($$update public.gameday_lineups set sub_log = '[]' where id = 'd9d9d9d9-0000-0000-0000-0000000000a1' returning id$$), '');
reset role;
select pg_temp.expect('sub log unchanged', (select jsonb_array_length(sub_log) from public.gameday_lineups where id = 'd9d9d9d9-0000-0000-0000-0000000000a1'), 1);

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.gameday_lineups where id = 'd9d9d9d9-0000-0000-0000-0000000000a1';
delete from public.staff_duties where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.staff_standards where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.staff where user_id::text like 'd9d9d9d9-%';
delete from auth.users where id::text like 'd9d9d9d9-%';
