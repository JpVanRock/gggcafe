-- Player dashboard: Harada chart saving, TWIS check-off rules.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;

-- Seeded chart: 2 pillars; "Hitting power" has 3 actions, 1 done
select pg_temp.expect('pillars saved',
  (select count(*) from public.harada_pillars p join public.harada_plans h on h.id = p.plan_id
    where h.player_id = '00000000-0000-0000-0000-0000000000c1'), 2::bigint);
select pg_temp.expect('row exists in public.harada_pillar_progress',
  (select count(*) from public.harada_pillar_progress where title = 'Hitting power'), 1::bigint);
select pg_temp.expect('progress actions', (select actions from public.harada_pillar_progress where title = 'Hitting power'), 3),
       pg_temp.expect('progress done',    (select done    from public.harada_pillar_progress where title = 'Hitting power'), 1);

-- Re-saving: pillar 2 blanked, pillar 1 keeps actions 1-2 and renames itself.
-- Ids and done dates survive; the blank pillar and the dropped action go.
do $$
declare
  v_plan uuid := (select id from public.harada_plans where player_id = '00000000-0000-0000-0000-0000000000c1');
  v_pillar uuid := (select id from public.harada_pillars where title = 'Hitting power');
  v_again uuid;
begin
  v_again := public.save_harada_plan('00000000-0000-0000-0000-0000000000c1', '{
    "main_goal": "Start at shortstop for a 14U national team",
    "pillars": [
      {"position": 1, "title": "Hitting power & bat speed", "actions": [
        {"position": 1, "title": "Tee work 3x a week"},
        {"position": 2, "title": "Weight room twice a week"}]},
      {"position": 2, "title": "", "actions": []}
    ]}'::jsonb);
  perform pg_temp.expect('same plan id on re-save', v_again, v_plan);
  perform pg_temp.expect('pillar id kept', (select id from public.harada_pillars where plan_id = v_plan and position = 1), v_pillar);
  perform pg_temp.expect('pillar renamed', (select title from public.harada_pillars where id = v_pillar), 'Hitting power & bat speed');
  perform pg_temp.expect('blank pillar removed', (select count(*) from public.harada_pillars where plan_id = v_plan), 1::bigint);
  perform pg_temp.expect('dropped action removed', (select count(*) from public.harada_actions where pillar_id = v_pillar), 2::bigint);
  perform pg_temp.expect('done date kept', (select done_on from public.harada_actions where pillar_id = v_pillar and position = 1), '2026-09-20'::date);
  perform pg_temp.expect('purpose cleared when omitted', (select purpose from public.harada_plans where id = v_plan), null::text);
  perform pg_temp.expect('activity still linked to its pillar',
    (select pillar_id from public.player_activities where id = '00000000-0000-0000-0000-0000000000ba'), v_pillar);
end $$;

-- A main goal is required
do $$ begin
  perform public.save_harada_plan('00000000-0000-0000-0000-0000000000c4', '{"main_goal": "  "}'::jsonb);
  raise exception 'FAIL: blank main goal was accepted';
exception when check_violation then null;
end $$;

-- Only one active chart per player
do $$ begin
  insert into public.harada_plans (player_id, main_goal) values ('00000000-0000-0000-0000-0000000000c1', 'Second goal');
  raise exception 'FAIL: a second active chart was accepted';
exception when unique_violation then null;
end $$;

-- TWIS checks: exactly one thing per check, and no double checks
do $$ begin
  insert into public.twis_checks (player_id, activity_id, team_event_id, on_date)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000b9', '2026-09-16');
  raise exception 'FAIL: a check pointing at two things was accepted';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.twis_checks (player_id, team_event_id, on_date)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b9', '2026-09-15');
  raise exception 'FAIL: the same practice was checked twice';
exception when unique_violation then null;
end $$;
do $$ begin
  insert into public.twis_checks (player_id, activity_id, on_date)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ba', '2026-09-14');
  raise exception 'FAIL: the same activity day was checked twice';
