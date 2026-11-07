-- Player accounts: claiming a roster spot, what a claimed player can see and
-- change, Softball IQ integrity, and the new-season reset. Own users, removed
-- at the end. Seed: team b1 (own) plays b2; season a1 roster has c1 Avery
-- Lopez #7, c2 Jordan Kim #21, c3, c4.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000001', 'avery@example.test'),
  ('66666666-0000-0000-0000-000000000002', 'someone@example.test'),
  ('66666666-0000-0000-0000-000000000003', 'players-coach@example.test');
insert into public.staff (user_id, display_name, role) values
  ('66666666-0000-0000-0000-000000000003', 'Players Coach', 'coach');
insert into public.iq_questions (id, topic, track, level, scenario, question, choices, correct_index, explanation)
values ('00000000-0000-0000-0000-00000000aa01', 'general', 'baserunning', 1, 'test', 'q1', array['a', 'b'], 1, 'because b'),
       ('00000000-0000-0000-0000-00000000aa02', 'general', 'baserunning', 1, 'test', 'q2', array['a', 'b'], 0, 'because a');
update public.iq_questions set active = false where track = 'baserunning' and level = 1 and scenario <> 'test';

-- Sign-up page (signed out): our teams only
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('sign-up lists our teams only', (select string_agg(name, ',') from public.signup_teams()), 'Sample Squad 14U');
reset role;

-- ---------------------------------------------------------------------------
-- Claim, before approval
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('welcome shows team and season',
  (select team_name || ' / ' || season_name from public.team_welcome('00000000-0000-0000-0000-0000000000b1')), 'Sample Squad 14U / Fall 2026');
select pg_temp.expect('wrong number does not match', public.request_player_claim('00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '8'), false);
select pg_temp.expect('name and number match her spot', public.request_player_claim('00000000-0000-0000-0000-0000000000b1', ' avery LOPEZ ', '#7'), true);
select pg_temp.expect('one claim per team and season', (select count(*) from public.player_claims), 1::bigint);
select pg_temp.expect('pending: sees no players', (select count(*) from public.players), 0::bigint);
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'baserunning', 1::smallint);
  raise exception 'FAIL: a pending player started a test';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.player_claims set status = 'approved';
  if exists (select 1 from public.player_claims where status = 'approved') then
    raise exception 'FAIL: a player approved her own claim';
  end if;
end $$;
reset role;

-- Coach sees the claim with her email and approves it
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('coach sees the claim',
  (select email || ' ' || typed_name || ' #' || typed_jersey || ' ' || status
     from public.team_player_claims('00000000-0000-0000-0000-0000000000b1')),
  'avery@example.test avery LOPEZ #7 pending');
select pg_temp.expect('coach is told what is waiting',
  (select team_name || ' ' || player_claims from public.pending_approvals()), 'Sample Squad 14U 1');
update public.player_claims set status = 'approved', decided_by = '66666666-0000-0000-0000-000000000003', decided_at = now();
reset role;

-- ---------------------------------------------------------------------------
-- Approved: her own data only
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('sees only herself', (select string_agg(first_name, ',') from public.players), 'Avery'),
       pg_temp.expect('sees her team and its opponent', (select count(*) from public.teams), 2::bigint),
       pg_temp.expect('sees her team schedule', (select count(*) from public.team_events) > 0, true),
       pg_temp.expect('no coach notes', (select count(*) from public.coach_notes), 0::bigint),
       pg_temp.expect('no practice plans', (select count(*) from public.practice_plans), 0::bigint),
       pg_temp.expect('no staff list', (select count(*) from public.staff), 0::bigint);
insert into public.player_activities (player_id, title) values ('00000000-0000-0000-0000-0000000000c1', 'Wall ball');
select public.save_harada_plan('00000000-0000-0000-0000-0000000000c1', '{"main_goal": "Make varsity", "pillars": [{"position": 1, "title": "Speed", "actions": [{"position": 1, "title": "Sprints"}]}]}'::jsonb);
insert into public.mental_game_plans (player_id, focus_words) values ('00000000-0000-0000-0000-0000000000c1', 'Breathe')
  on conflict (player_id) do update set focus_words = excluded.focus_words;
select pg_temp.expect('edits her goals', (select main_goal from public.harada_plans where player_id = '00000000-0000-0000-0000-0000000000c1' and status = 'active'), 'Make varsity');
do $$ begin
  insert into public.player_activities (player_id, title) values ('00000000-0000-0000-0000-0000000000c2', 'Sneaky');
  raise exception 'FAIL: a player added a routine for a teammate';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.players set notes = 'x' where id = '00000000-0000-0000-0000-0000000000c1';
  if exists (select 1 from public.players where notes = 'x') then raise exception 'FAIL: a player edited her profile row'; end if;
end $$;

-- Softball IQ: no answer keys, no self-awarded answers or rings
do $$ begin
  perform correct_index from public.iq_questions limit 1;
  raise exception 'FAIL: a player read the answer key';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect('reads active questions', (select count(*) from public.iq_questions where scenario = 'test'), 2::bigint);
do $$ begin
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01', 0, true);
  raise exception 'FAIL: a player wrote her own answer';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.player_rings (player_id, track, level) values ('00000000-0000-0000-0000-0000000000c1', 'baserunning', 3);
  raise exception 'FAIL: a player gave herself a ring';
exception when insufficient_privilege then null;
end $$;
do $$
declare x uuid; r record;
begin
  x := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'baserunning', 1::smallint);
  perform pg_temp.expect('no key before answering',
    (select count(*) from public.iq_answer_key('00000000-0000-0000-0000-0000000000c1') where question_id = '00000000-0000-0000-0000-00000000aa01'), 0::bigint);
  select * into r from public.record_iq_answer('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01', 1::smallint, x);
  perform pg_temp.expect('graded by the database', r.correct::text || ' ' || r.correct_index || ' ' || r.explanation, 'true 1 because b');
  select * into r from public.record_iq_answer('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa02', 0::smallint, x);
  begin
    perform public.record_iq_answer('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa02', 1::smallint, x);
    raise exception 'FAIL: answered the same test question twice';
  exception when unique_violation then null;
  end;
  select * into r from public.finish_iq_level(x);
  perform pg_temp.expect('2/2 passes and earns the ring', r.correct || '/' || r.total || ' ' || r.award_earned, '2/2 true');
  perform pg_temp.expect('key after answering',
    (select count(*) from public.iq_answer_key('00000000-0000-0000-0000-0000000000c1') where question_id = '00000000-0000-0000-0000-00000000aa01'), 1::bigint);
