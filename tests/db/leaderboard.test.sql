-- Offseason Training Leaderboard: points, Player of the Week (rounds + six-week rule),
-- who can see it, and the + Activity logging limits. Own users, removed at the end.
-- Seed: team b1 = c1 Avery #7, c2 Jordan #21, c3 Riley #00, c4 Morgan #3; team b2 = d1, d2.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

-- w0: a Monday long past (and clear of the seed's 2026 data), so every test week is finished
create temp table lb_dates as select date '2020-01-06' as w0;
grant select on lb_dates to authenticated;

insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'lb-avery@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'lb-coach@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'lb-taylor@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'lb-viewer@example.test');
insert into public.staff (user_id, display_name, role) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'LB Coach', 'coach'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'LB Viewer', 'viewer');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select u, r.team_id, r.season_id, r.id, n, j, 'approved'
  from (values ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid, 'Avery Lopez', '7'),
               ('bbbbbbbb-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-0000000000d1'::uuid, 'Taylor Brooks', '12')) v(u, p, n, j)
  join public.roster_entries r on r.player_id = v.p;

-- A player can't set the offseason; a coach can (seven weeks: w0 .. w0 + 48)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001"}', false);
do $$ begin
  insert into public.team_offseason (team_id, starts_on) values ('00000000-0000-0000-0000-0000000000b1', current_date);
  raise exception 'FAIL: a player set the offseason dates';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect('no dates yet: no offseason',
  public.team_leaderboard('00000000-0000-0000-0000-0000000000b1') -> 'offseason', 'null'::jsonb);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}', false);
insert into public.team_offseason (team_id, starts_on, ends_on)
select '00000000-0000-0000-0000-0000000000b1', w0, w0 + 48 from lb_dates;
reset role;

-- The season's sessions (inserted directly: players can only log the last seven days)
insert into public.training_logs (player_id, kind, logged_on)
select p::uuid, k::public.session_kind, (select w0 from lb_dates) + d
  from (values
    -- week 1: Avery 7 + 3 = 10 (wins), Jordan 5
    ('00000000-0000-0000-0000-0000000000c1', 'lesson', 0), ('00000000-0000-0000-0000-0000000000c1', 'training', 1),
    ('00000000-0000-0000-0000-0000000000c2', 'workout', 2),
    -- week 2: Avery 20 (named this round), Jordan 10 wins
    ('00000000-0000-0000-0000-0000000000c1', 'lesson', 7), ('00000000-0000-0000-0000-0000000000c1', 'lesson', 8),
    ('00000000-0000-0000-0000-0000000000c1', 'training', 9), ('00000000-0000-0000-0000-0000000000c1', 'training', 10),
    ('00000000-0000-0000-0000-0000000000c2', 'workout', 8), ('00000000-0000-0000-0000-0000000000c2', 'workout', 9),
    -- week 3: Avery 14, Riley 7 + a training routine (3) = 10 wins
    ('00000000-0000-0000-0000-0000000000c1', 'lesson', 14), ('00000000-0000-0000-0000-0000000000c1', 'lesson', 15),
    ('00000000-0000-0000-0000-0000000000c3', 'lesson', 16),
    -- week 4: Avery 21, Morgan 5 (checked-off workout routine) + 5 = 10 wins; round 1 is complete
    ('00000000-0000-0000-0000-0000000000c1', 'lesson', 21), ('00000000-0000-0000-0000-0000000000c1', 'lesson', 22),
    ('00000000-0000-0000-0000-0000000000c1', 'lesson', 23),
    ('00000000-0000-0000-0000-0000000000c4', 'workout', 22),
    -- week 5: Jordan 12, Riley 10, but everyone won within six weeks: nobody
    ('00000000-0000-0000-0000-0000000000c2', 'lesson', 28), ('00000000-0000-0000-0000-0000000000c2', 'workout', 29),
    ('00000000-0000-0000-0000-0000000000c3', 'workout', 30), ('00000000-0000-0000-0000-0000000000c3', 'workout', 31),
    -- week 6: nothing logged
    -- week 7: Jordan 15 (won week 2: too soon), Avery 10 (won week 1: six weeks ago) wins round 2
    ('00000000-0000-0000-0000-0000000000c2', 'workout', 42), ('00000000-0000-0000-0000-0000000000c2', 'workout', 43),
    ('00000000-0000-0000-0000-0000000000c2', 'workout', 44),
    ('00000000-0000-0000-0000-0000000000c1', 'lesson', 43), ('00000000-0000-0000-0000-0000000000c1', 'training', 44),
    -- outside the offseason: doesn't count
    ('00000000-0000-0000-0000-0000000000c4', 'lesson', -3)
  ) v(p, k, d);
