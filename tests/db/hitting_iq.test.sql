-- Hitting & Softball IQ (Phase 3): Offense IQ levels unlock from a passed test (no
-- ring); a perfect score earns the MVP badge. My Zone: she keeps her own, cells sit
-- in one list only, her mentor reads it. Seed: c2 Jordan Kim on team b1.
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

-- A coach runs the tests (the IQ functions check who's acting)
insert into auth.users (id, email, raw_user_meta_data) values ('abababab-0000-0000-0000-000000000003', 'coach-z@example.test', '{}');
insert into public.staff (user_id, display_name, role) values ('abababab-0000-0000-0000-000000000003', 'Z Coach', 'coach');
select set_config('request.jwt.claims', '{"sub":"abababab-0000-0000-0000-000000000003"}', false);

-- A small Offense IQ bank for the test
insert into public.iq_questions (slug, topic, track, level, scenario, question, choices, correct_index, active)
select 'test-offense-1-' || g, 'general', 'offense', 1, 'offense test scenario ' || g, 'q', array['right', 'wrong', 'no', 'nope'], 0, true
  from generate_series(1, 4) g;
insert into public.iq_questions (slug, topic, track, level, scenario, question, choices, correct_index, active)
values ('test-offense-2-1', 'general', 'offense', 2, 'offense test level 2', 'q', array['right', 'wrong', 'no', 'nope'], 0, true);

select pg_temp.expect('Level 2 is locked first',
  pg_temp.err($$select public.start_iq_level('00000000-0000-0000-0000-0000000000c2', 'offense', 2::smallint)$$), 'P0001');

do $$
declare v_attempt uuid := public.start_iq_level('00000000-0000-0000-0000-0000000000c2', 'offense', 1::smallint);
        r record;
begin
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  select '00000000-0000-0000-0000-0000000000c2', id, 0, true, v_attempt
    from public.iq_questions where track = 'offense' and level = 1 and active and slug like 'test-offense-%';
  select * into r from public.finish_iq_level(v_attempt);
  perform pg_temp.expect('perfect score', r.correct::int || '/' || r.total::int, '4/4');
  perform pg_temp.expect('passed', r.passed, true);
  perform pg_temp.expect('no ring award', r.award_earned, false);
end $$;
select pg_temp.expect('no offense rings',
  (select count(*) from public.player_rings where player_id = '00000000-0000-0000-0000-0000000000c2' and track::text = 'offense'), 0::bigint);
select pg_temp.expect('MVP badge for a perfect score',
  (select count(*) from public.player_mvp_badges where player_id = '00000000-0000-0000-0000-0000000000c2' and track::text = 'offense' and level = 1), 1::bigint);
select pg_temp.expect('Level 2 opens after a pass',
  public.start_iq_level('00000000-0000-0000-0000-0000000000c2', 'offense', 2::smallint) is not null, true);

-- My Zone
insert into auth.users (id, email, raw_user_meta_data) values
  ('abababab-0000-0000-0000-000000000001', 'jordan-z@example.test', '{"role": "player"}'),
  ('abababab-0000-0000-0000-000000000002', 'mentor-z@example.test', '{"role": "mentor"}');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'abababab-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Jordan Kim', '21', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c2';
insert into public.mentors (user_id, display_name) values ('abababab-0000-0000-0000-000000000002', 'Z Mentor');
insert into public.mentor_players (mentor_id, player_id) values ('abababab-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"abababab-0000-0000-0000-000000000001"}', false);
insert into public.hitting_zones (player_id, hot, strong, weak) values ('00000000-0000-0000-0000-0000000000c2', '{5}', '{4,6,8}', '{1,3}');
select pg_temp.expect('a cell in two lists', pg_temp.err($$update public.hitting_zones set strong = '{4,5}' where player_id = '00000000-0000-0000-0000-0000000000c2'$$), '23514');
select pg_temp.expect('no cell 10', pg_temp.err($$update public.hitting_zones set weak = '{10}' where player_id = '00000000-0000-0000-0000-0000000000c2'$$), '23514');
select pg_temp.expect('not another player''s', pg_temp.err($$insert into public.hitting_zones (player_id, hot) values ('00000000-0000-0000-0000-0000000000c1', '{5}')$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"abababab-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('her mentor reads it', (select hot from public.hitting_zones where player_id = '00000000-0000-0000-0000-0000000000c2'), '{5}'::smallint[]);
select pg_temp.expect('mentor can''t change it', pg_temp.err($$insert into public.hitting_zones (player_id, hot) values ('00000000-0000-0000-0000-0000000000c1', '{5}')$$), '42501');
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.hitting_zones where player_id = '00000000-0000-0000-0000-0000000000c2';
delete from public.mentor_players where mentor_id = 'abababab-0000-0000-0000-000000000002';
delete from public.mentors where user_id = 'abababab-0000-0000-0000-000000000002';
delete from public.player_claims where user_id::text like 'abababab-%';
delete from public.staff where user_id::text like 'abababab-%';
delete from auth.users where id::text like 'abababab-%';
delete from public.player_mvp_badges where player_id = '00000000-0000-0000-0000-0000000000c2' and track::text = 'offense';
delete from public.iq_level_attempts where player_id = '00000000-0000-0000-0000-0000000000c2' and track::text = 'offense';
delete from public.iq_questions where slug like 'test-offense-%';