exception when unique_violation then null;
end $$;
-- ...but the same activity on another day is fine
insert into public.twis_checks (player_id, activity_id, on_date)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ba', '2026-09-16');

-- Activity weekdays must be 1-7
do $$ begin
  insert into public.player_activities (player_id, title, days) values ('00000000-0000-0000-0000-0000000000c1', 'Bad day', '{8}');
  raise exception 'FAIL: weekday 8 was accepted';
exception when check_violation then null;
end $$;

-- Mental GP: one per player
do $$ begin
  insert into public.mental_game_plans (player_id) values ('00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: a second mental plan was accepted';
exception when unique_violation then null;
end $$;

-- Goal method: Harada by default, SMART selectable
select pg_temp.expect('goal method defaults to harada',
  (select goal_method::text from public.players where id = '00000000-0000-0000-0000-0000000000c1'), 'harada');
update public.players set goal_method = 'smart' where id = '00000000-0000-0000-0000-0000000000c4';
select pg_temp.expect('goal method can be smart',
  (select goal_method::text from public.players where id = '00000000-0000-0000-0000-0000000000c4'), 'smart');

-- SMART goal with all five parts; the Harada chart for the same player is untouched
insert into public.development_goals
  (player_id, area, title, specific, measurable, achievable, relevant, target_date, metric_key, baseline_value, target_value)
values
  ('00000000-0000-0000-0000-0000000000c4', 'baserunning', 'Faster down the line',
   'Get from home to first faster on slaps', 'Home-to-first (slap) under 2.85 sec', 'Sprint work twice a week with Coach',
   'Speed is my game as a slapper', '2027-03-01', 'home_to_first_slap', 2.95, 2.85);
select pg_temp.expect('smart goal saved',
  (select measurable from public.development_goals where title = 'Faster down the line'), 'Home-to-first (slap) under 2.85 sec');

-- achieved_on only makes sense on an achieved goal
do $$ begin
  update public.development_goals set achieved_on = '2026-10-01' where title = 'Faster down the line';
  raise exception 'FAIL: achieved_on was set on an active goal';
exception when check_violation then null;
end $$;
update public.development_goals set status = 'achieved', achieved_on = '2026-10-01' where title = 'Faster down the line';

-- Performance Training: categorized routines and earned achievements
insert into public.drills (id, name, area, category, description) values
  ('00000000-0000-0000-0000-0000000000d9', 'Hip mobility flow', 'strength_conditioning', 'stretching', '90/90 switches, couch stretch, deep squat hold');
insert into public.player_activities (player_id, title, days, starts_on, category, drill_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'Hip mobility flow', '{1,3,5}', '2026-09-14', 'stretching', '00000000-0000-0000-0000-0000000000d9');
select pg_temp.expect('routine has its category',
  (select category::text from public.player_activities where title = 'Hip mobility flow'), 'stretching');

-- Removing a library drill keeps the player's routine
delete from public.drills where id = '00000000-0000-0000-0000-0000000000d9';
select pg_temp.expect('routine survives drill removal',
  (select count(*) from public.player_activities where title = 'Hip mobility flow' and drill_id is null), 1::bigint);

insert into public.player_achievements (player_id, achievement_key, unlocked_on)
values ('00000000-0000-0000-0000-0000000000c1', 'first_rep', '2026-09-14');
do $$ begin
  insert into public.player_achievements (player_id, achievement_key, unlocked_on)
  values ('00000000-0000-0000-0000-0000000000c1', 'first_rep', '2026-09-20');
  raise exception 'FAIL: the same achievement was earned twice';
exception when unique_violation then null;
end $$;

-- IQ Test: starter bank and rules
select pg_temp.expect('starter questions loaded', (select count(*) >= 20 from public.iq_questions), true);
select pg_temp.expect('every starter question has an explanation',
  (select count(*) from public.iq_questions where explanation is null), 0::bigint);
do $$ begin
  insert into public.iq_questions (topic, scenario, question, choices, correct_index)
  values ('general', 's', 'q', array['a', 'b'], 2);
  raise exception 'FAIL: correct answer outside the choices was accepted';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.iq_questions (topic, scenario, question, choices, correct_index)
  values ('position', 's', 'q', array['a', 'b'], 0);
  raise exception 'FAIL: a position question without a position was accepted';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.iq_questions (topic, position, scenario, question, choices, correct_index)
  values ('hitting', 'SS', 's', 'q', array['a', 'b'], 0);
  raise exception 'FAIL: a hitting question with a position was accepted';
exception when check_violation then null;
end $$;
insert into public.iq_answers (player_id, question_id, chosen_index, is_correct)
select '00000000-0000-0000-0000-0000000000c1', id, 1, true from public.iq_questions where topic = 'general' limit 1;
select pg_temp.expect('answer recorded', (select count(*) from public.iq_answers), 1::bigint);

-- IQ levels and rings ---------------------------------------------------------
-- The real playbook questions are seeded by migration; set them aside so these
-- checks run on a known set: 5 Level 1 defense questions (answer always index 0) and 1 Level 2.
select pg_temp.expect('playbook questions seeded: 20-30 active in each of the 6 levels (30 is the cap)',
  (select count(*) filter (where n between 20 and 30)
     from (select track, level, count(*) n from public.iq_questions
            where track in ('defense', 'baserunning') and active group by 1, 2) t), 6::bigint);
select pg_temp.expect('position questions seeded: 21 active per fielding position',
  (select string_agg(position || ':' || n, ',' order by position)
     from (select position::text, count(*) n from public.iq_questions where track = 'position' and active group by 1) t),
  '1B:21,2B:21,3B:21,C:21,CF:21,LF:21,P:21,RF:21,SS:21');
select pg_temp.expect('Extra Credit Library seeded: questions on both playbooks, each on a shelf with a hint',
  (select count(distinct split_part(section, ' · ', 1)) || ':' || bool_and(coalesce(hint, '') <> '' and slug like 'extra-%')
     from public.iq_questions where track = 'extra' and active), '2:true');
select pg_temp.expect('the first 60 seeded questions were matched to slugs, not duplicated',
  (select count(*) from public.iq_questions where track is not null and slug is null), 0::bigint);
select pg_temp.expect('practice question aligned with the playbook',
  (select choices[correct_index + 1] from public.iq_questions
    where track is null and scenario like 'You''re the runner on second base, nobody out.%'),
  'Get a good jump, then take third once she throws to first');
update public.iq_questions set active = false where track is not null;
insert into public.iq_questions (topic, track, level, scenario, question, choices, correct_index)
select 'general', 'defense', 1, 'scenario ' || g, 'question ' || g, array['right', 'wrong'], 0 from generate_series(1, 5) g;
insert into public.iq_questions (topic, track, level, scenario, question, choices, correct_index)
values ('general', 'defense', 2, 'l2', 'l2 q', array['right', 'wrong'], 0);

-- Level 2 is locked before Level 1 is passed
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'defense', 2::smallint);
  raise exception 'FAIL: Level 2 started before Level 1 was passed';
