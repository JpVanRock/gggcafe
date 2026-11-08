-- Team playbook & scouting (Phase 8): the depth chart is head-coach written; players
-- read only their team's call sheet; team quizzes are graded on the server, with the
-- answer key hidden until she answers; scouting stays staff only.
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
  ('c8c8c8c8-0000-0000-0000-000000000001', 'head-pb@example.test', '{}'),
  ('c8c8c8c8-0000-0000-0000-000000000002', 'assist-pb@example.test', '{}'),
  ('c8c8c8c8-0000-0000-0000-000000000003', 'avery-pb@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('c8c8c8c8-0000-0000-0000-000000000001', 'PB Head', 'coach'),
  ('c8c8c8c8-0000-0000-0000-000000000002', 'PB Assistant', 'assistant');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'c8c8c8c8-0000-0000-0000-000000000003', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';

-- Head coach: depth chart, plays, a quiz
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c8c8c8c8-0000-0000-0000-000000000001"}', false);
insert into public.depth_chart (team_id, position, player_id, rank) values
  ('00000000-0000-0000-0000-0000000000b1', 'SS', '00000000-0000-0000-0000-0000000000c1', 1),
  ('00000000-0000-0000-0000-0000000000b1', 'P', '00000000-0000-0000-0000-0000000000c2', 1);
select pg_temp.expect('no DH on the depth chart', pg_temp.err($$insert into public.depth_chart (team_id, position, player_id, rank) values ('00000000-0000-0000-0000-0000000000b1', 'DH', '00000000-0000-0000-0000-0000000000c1', 1)$$), '23514');
insert into public.playbook_plays (id, team_id, name, category, situation, description, call_sheet) values
  ('c8c8c8c8-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'PB Wheel', 'bunt_defense', 'Runners on 1st and 2nd', 'Third crashes, short covers third.', true),
  ('c8c8c8c8-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'PB Staff Only', 'first_and_third', null, 'Coaches only.', false),
  ('c8c8c8c8-0000-0000-0000-0000000000a3', null, 'PB Org Call', 'cutoff_relay', null, 'Every team: cut four.', true),
  ('c8c8c8c8-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b2', 'PB Their Call', 'rundown', null, 'Another team.', true);
insert into public.team_quizzes (id, team_id, title) values ('c8c8c8c8-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'PB Bunt calls');
insert into public.team_quiz_questions (id, quiz_id, position, question, choices, correct_index, explanation) values
  ('c8c8c8c8-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000b1', 0, 'On Wheel, who covers third?', '{Third,Short,Pitcher}', 1, 'Third crashes, so short rotates.'),
  ('c8c8c8c8-0000-0000-0000-0000000000c2', 'c8c8c8c8-0000-0000-0000-0000000000b1', 1, 'On Wheel, who covers second?', '{Second,Center}', 0, null);
select pg_temp.expect('the right answer must be a choice', pg_temp.err($$insert into public.team_quiz_questions (quiz_id, question, choices, correct_index) values ('c8c8c8c8-0000-0000-0000-0000000000b1', 'x', '{a,b}', 2)$$), '23514');
insert into public.scouting_reports (subject_team_id, category, title, body, tags) values
  ('00000000-0000-0000-0000-0000000000b2', 'hitter_tendencies', 'Slappers', 'Two lefty slappers at the top.', '{checklist,slappers}');
reset role;

-- The assistant reads the depth chart but can't change it; she can work the playbook
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c8c8c8c8-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant reads the depth chart', (select count(*) from public.depth_chart where team_id = '00000000-0000-0000-0000-0000000000b1'), 2::bigint);
select pg_temp.expect('assistant can''t change the depth chart', pg_temp.err($$insert into public.depth_chart (team_id, position, player_id, rank) values ('00000000-0000-0000-0000-0000000000b1', 'C', '00000000-0000-0000-0000-0000000000c1', 1)$$), '42501');
update public.playbook_plays set situation = 'Runners on 1st and 2nd, no outs' where id = 'c8c8c8c8-0000-0000-0000-0000000000a1';
reset role;
select pg_temp.expect('assistant edited the play', (select situation from public.playbook_plays where id = 'c8c8c8c8-0000-0000-0000-0000000000a1'), 'Runners on 1st and 2nd, no outs');

-- Avery: her team's call sheet only; the quiz only once it's published
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c8c8c8c8-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('her call sheet', (select string_agg(name, ',' order by name) from public.playbook_plays where name like 'PB %'), 'PB Org Call,PB Wheel');
select pg_temp.expect('no depth chart', (select count(*) from public.depth_chart), 0::bigint);
select pg_temp.expect('no scouting', (select count(*) from public.scouting_reports), 0::bigint);
select pg_temp.expect('draft quiz hidden', (select count(*) from public.team_quizzes), 0::bigint);
select pg_temp.expect('draft quiz closed', pg_temp.err($$select * from public.team_quiz_for('00000000-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000b1')$$), '42501');
reset role;
update public.team_quizzes set published_at = now() where id = 'c8c8c8c8-0000-0000-0000-0000000000b1';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c8c8c8c8-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('published quiz', (select title from public.team_quizzes), 'PB Bunt calls');
select pg_temp.expect('no answer keys before answering', (select count(*) from public.team_quiz_for('00000000-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000b1') where correct_index is not null), 0::bigint);
select pg_temp.expect('no direct question reads', (select count(*) from public.team_quiz_questions), 0::bigint);
select pg_temp.expect('wrong first', (select is_correct from public.answer_team_quiz('00000000-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000c1', 0::smallint)), false);
select pg_temp.expect('right second', (select is_correct from public.answer_team_quiz('00000000-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000c1', 1::smallint)), true);
select pg_temp.expect('first try still counts', (select first_correct::text || tries from public.team_quiz_answers where question_id = 'c8c8c8c8-0000-0000-0000-0000000000c1'), 'false2');
select pg_temp.expect('key once answered', (select correct_index from public.team_quiz_for('00000000-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000b1') where id = 'c8c8c8c8-0000-0000-0000-0000000000c1'), 1::smallint);
select pg_temp.expect('bad choice', pg_temp.err($$select * from public.answer_team_quiz('00000000-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000c2', 5::smallint)$$), '22023');
select pg_temp.expect('not for a teammate', pg_temp.err($$select * from public.answer_team_quiz('00000000-0000-0000-0000-0000000000c2', 'c8c8c8c8-0000-0000-0000-0000000000c2', 0::smallint)$$), '42501');
select pg_temp.expect('no direct answer writes', pg_temp.err($$insert into public.team_quiz_answers (player_id, question_id, chosen_index, is_correct, first_correct) values ('00000000-0000-0000-0000-0000000000c1', 'c8c8c8c8-0000-0000-0000-0000000000c2', 0, true, true)$$), '42501');
select pg_temp.expect('her quiz list', (select total::text || '/' || answered || '/' || first_try || '/' || to_fix from public.team_quizzes_for('00000000-0000-0000-0000-0000000000c1')), '2/1/0/0');
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.team_quizzes where id = 'c8c8c8c8-0000-0000-0000-0000000000b1';
delete from public.playbook_plays where id::text like 'c8c8c8c8-%';
delete from public.scouting_reports where title = 'Slappers' and subject_team_id = '00000000-0000-0000-0000-0000000000b2';
delete from public.depth_chart where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.player_claims where user_id::text like 'c8c8c8c8-%';
delete from public.staff where user_id::text like 'c8c8c8c8-%';
delete from auth.users where id::text like 'c8c8c8c8-%';
