-- Pitching & catching (Phase 4): Battery IQ questions, team bullpen scripts players
-- read but don't write, her own bullpen sessions and game plans (mentors read),
-- and team routines that carry a script to every copy.
-- Seed: team b1 (season a1) = c1 Avery, c2 Jordan (P), c3, c4; game on the seed schedule.
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

select pg_temp.expect('sixty Battery IQ questions', (select count(*) from public.iq_questions where track::text = 'battery'), 60::bigint);

insert into auth.users (id, email, raw_user_meta_data) values
  ('cdcdcdcd-0000-0000-0000-000000000001', 'coach-p@example.test', '{}'),
  ('cdcdcdcd-0000-0000-0000-000000000002', 'jordan-p@example.test', '{"role": "player"}'),
  ('cdcdcdcd-0000-0000-0000-000000000003', 'mentor-p@example.test', '{"role": "mentor"}');
insert into public.staff (user_id, display_name, role) values ('cdcdcdcd-0000-0000-0000-000000000001', 'P Coach', 'coach');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'cdcdcdcd-0000-0000-0000-000000000002', r.team_id, r.season_id, r.id, 'Jordan Kim', '21', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c2';
insert into public.mentors (user_id, display_name) values ('cdcdcdcd-0000-0000-0000-000000000003', 'P Mentor');
insert into public.mentor_links (mentor_id, player_id, status) values ('cdcdcdcd-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c2', 'approved');

-- The coach writes a script and pushes it as a pitching routine
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cdcdcdcd-0000-0000-0000-000000000001"}', false);
insert into public.bullpen_scripts (id, team_id, name, pitches)
values ('cdcdcdcd-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Command day',
        '[{"pitch":"Drop","zone":8,"intent":"strike"},{"pitch":"Rise","zone":2,"intent":"up","count":"0-2"}]');
select pg_temp.expect('a script needs pitches', pg_temp.err($$insert into public.bullpen_scripts (team_id, name, pitches) values ('00000000-0000-0000-0000-0000000000b1', 'Empty', '[]')$$), '23514');
insert into public.team_routines (id, team_id, title, category, starts_on, bullpen_script_id)
values ('cdcdcdcd-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'Bullpen: Command day', 'pitching', '2026-11-09', 'cdcdcdcd-0000-0000-0000-0000000000a1');
select public.sync_team_routine('cdcdcdcd-0000-0000-0000-0000000000b1');
reset role;
select pg_temp.expect('copies carry the script',
  (select count(*) from public.player_activities where team_routine_id = 'cdcdcdcd-0000-0000-0000-0000000000b1' and bullpen_script_id = 'cdcdcdcd-0000-0000-0000-0000000000a1'), 4::bigint);

-- Jordan reads the script, logs her own bullpen and game plan, not anyone else's
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cdcdcdcd-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('she reads her team''s script', (select name from public.bullpen_scripts where id = 'cdcdcdcd-0000-0000-0000-0000000000a1'), 'Command day');
select pg_temp.expect('she can''t write scripts', pg_temp.err($$insert into public.bullpen_scripts (team_id, name, pitches) values ('00000000-0000-0000-0000-0000000000b1', 'Mine', '[{"pitch":"Drop","zone":8,"intent":"strike"}]')$$), '42501');
insert into public.bullpen_sessions (player_id, script_id, thrown_on, results)
values ('00000000-0000-0000-0000-0000000000c2', 'cdcdcdcd-0000-0000-0000-0000000000a1', '2026-11-09',
        '[{"pitch":"Drop","zone":8,"intent":"strike","hit":true},{"pitch":"Rise","zone":2,"intent":"up","hit":false}]');
select pg_temp.expect('not Avery''s bullpen', pg_temp.err($$insert into public.bullpen_sessions (player_id, thrown_on, results) values ('00000000-0000-0000-0000-0000000000c1', '2026-11-09', '[{"pitch":"Drop","zone":8,"intent":"strike","hit":true}]')$$), '42501');
insert into public.pitcher_game_plans (player_id, game_id, plan_date, out_pitch)
select '00000000-0000-0000-0000-0000000000c2', id, game_date, 'Rise up' from public.games order by game_date limit 1;
select pg_temp.expect('one plan per game', pg_temp.err($$insert into public.pitcher_game_plans (player_id, game_id, plan_date) select '00000000-0000-0000-0000-0000000000c2', id, game_date from public.games order by game_date limit 1$$), '23505');
select pg_temp.expect('strike % 0-100', pg_temp.err($$insert into public.pitcher_game_plans (player_id, plan_date, strike_pct) values ('00000000-0000-0000-0000-0000000000c2', '2026-11-10', 120)$$), '23514');
reset role;

-- Her mentor reads both
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cdcdcdcd-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('mentor reads her bullpens', (select count(*) from public.bullpen_sessions), 1::bigint);
select pg_temp.expect('mentor reads her game plans', (select out_pitch from public.pitcher_game_plans), 'Rise up');
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.pitcher_game_plans where player_id = '00000000-0000-0000-0000-0000000000c2';
delete from public.bullpen_sessions where player_id = '00000000-0000-0000-0000-0000000000c2';
delete from public.player_activities where team_routine_id = 'cdcdcdcd-0000-0000-0000-0000000000b1';
delete from public.team_routines where id = 'cdcdcdcd-0000-0000-0000-0000000000b1';
delete from public.bullpen_scripts where id = 'cdcdcdcd-0000-0000-0000-0000000000a1';
delete from public.mentor_links where mentor_id = 'cdcdcdcd-0000-0000-0000-000000000003';
delete from public.mentors where user_id = 'cdcdcdcd-0000-0000-0000-000000000003';
delete from public.player_claims where user_id::text like 'cdcdcdcd-%';
delete from public.staff where user_id::text like 'cdcdcdcd-%';
delete from auth.users where id::text like 'cdcdcdcd-%';
