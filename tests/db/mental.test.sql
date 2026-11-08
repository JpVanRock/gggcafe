-- Mental game (Phase 1): her signals, intensity checks, monthly self-scans and practice
-- journal (she keeps her own; staff read; mentors read checks and scans, not the
-- journal), guided sessions seeded as mental drills, and mental routines left out of
-- Leaderboard session points. Seed: c1 Avery #7 and c2 Jordan #21 on team b1.
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
  ('eeeeeeee-0000-0000-0000-000000000001', 'avery-m@example.test', '{"role": "player"}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'mentor-m@example.test', '{"role": "mentor"}'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'viewer-m@example.test', '{}');
insert into public.staff (user_id, display_name, role) values ('eeeeeeee-0000-0000-0000-000000000003', 'V Viewer', 'viewer');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'eeeeeeee-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.mentors (user_id, display_name) values ('eeeeeeee-0000-0000-0000-000000000002', 'Mo Mentor');
insert into public.mentor_players (mentor_id, player_id) values ('eeeeeeee-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1');

-- Guided sessions are mental drills in the training library
select pg_temp.expect('six guided drills', (select count(*) from public.drills where category = 'mental' and guide is not null), 6::bigint);

-- Avery keeps her own
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000001"}', false);
insert into public.mental_game_plans (player_id, green_signs, yellow_release, zone_low, zone_high)
values ('00000000-0000-0000-0000-0000000000c1', 'Loose hands', 'Breathe, tap my glove', 6, 8)
on conflict (player_id) do update set green_signs = excluded.green_signs, zone_low = excluded.zone_low, zone_high = excluded.zone_high;
select pg_temp.expect('zone low above high', pg_temp.err($$update public.mental_game_plans set zone_low = 9, zone_high = 7 where player_id = '00000000-0000-0000-0000-0000000000c1'$$), '23514');
insert into public.mental_intensity_checks (player_id, checked_on, context, level, adjustment)
values ('00000000-0000-0000-0000-0000000000c1', '2026-11-08', 'game', 4, 'Quick feet in warm-ups');
select pg_temp.expect('level 11', pg_temp.err($$insert into public.mental_intensity_checks (player_id, checked_on, level) values ('00000000-0000-0000-0000-0000000000c1', '2026-11-08', 11)$$), '23514');
insert into public.mental_scans (player_id, month, scores) values ('00000000-0000-0000-0000-0000000000c1', '2026-11-01', '{4,3,3,4,2,3,5,5,4,4}');
select pg_temp.expect('nine scores', pg_temp.err($$insert into public.mental_scans (player_id, month, scores) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-01', '{4,3,3,4,2,3,5,5,4}')$$), '23514');
select pg_temp.expect('a score of 6', pg_temp.err($$insert into public.mental_scans (player_id, month, scores) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-01', '{6,3,3,4,2,3,5,5,4,4}')$$), '23514');
select pg_temp.expect('not the 1st', pg_temp.err($$insert into public.mental_scans (player_id, month, scores) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-02', '{4,3,3,4,2,3,5,5,4,4}')$$), '23514');
insert into public.journal_entries (player_id, entry_date, purpose, worked, fix)
values ('00000000-0000-0000-0000-0000000000c1', '2026-11-05', 'Stay through the outside pitch', 'Drove two the other way', 'Late on the rise ball');
insert into public.journal_weeks (player_id, week_start, look_back) values ('00000000-0000-0000-0000-0000000000c1', '2026-11-02', 'Better on the outside pitch.');
select pg_temp.expect('weeks start Monday', pg_temp.err($$insert into public.journal_weeks (player_id, week_start, look_back) values ('00000000-0000-0000-0000-0000000000c1', '2026-11-03', 'x')$$), '23514');
-- not Jordan's
select pg_temp.expect('another player''s check', pg_temp.err($$insert into public.mental_intensity_checks (player_id, checked_on, level) values ('00000000-0000-0000-0000-0000000000c2', '2026-11-08', 5)$$), '42501');
select pg_temp.expect('another player''s journal', pg_temp.err($$insert into public.journal_entries (player_id, entry_date, purpose) values ('00000000-0000-0000-0000-0000000000c2', '2026-11-05', 'x')$$), '42501');
select pg_temp.expect('she reads her own', (select count(*) from public.journal_entries) + (select count(*) from public.mental_scans) + (select count(*) from public.mental_intensity_checks), 3::bigint);
reset role;

-- Staff read; a viewer can't write
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('viewer reads her journal', (select count(*) from public.journal_entries where player_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint);
select pg_temp.expect('viewer can''t write', pg_temp.err($$insert into public.mental_intensity_checks (player_id, checked_on, level) values ('00000000-0000-0000-0000-0000000000c1', '2026-11-08', 5)$$), '42501');
reset role;

-- Her mentor reads checks, scans and signals, not the journal
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('mentor reads checks', (select count(*) from public.mental_intensity_checks), 1::bigint);
select pg_temp.expect('mentor reads scans', (select count(*) from public.mental_scans), 1::bigint);
select pg_temp.expect('mentor reads signals', (select green_signs from public.mental_game_plans where player_id = '00000000-0000-0000-0000-0000000000c1'), 'Loose hands');
select pg_temp.expect('mentor doesn''t read the journal', (select count(*) from public.journal_entries) + (select count(*) from public.journal_weeks), 0::bigint);
reset role;

-- Leaderboard: a hitting routine counts as a training session, a mental routine doesn't
insert into public.player_activities (id, player_id, title, days, starts_on, category, drill_id) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Tee work', '{}', '2020-01-06', 'hitting', null),
  ('eeeeeeee-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'Reset Breath', '{}', '2020-01-06', 'mental',
   (select id from public.drills where guide = 'reset-breath'));
insert into public.twis_checks (player_id, activity_id, on_date) values
  ('00000000-0000-0000-0000-0000000000c1', 'eeeeeeee-0000-0000-0000-0000000000a1', '2020-01-06'),
  ('00000000-0000-0000-0000-0000000000c1', 'eeeeeeee-0000-0000-0000-0000000000a2', '2020-01-06');
select pg_temp.expect('one training session, no mental points',
  (select training || '/' || points from private.offseason_tally('00000000-0000-0000-0000-0000000000c1', '2020-01-01', '2020-01-31')), '1/3');

-- The G3 course columns
select pg_temp.expect('course columns', (select count(*) from information_schema.columns
  where table_name = 'player_advanced_chapters' and column_name in ('course_step', 'course_done_at')), 2::bigint);

-- Clean up
delete from public.twis_checks where activity_id::text like 'eeeeeeee-%';
delete from public.player_activities where id::text like 'eeeeeeee-%';
delete from public.journal_entries where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.journal_weeks where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.mental_scans where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.mental_intensity_checks where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.mental_game_plans where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.mentor_players where mentor_id = 'eeeeeeee-0000-0000-0000-000000000002';
delete from public.mentors where user_id = 'eeeeeeee-0000-0000-0000-000000000002';
delete from public.player_claims where user_id::text like 'eeeeeeee-%';
delete from public.staff where user_id::text like 'eeeeeeee-%';
delete from auth.users where id::text like 'eeeeeeee-%';
