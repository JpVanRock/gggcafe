-- Mentors: admin approval, coach assignment, read-only access to her players only,
-- messages (sender name from her record), drill suggestions, the optional calendar
-- permission, and coach/admin oversight. Own users, removed at the end.
-- Seed: team b1 = c1 Avery #7, c2 Jordan #21 (P), c3 Riley, c4 Morgan.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000001', 'mentor@example.test', '{"role": "mentor", "display_name": "Pat Pitching", "specialty": "Pitching"}'),
  ('cccccccc-0000-0000-0000-000000000002', 'm-admin@example.test', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'm-coach@example.test', '{}'),
  ('cccccccc-0000-0000-0000-000000000004', 'jordan@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('cccccccc-0000-0000-0000-000000000002', 'M Admin', 'admin'),
  ('cccccccc-0000-0000-0000-000000000003', 'M Coach', 'coach');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'cccccccc-0000-0000-0000-000000000004', r.team_id, r.season_id, r.id, 'Jordan Kim', '21', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c2';

-- Admins see the sign-up waiting; coaches don't, and can't approve her
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('admin sees the mentor sign-up', (select display_name || '/' || specialty from public.pending_mentors()), 'Pat Pitching/Pitching');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('coach sees no sign-ups', (select count(*) from public.pending_mentors()), 0::bigint);
do $$ begin
  insert into public.mentors (user_id, display_name) values ('cccccccc-0000-0000-0000-000000000001', 'Pat Pitching');
  raise exception 'FAIL: a coach approved a mentor';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Before approval she reads nothing
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('unapproved: no players', (select count(*) from public.players), 0::bigint);
reset role;

-- The admin approves her; a coach assigns Jordan
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000002"}', false);
insert into public.mentors (user_id, display_name, specialty) values ('cccccccc-0000-0000-0000-000000000001', 'Pat Pitching', 'Pitching');
select pg_temp.expect('approved: off the waiting list', (select count(*) from public.pending_mentors()), 0::bigint);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003"}', false);
insert into public.mentor_players (mentor_id, player_id) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2');
reset role;

-- Jordan has a Mental GP and a SMART goal; a coach note she can't see
insert into public.mental_game_plans (player_id) values ('00000000-0000-0000-0000-0000000000c2') on conflict do nothing;

-- The mentor reads Jordan only, and nothing staff-only
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('mentor sees one player', (select string_agg(first_name, ',') from public.players), 'Jordan');
select pg_temp.expect('her roster spot', (select count(*) from public.roster_entries), 1::bigint);
select pg_temp.expect('her team', (select count(*) from public.teams), 1::bigint);
select pg_temp.expect('her Mental GP', (select count(*) from public.mental_game_plans), 1::bigint);
select pg_temp.expect('no coach notes', (select count(*) from public.coach_notes), 0::bigint);
select pg_temp.expect('no team schedule', (select count(*) from public.team_events), 0::bigint);
select pg_temp.expect('no staff list', (select count(*) from public.staff), 0::bigint);
do $$ begin
  update public.players set notes = 'x' where id = '00000000-0000-0000-0000-0000000000c2';
  if found then raise exception 'FAIL: a mentor edited a player'; end if;
end $$;

-- She adds a drill to the library and suggests it, and messages Jordan (her name comes from her record)
insert into public.practice_drills (id, name, tags, video_url)
values ('cccccccc-0000-0000-0000-0000000000d1', 'Mentor Test Drill', '{pitchers}', 'https://example.com/drill');
insert into public.mentor_messages (player_id, body, sender_name)
values ('00000000-0000-0000-0000-0000000000c2', 'Great bullpen today. Keep your front side closed.', 'Head Coach');
insert into public.mentor_messages (player_id, body, drill_id)
values ('00000000-0000-0000-0000-0000000000c2', 'Try this before Thursday.', 'cccccccc-0000-0000-0000-0000000000d1');
select pg_temp.expect('sender name from her record', (select string_agg(distinct sender_name, ',') from public.mentor_messages), 'Pat Pitching');
select pg_temp.expect('drill copied onto the message',
  (select drill_name || ' ' || drill_video_url from public.mentor_messages where drill_id is not null), 'Mentor Test Drill https://example.com/drill');
do $$ begin
  insert into public.mentor_messages (player_id, body) values ('00000000-0000-0000-0000-0000000000c1', 'Hi');
  raise exception 'FAIL: messaged a player who isn''t hers';
exception when insufficient_privilege then null;
end $$;
-- calendar dates need the admin's OK
do $$ begin
  insert into public.player_activities (player_id, title, days, starts_on, ends_on, source)
  values ('00000000-0000-0000-0000-0000000000c2', 'Pitching lesson', '{2}', '2027-01-05', '2027-01-05', 'mentor');
  raise exception 'FAIL: added a date without the calendar permission';
exception when insufficient_privilege then null;
end $$;
reset role;
update public.mentors set can_schedule = true where user_id = 'cccccccc-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001"}', false);
insert into public.player_activities (player_id, title, days, starts_on, ends_on, source)
values ('00000000-0000-0000-0000-0000000000c2', 'Pitching lesson', '{2}', '2027-01-05', '2027-01-05', 'mentor');
select pg_temp.expect('she sees the date she added', (select count(*) from public.player_activities), 1::bigint);
do $$ begin
  insert into public.player_activities (player_id, title, days, starts_on, ends_on, source)
  values ('00000000-0000-0000-0000-0000000000c1', 'x', '{2}', '2027-01-05', '2027-01-05', 'mentor');
  raise exception 'FAIL: added a date for a player who isn''t hers';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Jordan reads her messages and marks them read; she can't rewrite them
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('Jordan has two messages', (select count(*) from public.mentor_messages), 2::bigint);
select pg_temp.expect('she sees the drill without the library', (select drill_name from public.mentor_messages where drill_id is not null), 'Mentor Test Drill');
update public.mentor_messages set read_at = now();
select pg_temp.expect('marked read', (select count(*) from public.mentor_messages where read_at is not null), 2::bigint);
do $$ begin
  update public.mentor_messages set body = 'changed';
  raise exception 'FAIL: a player rewrote a message';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Coaches read every message (oversight) and can remove one
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('coach reads both messages', (select count(*) from public.mentor_messages), 2::bigint);
delete from public.mentor_messages where drill_id is not null;
select pg_temp.expect('coach removed one', (select count(*) from public.mentor_messages), 1::bigint);
-- unassigning her closes Jordan's profile to the mentor
delete from public.mentor_players where mentor_id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('unassigned: no players', (select count(*) from public.players), 0::bigint);
select pg_temp.expect('she still sees what she sent', (select count(*) from public.mentor_messages), 1::bigint);
reset role;

-- Clean up
delete from public.player_activities where source = 'mentor';
delete from public.mentor_messages where sender_id = 'cccccccc-0000-0000-0000-000000000001';
delete from public.practice_drills where id = 'cccccccc-0000-0000-0000-0000000000d1';
delete from public.mental_game_plans where player_id = '00000000-0000-0000-0000-0000000000c2';
delete from public.mentors where user_id = 'cccccccc-0000-0000-0000-000000000001';
delete from public.player_claims where user_id::text like 'cccccccc-%';
delete from public.staff where user_id::text like 'cccccccc-%';
delete from auth.users where id::text like 'cccccccc-%';