exception when raise_exception then null;
end $$;

-- Fail Level 1 with 3/5 (60%): no ring
do $$
declare v_attempt uuid := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'defense', 1::smallint);
        r record;
begin
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  select '00000000-0000-0000-0000-0000000000c1', id, case when rn <= 3 then 0 else 1 end, rn <= 3, v_attempt
    from (select id, row_number() over (order by scenario) rn from public.iq_questions where track = 'defense' and level = 1 and active) q;
  select * into r from public.finish_iq_level(v_attempt);
  perform pg_temp.expect('60% graded', r.correct::int || '/' || r.total::int, '3/5');
  perform pg_temp.expect('60% fails', r.passed, false);
  perform pg_temp.expect('no ring at 60%', r.award_earned, false);
end $$;

-- Pass Level 1 with 4/5 (exactly 80%): ring earned, Level 2 opens
do $$
declare v_attempt uuid := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'defense', 1::smallint);
        r record;
begin
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  select '00000000-0000-0000-0000-0000000000c1', id, case when rn <= 4 then 0 else 1 end, rn <= 4, v_attempt
    from (select id, row_number() over (order by scenario) rn from public.iq_questions where track = 'defense' and level = 1 and active) q;
  select * into r from public.finish_iq_level(v_attempt);
  perform pg_temp.expect('80% passes', r.passed, true);
  perform pg_temp.expect('ring earned at 80%', r.award_earned, true);
  -- finishing again changes nothing
  select * into r from public.finish_iq_level(v_attempt);
  perform pg_temp.expect('re-finish keeps result', r.passed, true);
  perform pg_temp.expect('re-finish earns no second ring', r.award_earned, false);
