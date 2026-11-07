-- Coaches Dugout: team standards/culture, drill library, practice plans and
-- the coaching-staff email list. Uses its own coach and viewer, removed at the
-- end so the access checks in zz_rls.test.sql start clean.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('22222222-0000-0000-0000-000000000001', 'dugout-coach@example.test'),
  ('22222222-0000-0000-0000-000000000002', 'dugout-viewer@example.test');
insert into public.staff (user_id, display_name, role) values
  ('22222222-0000-0000-0000-000000000001', 'Dugout Coach',  'coach'),
  ('22222222-0000-0000-0000-000000000002', 'Dugout Viewer', 'viewer');

-- Seed sample: culture + 3 standards, 5 drills, a plan with 3 blocks and 5 spots
select pg_temp.expect('seed standards', (select count(*) from public.team_standards), 3::bigint),
       pg_temp.expect('seed drills', (select count(*) from public.practice_drills), 5::bigint),
       pg_temp.expect('seed plan blocks', (select count(*) from public.practice_plan_drills), 3::bigint),
       pg_temp.expect('two players can share a position',
         (select count(*) from public.practice_plan_positions where position = 'SS'), 2::bigint);

-- ---------------------------------------------------------------------------
-- Coach
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-000000000001"}', false);

-- Standards: blank titles are skipped, order kept, list replaced on save
select public.save_team_dugout('00000000-0000-0000-0000-0000000000b1', '  One team  ', 'We win the day.',
  '[{"title": "Hustle"}, {"title": "  "}, {"title": "Talk on defense", "detail": "Call every ball."}]'::jsonb);
select pg_temp.expect('standards replaced and renumbered',
         (select string_agg(position || ':' || title, ',' order by position) from public.team_standards
           where team_id = '00000000-0000-0000-0000-0000000000b1'), '1:Hustle,2:Talk on defense'),
       pg_temp.expect('culture headline trimmed',
         (select headline from public.team_culture where team_id = '00000000-0000-0000-0000-0000000000b1'), 'One team'),
       pg_temp.expect('culture updated_by is the coach',
         (select updated_by from public.team_culture where team_id = '00000000-0000-0000-0000-0000000000b1'),
         '22222222-0000-0000-0000-000000000001'::uuid);
select public.save_team_dugout('00000000-0000-0000-0000-0000000000b1', null, null, '[]'::jsonb);
select pg_temp.expect('standards cleared',
         (select count(*) from public.team_standards where team_id = '00000000-0000-0000-0000-0000000000b1'), 0::bigint),
       pg_temp.expect('culture cleared',
         (select statement from public.team_culture where team_id = '00000000-0000-0000-0000-0000000000b1'), null::text);

-- Drill library: names are unique regardless of case
insert into public.practice_drills (id, name, tags) values
  ('00000000-0000-0000-0000-0000000000f6', 'Pop-up priorities', '{infield,outfield,defense}');
do $$ begin
  insert into public.practice_drills (name) values ('POP-UP PRIORITIES');
  raise exception 'FAIL: a duplicate drill name was accepted';
exception when unique_violation then null;
end $$;

-- Practice plan: drills in order, custom blocks, a deleted drill keeps its copy,
-- duplicate spots ignored, players shared at a position
insert into public.practice_plans (id, team_id, practice_date, total_minutes)
values ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000b1', '2026-09-17', 90);
select pg_temp.expect('plan created as a draft by the coach',
  (select status::text || ' ' || created_by from public.practice_plans where id = '00000000-0000-0000-0000-0000000000fa'),
  'draft 22222222-0000-0000-0000-000000000001');
