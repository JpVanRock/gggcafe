-- Practice planning (Phase 7): the install checklist is staff-read, coach/assistant-write;
-- a plan's notes reach each player through my_practice_notes() with only her own cue,
-- never the coach-only notes; cues follow the plan's edit rights.
-- Seed: team b1 (season a1) = c1 Avery #7, c2 Jordan #21.
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
  ('b7b7b7b7-0000-0000-0000-000000000001', 'head-pp@example.test', '{}'),
  ('b7b7b7b7-0000-0000-0000-000000000002', 'assist-pp@example.test', '{}'),
  ('b7b7b7b7-0000-0000-0000-000000000003', 'avery-pp@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('b7b7b7b7-0000-0000-0000-000000000001', 'PP Head', 'coach'),
  ('b7b7b7b7-0000-0000-0000-000000000002', 'PP Assistant', 'assistant');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'b7b7b7b7-0000-0000-0000-000000000003', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';

-- The head coach writes a plan with notes and a cue for each player
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b7b7b7b7-0000-0000-0000-000000000001"}', false);
insert into public.practice_plans (id, team_id, practice_date, start_time, total_minutes, objective, rule_of_day, announcements, coach_notes)
values ('b7b7b7b7-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '2027-02-10', '17:30', 120,
        'Win the first-and-third', 'Sprint on and off', 'Bring turf shoes', 'Watch Jordan''s arm');
insert into public.practice_plan_cues (plan_id, player_id, cue) values
  ('b7b7b7b7-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Quick feet to the bag'),
  ('b7b7b7b7-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 'Long arm through');
select pg_temp.expect('a cue fits one line', pg_temp.err($$insert into public.practice_plan_cues (plan_id, player_id, cue) values ('b7b7b7b7-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', repeat('x', 121))$$), '23514');
insert into public.install_items (id, team_id, category, group_name, title)
values ('b7b7b7b7-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'situation', 'First and third', 'Runner breaks from first: our call');
insert into public.install_item_plans (item_id, plan_id) values ('b7b7b7b7-0000-0000-0000-0000000000b1', 'b7b7b7b7-0000-0000-0000-0000000000a1');
select pg_temp.expect('bad status', pg_temp.err($$update public.install_items set status = 'done' where id = 'b7b7b7b7-0000-0000-0000-0000000000b1'$$), '23514');
reset role;

-- The assistant moves the checklist along but can't change the head coach's cues
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b7b7b7b7-0000-0000-0000-000000000002"}', false);
update public.install_items set status = 'taught' where id = 'b7b7b7b7-0000-0000-0000-0000000000b1';
select pg_temp.expect('assistant can''t add cues to another coach''s plan',
  pg_temp.err($$insert into public.practice_plan_cues (plan_id, player_id, cue) values ('b7b7b7b7-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'x')$$), '42501');
delete from public.practice_plan_cues where plan_id = 'b7b7b7b7-0000-0000-0000-0000000000a1';
reset role;
select pg_temp.expect('assistant moved the install', (select status from public.install_items where id = 'b7b7b7b7-0000-0000-0000-0000000000b1'), 'taught');
select pg_temp.expect('assistant''s delete removed nothing', (select count(*) from public.practice_plan_cues where plan_id = 'b7b7b7b7-0000-0000-0000-0000000000a1'), 2::bigint);

-- Avery sees the plan's notes with her own cue, nothing else
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b7b7b7b7-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('her objective', (select objective from public.my_practice_notes('00000000-0000-0000-0000-0000000000c1', '2027-02-08', '2027-02-14')), 'Win the first-and-third');
select pg_temp.expect('her cue only', (select cue from public.my_practice_notes('00000000-0000-0000-0000-0000000000c1', '2027-02-08', '2027-02-14')), 'Quick feet to the bag');
select pg_temp.expect('outside the dates', (select count(*) from public.my_practice_notes('00000000-0000-0000-0000-0000000000c1', '2027-02-15', '2027-02-21')), 0::bigint);
select pg_temp.expect('not a teammate''s notes', (select count(*) from public.my_practice_notes('00000000-0000-0000-0000-0000000000c2', '2027-02-08', '2027-02-14')), 0::bigint);
select pg_temp.expect('no direct cue reads', (select count(*) from public.practice_plan_cues), 0::bigint);
select pg_temp.expect('no coach notes', (select count(*) from public.practice_plans where coach_notes is not null), 0::bigint);
select pg_temp.expect('no install checklist', (select count(*) from public.install_items), 0::bigint);
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.practice_plans where id = 'b7b7b7b7-0000-0000-0000-0000000000a1';
delete from public.install_items where id = 'b7b7b7b7-0000-0000-0000-0000000000b1';
delete from public.player_claims where user_id::text like 'b7b7b7b7-%';
delete from public.staff where user_id::text like 'b7b7b7b7-%';
delete from auth.users where id::text like 'b7b7b7b7-%';