end $$;
select pg_temp.expect('one Level 1 defense ring',
  (select count(*) from public.player_rings where player_id = '00000000-0000-0000-0000-0000000000c1' and track = 'defense' and level = 1), 1::bigint);
select pg_temp.expect('Level 2 now opens',
  public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'defense', 2::smallint) is not null, true);

-- An answer counts once per attempt
do $$
declare v_attempt uuid := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'defense', 1::smallint);
        v_q uuid := (select id from public.iq_questions where track = 'defense' and level = 1 and active limit 1);
begin
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  values ('00000000-0000-0000-0000-0000000000c1', v_q, 0, true, v_attempt);
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  values ('00000000-0000-0000-0000-0000000000c1', v_q, 0, true, v_attempt);
  raise exception 'FAIL: the same question was answered twice in one attempt';
exception when unique_violation then null;
end $$;

-- Track questions need a level, and practice questions must not have one
do $$ begin
  insert into public.iq_questions (topic, track, scenario, question, choices, correct_index)
  values ('general', 'baserunning', 's', 'q', array['a', 'b'], 0);
  raise exception 'FAIL: a track question without a level was accepted';
exception when check_violation then null;
end $$;

-- Team logos
select pg_temp.expect('team-logos bucket is public',
  (select public from storage.buckets where id = 'team-logos'), true);
do $$ begin
  update public.teams set logo_url = 'http://insecure.example/logo.png' where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL: a non-https logo URL was accepted';
exception when check_violation then null;
end $$;

-- Saved progress: starting again resumes the open test; restarting deals a new one
do $$
declare a1 uuid; a2 uuid; a3 uuid;
begin
  a1 := public.start_iq_level('00000000-0000-0000-0000-0000000000c3', 'defense', 1::smallint);
  a2 := public.start_iq_level('00000000-0000-0000-0000-0000000000c3', 'defense', 1::smallint);
  perform pg_temp.expect('second start resumes the same test', a2, a1);
  perform pg_temp.expect('the test keeps its dealt order',
    (select array_length(question_order, 1) from public.iq_level_attempts where id = a1), 5);
  a3 := public.start_iq_level('00000000-0000-0000-0000-0000000000c3', 'defense', 1::smallint, true);
  perform pg_temp.expect('restart deals a new test', a3 <> a1, true);
  perform pg_temp.expect('the abandoned test is gone', (select count(*) from public.iq_level_attempts where id = a1), 0::bigint);
end $$;