end $$;
select pg_temp.expect('sees her ring', (select count(*) from public.player_rings where track = 'baserunning' and level = 1), 1::bigint);
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c2', 'baserunning', 1::smallint);
  raise exception 'FAIL: a player started a teammate''s test';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Someone else signed in sees nothing of hers
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('other account sees no players', (select count(*) from public.players), 0::bigint),
       pg_temp.expect('other account sees no claims', (select count(*) from public.player_claims), 0::bigint);
reset role;

-- ---------------------------------------------------------------------------
-- New season: access pauses until she claims her new spot; history stays
-- ---------------------------------------------------------------------------
insert into public.seasons (id, name, start_date) values ('00000000-0000-0000-0000-0000000000a9', 'Spring 2027', '2027-03-01');
insert into public.roster_entries (team_id, season_id, player_id, jersey_number) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000c1', '7');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('new season pauses access', (select count(*) from public.players), 0::bigint),
       pg_temp.expect('old claim is no longer current', (select is_current from public.my_claims()), false);
select pg_temp.expect('claims her new spot', public.request_player_claim('00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '7'), true);
reset role;
update public.player_claims set status = 'approved' where season_id = '00000000-0000-0000-0000-0000000000a9';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('access back after approval', (select count(*) from public.players), 1::bigint),
       pg_temp.expect('history kept: both seasons', (select count(*) from public.roster_entries), 2::bigint),
       pg_temp.expect('her ring is still there', (select count(*) from public.player_rings where track = 'baserunning'), 1::bigint);
reset role;

-- Clean up
delete from public.player_claims;
delete from public.roster_entries where season_id = '00000000-0000-0000-0000-0000000000a9';
delete from public.seasons where id = '00000000-0000-0000-0000-0000000000a9';
delete from public.player_rings where track = 'baserunning';
delete from public.iq_answers where question_id in ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000aa02');
delete from public.iq_level_attempts where track = 'baserunning';
delete from public.iq_questions where scenario = 'test';
update public.iq_questions set active = true where track = 'baserunning' and level = 1;
delete from public.player_activities where title = 'Wall ball';
delete from public.staff where user_id::text like '66666666-%';
delete from auth.users where id::text like '66666666-%';