-- checked-off training routines count too: Riley's hitting (3), Morgan's workout (5); untyped activities don't
insert into public.player_activities (id, player_id, title, category, starts_on) values
  ('bbbbbbbb-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'Tee work', 'hitting', (select w0 from lb_dates)),
  ('bbbbbbbb-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c4', 'Lift', 'workout', (select w0 from lb_dates)),
  ('bbbbbbbb-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c4', 'Homework', null, (select w0 from lb_dates));
insert into public.twis_checks (player_id, activity_id, on_date) values
  ('00000000-0000-0000-0000-0000000000c3', 'bbbbbbbb-0000-0000-0000-0000000000a1', (select w0 + 17 from lb_dates)),
  ('00000000-0000-0000-0000-0000000000c4', 'bbbbbbbb-0000-0000-0000-0000000000a2', (select w0 + 24 from lb_dates)),
  ('00000000-0000-0000-0000-0000000000c4', 'bbbbbbbb-0000-0000-0000-0000000000a3', (select w0 + 24 from lb_dates));
-- an unlock inside the offseason (3 points) for Morgan in week 6, and one before it
insert into public.player_achievements (player_id, achievement_key, unlocked_on) values
  ('00000000-0000-0000-0000-0000000000c4', 'lb_test_inside', (select w0 + 36 from lb_dates)),
  ('00000000-0000-0000-0000-0000000000c4', 'lb_test_before', (select w0 - 10 from lb_dates));

-- Avery opens her team's leaderboard: totals and Players of the Week
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001"}', false);
create temp table lb as select public.team_leaderboard('00000000-0000-0000-0000-0000000000b1') as j;
select pg_temp.expect('four teammates', jsonb_array_length((select j -> 'players' from lb)), 4);
select pg_temp.expect('Avery: 9 lessons, 4 training = 75',
  (select (p ->> 'points')::int from lb, jsonb_array_elements(j -> 'players') p where p ->> 'first_name' = 'Avery'), 75);
select pg_temp.expect('Jordan: 1 lesson, 7 workouts = 42',
  (select (p ->> 'points')::int from lb, jsonb_array_elements(j -> 'players') p where p ->> 'first_name' = 'Jordan'), 42);
select pg_temp.expect('Riley: lesson, routine, 2 workouts = 20',
  (select (p ->> 'points')::int from lb, jsonb_array_elements(j -> 'players') p where p ->> 'first_name' = 'Riley'), 20);
select pg_temp.expect('Morgan: workout, workout routine, one unlock inside = 13',
  (select (p ->> 'points')::int || '/' || (p ->> 'unlocks') from lb, jsonb_array_elements(j -> 'players') p where p ->> 'first_name' = 'Morgan'), '13/1');
select pg_temp.expect('Players of the Week',
  (select string_agg(coalesce(w ->> 'first_name', '-') || ':' || (w ->> 'round'), ' ' order by w ->> 'week_start')
     from lb, jsonb_array_elements(j -> 'weeks') w),
  'Avery:1 Jordan:1 Riley:1 Morgan:1 -:2 -:2 Avery:2');
select pg_temp.expect('Avery named twice',
  (select (p ->> 'times_named')::int from lb, jsonb_array_elements(j -> 'players') p where p ->> 'first_name' = 'Avery'), 2);
-- opening it again decides nothing new
select pg_temp.expect('opens again', jsonb_typeof(public.team_leaderboard('00000000-0000-0000-0000-0000000000b1')), 'object');
select pg_temp.expect('seven weeks decided once', (select count(*) from public.team_player_of_week), 0::bigint); -- players can't read the table
reset role;
select pg_temp.expect('seven weeks decided once (staff view)', (select count(*) from public.team_player_of_week), 7::bigint);
-- the daily scheduled job (decide_all_players_of_week) finds nothing new to decide
select private.decide_all_players_of_week();
select pg_temp.expect('the daily job decides nothing twice', (select count(*) from public.team_player_of_week), 7::bigint);

-- Each new Player of the Week notified every coach and admin (five winners), not view-only staff
select pg_temp.expect('coach notified of five Players of the Week',
  (select count(*) from public.notifications where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and kind = 'player-of-the-week'), 5::bigint);
select pg_temp.expect('viewer not notified',
  (select count(*) from public.notifications where user_id = 'bbbbbbbb-0000-0000-0000-000000000004'), 0::bigint);
select pg_temp.expect('first one names Avery',
  (select title from public.notifications where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' order by created_at, title limit 1) like 'Player of the Week: %', true);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('coach bell: five unread', public.unread_notifications(), 5);
update public.notifications set read_at = now() where read_at is null;
select pg_temp.expect('coach bell: all read', public.unread_notifications(), 0);
do $$ begin
  update public.notifications set title = 'changed';
  raise exception 'FAIL: a coach rewrote a notification';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.notifications (user_id, kind, title) values ('bbbbbbbb-0000-0000-0000-000000000002', 'player-of-the-week', 'fake');
  raise exception 'FAIL: a user wrote a notification';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('viewer sees none of the coach''s notifications', (select count(*) from public.notifications), 0::bigint);
reset role;

-- Another team's player can't see it; view-only staff can
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000003"}', false);
do $$ begin
  perform public.team_leaderboard('00000000-0000-0000-0000-0000000000b1');
  raise exception 'FAIL: another team''s player saw the leaderboard';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect('she sees no teammates'' sessions', (select count(*) from public.training_logs), 0::bigint);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('viewer sees it', jsonb_array_length(public.team_leaderboard('00000000-0000-0000-0000-0000000000b1') -> 'players'), 4);
reset role;

-- + Activity: Avery logs her own sessions, up to seven days back, four a day, never a teammate's
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001"}', false);
insert into public.training_logs (player_id, kind, logged_on, note)
values ('00000000-0000-0000-0000-0000000000c1', 'lesson', private.team_today(), 'Hitting lesson');
select pg_temp.expect('she reads her own sessions', (select count(*) from public.training_logs where logged_on = private.team_today()), 1::bigint);
do $$ begin
  insert into public.training_logs (player_id, kind, logged_on) values ('00000000-0000-0000-0000-0000000000c1', 'training', private.team_today() - 8);
  raise exception 'FAIL: logged a session more than seven days back';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.training_logs (player_id, kind, logged_on) values ('00000000-0000-0000-0000-0000000000c1', 'training', private.team_today() + 1);
  raise exception 'FAIL: logged a session in the future';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.training_logs (player_id, kind, logged_on) values ('00000000-0000-0000-0000-0000000000c2', 'training', private.team_today());
  raise exception 'FAIL: logged a teammate''s session';
exception when insufficient_privilege then null;
end $$;
insert into public.training_logs (player_id, kind, logged_on)
select '00000000-0000-0000-0000-0000000000c1', 'training', private.team_today() from generate_series(1, 3);
do $$ begin
  insert into public.training_logs (player_id, kind, logged_on) values ('00000000-0000-0000-0000-0000000000c1', 'training', private.team_today());
  raise exception 'FAIL: logged a fifth session in one day';
exception when raise_exception then null;
end $$;
delete from public.training_logs where logged_on = private.team_today();
select pg_temp.expect('she removed them', (select count(*) from public.training_logs where logged_on = private.team_today()), 0::bigint);
reset role;

-- Clean up
delete from public.notifications where user_id::text like 'bbbbbbbb-%';
delete from public.training_logs where player_id::text like '00000000-0000-0000-0000-0000000000c%';
delete from public.twis_checks where activity_id::text like 'bbbbbbbb-%';
delete from public.player_activities where id::text like 'bbbbbbbb-%';
delete from public.player_achievements where achievement_key like 'lb_test_%';
delete from public.team_player_of_week;
delete from public.team_offseason;
delete from public.player_claims where user_id::text like 'bbbbbbbb-%';
delete from public.staff where user_id::text like 'bbbbbbbb-%';
delete from auth.users where id::text like 'bbbbbbbb-%';