-- Review: missed questions, answered again, completes the review
do $$
declare v_attempt uuid; r record;
begin
  v_attempt := public.start_iq_level('00000000-0000-0000-0000-0000000000c3', 'defense', 1::smallint);
  -- answer 3 of 5 correctly, leave 2 wrong
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  select '00000000-0000-0000-0000-0000000000c3', q, case when i <= 3 then 0 else 1 end, i <= 3, v_attempt
    from unnest((select question_order from public.iq_level_attempts where id = v_attempt)) with ordinality as t(q, i);
  perform public.finish_iq_level(v_attempt);
  select * into r from public.iq_review_status(v_attempt);
  perform pg_temp.expect('review: 2 missed', r.missed, 2);
  perform pg_temp.expect('review: none answered yet', r.reviewed, 0);
  perform pg_temp.expect('review: not complete', r.complete, false);

  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, review_of, hint_used)
  select '00000000-0000-0000-0000-0000000000c3', q, 0, true, v_attempt, i = 4
    from unnest((select question_order from public.iq_level_attempts where id = v_attempt)) with ordinality as t(q, i)
   where i > 3;
  select * into r from public.iq_review_status(v_attempt);
  perform pg_temp.expect('review complete after all missed are answered', r.complete, true);
  perform pg_temp.expect('reviewed_at stamped', (select reviewed_at is not null from public.iq_level_attempts where id = v_attempt), true);
  perform pg_temp.expect('hint use recorded',
    (select count(*) from public.iq_answers where review_of = v_attempt and hint_used), 1::bigint);
  perform pg_temp.expect('finishing the review earns the MVP badge',
    (select count(*) from public.player_mvp_badges
      where player_id = '00000000-0000-0000-0000-0000000000c3' and track = 'defense' and level = 1 and attempt_id = v_attempt), 1::bigint);
  -- a second completed review of the same test doesn't add another badge
  perform public.iq_review_status(v_attempt);
  perform pg_temp.expect('one MVP badge per test',
    (select count(*) from public.player_mvp_badges where player_id = '00000000-0000-0000-0000-0000000000c3'), 1::bigint);
end $$;

-- An answer belongs to a test or a review, never both
do $$ begin
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id, review_of)
  select '00000000-0000-0000-0000-0000000000c3', q.id, 0, true, a.id, a.id
    from public.iq_questions q, public.iq_level_attempts a where q.active and q.track = 'defense' limit 1;
  raise exception 'FAIL: an answer counted for both a test and a review';
exception when check_violation then null;
end $$;

-- Position IQ tests and the Golden Glove --------------------------------------
insert into public.iq_questions (topic, position, track, level, scenario, question, choices, correct_index)
select 'position', 'SS', 'position', 1, 'ss scenario ' || g, 'q', array['right', 'wrong'], 0 from generate_series(1, 5) g;
insert into public.iq_questions (topic, position, track, level, scenario, question, choices, correct_index)
values ('position', 'C', 'position', 1, 'c scenario', 'q', array['right', 'wrong'], 0);

do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'position', 1::smallint);
  raise exception 'FAIL: a position test started without a position';
exception when invalid_parameter_value then null;
end $$;
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'position', 2::smallint, false, 'SS');
  raise exception 'FAIL: a position test started at Level 2';
exception when invalid_parameter_value then null;
end $$;
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'defense', 1::smallint, false, 'SS');
  raise exception 'FAIL: a playbook level took a position';
exception when invalid_parameter_value then null;
end $$;
do $$ begin
  insert into public.iq_questions (topic, position, track, level, scenario, question, choices, correct_index)
  values ('position', 'DP', 'position', 1, 'dp', 'q', array['a', 'b'], 0);
  raise exception 'FAIL: a position test question for DP was accepted';
exception when check_violation then null;
end $$;

do $$
declare ss uuid; c uuid; r record;
begin
  ss := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'position', 1::smallint, false, 'SS');
  c := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'position', 1::smallint, false, 'C');
  perform pg_temp.expect('SS and C tests can be open side by side', ss <> c, true);
  perform pg_temp.expect('starting SS again resumes it',
    public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'position', 1::smallint, false, 'SS'), ss);
  perform pg_temp.expect('the SS test deals only the 5 SS questions',
    (select count(*) from public.iq_questions q, public.iq_level_attempts a
      where a.id = ss and q.id = any (a.question_order) and q.position = 'SS'), 5::bigint);
  perform pg_temp.expect('the SS test has nothing else',
    (select array_length(question_order, 1) from public.iq_level_attempts where id = ss), 5);

  -- 4 of 5 (80%) earns the Golden Glove
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  select '00000000-0000-0000-0000-0000000000c1', q, case when i <= 4 then 0 else 1 end, i <= 4, ss
    from unnest((select question_order from public.iq_level_attempts where id = ss)) with ordinality as t(q, i);
  select * into r from public.finish_iq_level(ss);
  perform pg_temp.expect('position test: 80% passes', r.passed, true);
  perform pg_temp.expect('position test: Golden Glove earned', r.award_earned, true);
  perform pg_temp.expect('position test earns no ring', (select count(*) from public.player_rings where attempt_id = ss), 0::bigint);
  perform pg_temp.expect('the C test is still open', (select finished_at is null from public.iq_level_attempts where id = c), true);
