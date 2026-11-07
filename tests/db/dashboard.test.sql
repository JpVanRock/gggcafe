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