select pg_temp.expect('save returns the new updated_at', public.save_practice_plan('00000000-0000-0000-0000-0000000000fa', '{
  "practice_date": "2026-09-17", "start_time": "18:00", "setting": "indoor", "total_minutes": 90, "focus": " Bunt D ",
  "drills": [
    {"drill_id": "00000000-0000-0000-0000-0000000000f6", "name": "Pop-up priorities", "tags": ["infield", "defense"],
     "minutes": 20, "coaches": ["Coach Sam", " ", "Coach Lee"], "equipment": "Pop-up machine"},
    {"name": "Water break", "minutes": 5},
    {"drill_id": "00000000-0000-0000-0000-00000000dead", "name": "Gone from the library", "minutes": 10},
    {"name": "   ", "minutes": 5}
  ],
  "positions": [
    {"position": "SS", "player_id": "00000000-0000-0000-0000-0000000000c1"},
    {"position": "SS", "player_id": "00000000-0000-0000-0000-0000000000c4"},
    {"position": "SS", "player_id": "00000000-0000-0000-0000-0000000000c1"},
    {"position": "P",  "player_id": "00000000-0000-0000-0000-0000000000c2"},
    {"position": "LF", "player_id": "00000000-0000-0000-0000-00000000dead"}
  ]
}'::jsonb) is not null, true);
select pg_temp.expect('plan setup saved',
         (select setting::text || ' ' || total_minutes || ' ' || start_time || ' ' || focus
            from public.practice_plans where id = '00000000-0000-0000-0000-0000000000fa'), 'indoor 90 18:00:00 Bunt D'),
       pg_temp.expect('blocks in order, blank one skipped',
         (select string_agg(position || ':' || name || ':' || minutes, ',' order by position)
            from public.practice_plan_drills where plan_id = '00000000-0000-0000-0000-0000000000fa'),
         '1:Pop-up priorities:20,2:Water break:5,3:Gone from the library:10'),
       pg_temp.expect('coaches trimmed, blanks dropped',
         (select coaches from public.practice_plan_drills where plan_id = '00000000-0000-0000-0000-0000000000fa' and position = 1),
         array['Coach Sam', 'Coach Lee']),
       pg_temp.expect('missing library drill unlinked',
         (select drill_id from public.practice_plan_drills where plan_id = '00000000-0000-0000-0000-0000000000fa' and position = 3),
         null::uuid),
       pg_temp.expect('spots: duplicates and unknown players dropped',
         (select string_agg(position::text || ':' || right(player_id::text, 2), ',' order by sort)
            from public.practice_plan_positions where plan_id = '00000000-0000-0000-0000-0000000000fa'),
         'SS:c1,SS:c4,P:c2');

-- Final plans are locked until reopened
update public.practice_plans set status = 'final', finalized_at = now() where id = '00000000-0000-0000-0000-0000000000fa';
do $$ begin
  perform public.save_practice_plan('00000000-0000-0000-0000-0000000000fa',
    '{"practice_date": "2026-09-17", "setting": "outdoor", "total_minutes": 90}'::jsonb);
  raise exception 'FAIL: a final plan was edited';
exception when sqlstate 'P0004' then null;
end $$;
do $$ begin
  update public.practice_plans set status = 'final', finalized_at = null where id = '00000000-0000-0000-0000-0000000000f9';
  raise exception 'FAIL: a plan was final without finalized_at';
exception when check_violation then null;
end $$;

-- Coaching staff list includes emails for coaches
select pg_temp.expect('coach sees coaching staff emails',
  (select email from public.coaching_staff() where display_name = 'Dugout Coach'), 'dugout-coach@example.test'),
       pg_temp.expect('viewers are not on the coaching staff list',
  (select count(*) from public.coaching_staff() where display_name = 'Dugout Viewer'), 0::bigint);
reset role;

-- ---------------------------------------------------------------------------
-- Viewer: reads the Dugout, changes nothing, sees no emails
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('viewer reads plans', (select count(*) from public.practice_plans), 2::bigint),
       pg_temp.expect('viewer gets no staff emails', (select count(*) from public.coaching_staff()), 0::bigint);
do $$ begin
  perform public.save_team_dugout('00000000-0000-0000-0000-0000000000b1', 'x', 'x', '[]'::jsonb);
  raise exception 'FAIL: viewer could save team standards';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.save_practice_plan('00000000-0000-0000-0000-0000000000f9',
    '{"practice_date": "2026-09-15", "setting": "outdoor", "total_minutes": 60}'::jsonb);
  raise exception 'FAIL: viewer could save a practice plan';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.practice_drills (name) values ('Viewer drill');
  raise exception 'FAIL: viewer could add a drill';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Calendar (team events): coaches add and change them; viewers can't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-000000000001"}', false);
insert into public.team_events (id, team_id, kind, event_date, series_id) values
  ('00000000-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-0000000000b1', 'practice', '2026-12-01', '00000000-0000-0000-0000-00000000ee01'),
  ('00000000-0000-0000-0000-00000000ec02', '00000000-0000-0000-0000-0000000000b1', 'practice', '2026-12-08', '00000000-0000-0000-0000-00000000ee01');
update public.team_events set title = 'Bunt defense' where id = '00000000-0000-0000-0000-00000000ec01';
select pg_temp.expect('coach edit records updated_by',
  (select title || ' ' || updated_by from public.team_events where id = '00000000-0000-0000-0000-00000000ec01'),
  'Bunt defense 22222222-0000-0000-0000-000000000001');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-000000000002"}', false);
update public.team_events set event_date = '2027-01-01' where series_id = '00000000-0000-0000-0000-00000000ee01';
delete from public.team_events where series_id = '00000000-0000-0000-0000-00000000ee01';
do $$ begin
  insert into public.team_events (team_id, event_date) values ('00000000-0000-0000-0000-0000000000b1', '2026-12-15');
  raise exception 'FAIL: viewer could add a calendar event';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.expect('viewer could not move or delete calendar events',
  (select string_agg(event_date::text, ',' order by event_date) from public.team_events
    where series_id = '00000000-0000-0000-0000-00000000ee01'), '2026-12-01,2026-12-08');
delete from public.team_events where series_id = '00000000-0000-0000-0000-00000000ee01';

-- Signed-out visitors can't call the staff email list
do $$ begin
  if has_function_privilege('anon', 'public.coaching_staff()', 'execute') then
    raise exception 'FAIL: anon can execute public.coaching_staff()';
  end if;
end $$;

-- Clean up the test accounts
delete from public.staff where user_id in ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002');
delete from auth.users where id in ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002');