end $$;
select pg_temp.expect('one SS Golden Glove',
  (select string_agg(position::text, ',') from public.player_golden_gloves where player_id = '00000000-0000-0000-0000-0000000000c1'), 'SS');

-- A perfect score earns the MVP badge outright (nothing to review)
do $$
declare c uuid; r record;
begin
  c := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'position', 1::smallint, false, 'C');
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  select '00000000-0000-0000-0000-0000000000c1', q, 0, true, c
    from unnest((select question_order from public.iq_level_attempts where id = c)) as t(q);
  select * into r from public.finish_iq_level(c);
  perform pg_temp.expect('perfect C test earns the Golden Glove', r.award_earned, true);
  perform pg_temp.expect('perfect score earns the MVP badge',
    (select count(*) from public.player_mvp_badges where attempt_id = c and position = 'C'), 1::bigint);
end $$;
select pg_temp.expect('an 80% test (not perfect) earns no MVP badge before its review',
  (select count(*) from public.player_mvp_badges
    where player_id = '00000000-0000-0000-0000-0000000000c1' and position = 'SS'), 0::bigint);

-- Extra Credit Library and the GGG World Series Trophy -------------------------
update public.iq_questions set active = false where track = 'extra';
insert into public.iq_questions (topic, track, level, section, scenario, question, choices, correct_index, hint)
select 'general', 'extra', 1, 'Shelf ' || (g % 2), 'extra ' || g, 'q', array['right', 'wrong'], 0, 'h' from generate_series(1, 5) g;

do $$ begin
  insert into public.iq_questions (topic, track, level, scenario, question, choices, correct_index)
  values ('general', 'extra', 1, 'no shelf', 'q', array['a', 'b'], 0);
  raise exception 'FAIL: a library question without a section was accepted';
exception when check_violation then null;
end $$;
do $$ begin
  perform public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'extra', 2::smallint);
  raise exception 'FAIL: the library started at Level 2';
exception when invalid_parameter_value then null;
end $$;

do $$
declare x uuid; r record;
begin
  x := public.start_iq_level('00000000-0000-0000-0000-0000000000c1', 'extra', 1::smallint);
  perform pg_temp.expect('a library run deals every active library question',
    (select array_length(question_order, 1) from public.iq_level_attempts where id = x), 5);
  -- answer 4 of 5 (one wrong), in any order, with a hint on one
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id, hint_used)
  select '00000000-0000-0000-0000-0000000000c1', q, case when i = 1 then 1 else 0 end, i <> 1, x, i = 2
    from unnest((select question_order from public.iq_level_attempts where id = x)) with ordinality as t(q, i)
   where i <= 4;
  begin
    perform public.finish_iq_level(x);
    raise exception 'FAIL: a library run was graded with a question unanswered';
  exception when sqlstate 'P0003' then null;
  end;
  insert into public.iq_answers (player_id, question_id, chosen_index, is_correct, attempt_id)
  select '00000000-0000-0000-0000-0000000000c1', (select question_order[5] from public.iq_level_attempts where id = x), 0, true, x;
  select * into r from public.finish_iq_level(x);
  perform pg_temp.expect('library run: 4/5 = 80% passes', r.correct::int || '/' || r.total::int || ' ' || r.passed, '4/5 true');
  perform pg_temp.expect('library run earns the World Series Trophy', r.award_earned, true);
  perform pg_temp.expect('one World Series Trophy',
    (select count(*) from public.player_world_series_trophies where player_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint);
  perform pg_temp.expect('hint used on a library answer is recorded',
    (select count(*) from public.iq_answers where attempt_id = x and hint_used), 1::bigint);
end $$;
