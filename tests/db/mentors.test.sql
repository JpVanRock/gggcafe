-- Mentors: a mentor asks with the team code (one player by name, or the whole team); the
-- player's parents approve a one-player request, the head coach a whole-team one; she reads
-- only the players she's approved for. Messages stay between her, the player, the parents and
-- admins unless she shares one with the coaches. Notes with the coaches and focus areas
-- (coaches read and reply; parents read the ones about their daughter; players see none).
-- Training dates need no switch. Own users, removed at the end.
-- Seed: team b1 = c1 Avery #7, c2 Jordan Kim #21 (P), c3 Riley, c4 Morgan.
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
create function pg_temp.as_user(uid text) returns void
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid)::text, false) $$;
grant execute on function pg_temp.as_user(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000001', 'mentor@example.test', '{"role": "mentor", "display_name": "Pat Pitching", "specialty": "Pitching"}'),
  ('cccccccc-0000-0000-0000-000000000002', 'm-admin@example.test', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'm-coach@example.test', '{}'),
  ('cccccccc-0000-0000-0000-000000000004', 'jordan@example.test', '{"role": "player"}'),
  ('cccccccc-0000-0000-0000-000000000005', 'jordan-parent@example.test', '{"role": "parent"}'),
  ('cccccccc-0000-0000-0000-000000000006', 'hitting@example.test', '{"role": "mentor", "display_name": "Hana Hitting"}'),
  ('cccccccc-0000-0000-0000-000000000007', 'm-assistant@example.test', '{}'),
  ('cccccccc-0000-0000-0000-000000000008', 'avery-parent@example.test', '{"role": "parent"}');
insert into public.staff (user_id, display_name, role) values
  ('cccccccc-0000-0000-0000-000000000002', 'M Admin', 'admin'),
  ('cccccccc-0000-0000-0000-000000000003', 'M Coach', 'coach'),
  ('cccccccc-0000-0000-0000-000000000007', 'M Assistant', 'assistant');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'cccccccc-0000-0000-0000-000000000004', r.team_id, r.season_id, r.id, 'Jordan Kim', '21', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c2';
insert into public.parent_accounts (user_id, display_name) values
  ('cccccccc-0000-0000-0000-000000000005', 'Jo Kim'),
  ('cccccccc-0000-0000-0000-000000000008', 'Al Lopez');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('cccccccc-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000b1', 'Jordan Kim', '00000000-0000-0000-0000-0000000000c2', 'approved', now()),
  ('cccccccc-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now());
create temp table saved_code as select team_code from public.teams where id = '00000000-0000-0000-0000-0000000000b1';
grant select on saved_code to authenticated;
update public.teams set team_code = 'MNTR42' where id = '00000000-0000-0000-0000-0000000000b1';

-- ---------------------------------------------------------------------------
-- A one-player request: only mentor accounts ask, with the team code and her name
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000004');
select pg_temp.expect('a player can''t ask to mentor', pg_temp.err($$select public.request_mentor('MNTR42', '')$$), '42501');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000001');
select pg_temp.expect('wrong code', pg_temp.err($$select public.request_mentor('NOPE99', 'Jordan Kim')$$), 'P0006');
select pg_temp.expect('no such player', pg_temp.err($$select public.request_mentor('mntr-42', 'Nobody Here')$$), 'P0007');
select pg_temp.expect('asks for Jordan', public.request_mentor('mntr-42', '  jordan   KIM '), 'Sample Squad 14U');
select public.request_mentor('MNTR42', 'Jordan Kim');
select pg_temp.expect('asking again adds nothing', (select count(*) from public.mentor_links), 1::bigint);
select pg_temp.expect('her profile from her sign-up', (select display_name || '/' || specialty from public.mentors), 'Pat Pitching/Pitching');
select pg_temp.expect('her request, with the team name', (select team_name || '/' || player_name || '/' || status from public.my_mentor_links()), 'Sample Squad 14U/Jordan Kim/pending');
select pg_temp.expect('waiting: no players', (select count(*) from public.players), 0::bigint);
select pg_temp.expect('waiting: no messages', pg_temp.err($$insert into public.mentor_messages (player_id, body) values ('00000000-0000-0000-0000-0000000000c2', 'Hi')$$), '42501');
select pg_temp.expect('she can''t approve herself', pg_temp.err($$select public.decide_mentor_link((select id from public.mentor_links), true)$$), '42501');
reset role;
create temp table pat_link as select id from public.mentor_links where mentor_id = 'cccccccc-0000-0000-0000-000000000001';
grant select on pat_link to authenticated;

-- Only Jordan's parents (or an admin) approve it: not the head coach, another parent or Jordan
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect('head coach can''t approve a one-player request', pg_temp.err($$select public.decide_mentor_link((select id from public.mentor_links where mentor_id = 'cccccccc-0000-0000-0000-000000000001'), true)$$), '42501');
select pg_temp.expect('one-player requests aren''t in the coach count', public.mentor_requests_waiting(), 0::bigint);
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000008');
select pg_temp.expect('another parent doesn''t see it', (select count(*) from public.mentor_links), 0::bigint);
select pg_temp.expect('another parent can''t approve', pg_temp.err($$select public.decide_mentor_link((select id from pat_link), true)$$), '42501');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000004');
select pg_temp.expect('Jordan doesn''t see it', (select count(*) from public.mentor_links), 0::bigint);
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000005');
select pg_temp.expect('her parent sees the request and who asked', (select m.display_name from public.mentor_links l join public.mentors m on m.user_id = l.mentor_id), 'Pat Pitching');
select public.decide_mentor_link((select id from public.mentor_links), true);
select pg_temp.expect('decided once', pg_temp.err($$select public.decide_mentor_link((select id from public.mentor_links), false)$$), 'P0002');
reset role;

-- Approved: she reads Jordan only, and nothing staff-only
insert into public.mental_game_plans (player_id) values ('00000000-0000-0000-0000-0000000000c2') on conflict do nothing;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000001');
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

-- Messages: one private, one with a drill she adds to the library (her name comes from her record)
insert into public.practice_drills (id, name, tags, video_url)
values ('cccccccc-0000-0000-0000-0000000000d1', 'Mentor Test Drill', '{pitchers}', 'https://example.com/drill');
insert into public.mentor_messages (player_id, body, sender_name)
values ('00000000-0000-0000-0000-0000000000c2', 'Great bullpen today. Keep your front side closed.', 'Head Coach');
insert into public.mentor_messages (player_id, body, drill_id)
values ('00000000-0000-0000-0000-0000000000c2', 'Try this before Thursday.', 'cccccccc-0000-0000-0000-0000000000d1');
select pg_temp.expect('sender name from her record', (select string_agg(distinct sender_name, ',') from public.mentor_messages), 'Pat Pitching');
select pg_temp.expect('drill copied onto the message',
  (select drill_name || ' ' || drill_video_url from public.mentor_messages where drill_id is not null), 'Mentor Test Drill https://example.com/drill');
select pg_temp.expect('private until she shares', (select count(*) from public.mentor_messages where shared_with_coaches), 0::bigint);
select pg_temp.expect('not a player of hers', pg_temp.err($$insert into public.mentor_messages (player_id, body) values ('00000000-0000-0000-0000-0000000000c1', 'Hi')$$), '42501');
update public.mentor_messages set shared_with_coaches = true where drill_id is not null;
select pg_temp.expect('she shared one', (select count(*) from public.mentor_messages where shared_with_coaches), 1::bigint);
select pg_temp.expect('she can''t mark it read', pg_temp.err($$update public.mentor_messages set read_at = now()$$), '42501');

-- Training dates: no admin switch; her players only
insert into public.player_activities (player_id, title, days, starts_on, ends_on, source)
values ('00000000-0000-0000-0000-0000000000c2', 'Pitching lesson', '{2}', '2027-01-05', '2027-01-05', 'mentor');
select pg_temp.expect('she sees the date she added', (select count(*) from public.player_activities), 1::bigint);
select pg_temp.expect('not for another player', pg_temp.err($$insert into public.player_activities (player_id, title, days, starts_on, ends_on, source) values ('00000000-0000-0000-0000-0000000000c1', 'x', '{2}', '2027-01-05', '2027-01-05', 'mentor')$$), '42501');

-- Notes with the coaches and focus areas, about Jordan only
insert into public.mentor_notes (mentor_id, player_id, kind, discussed_on, body, author_name)
values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'summary', '2026-11-10', 'Talked with Coach about her drop ball.', 'Someone Else');
select pg_temp.expect('note signed from her record', (select author_name || '/' || author_role || '/' || discussed_on from public.mentor_notes), 'Pat Pitching/mentor/2026-11-10');
insert into public.mentor_focus (player_id, title) values ('00000000-0000-0000-0000-0000000000c2', 'Drive the drop ball');
update public.mentor_focus set status = 'working' where title = 'Drive the drop ball';
select pg_temp.expect('focus moves to what''s working', (select status from public.mentor_focus), 'working');
select pg_temp.expect('no notes about another player', pg_temp.err($$insert into public.mentor_notes (mentor_id, player_id, body) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'x')$$), '42501');
select pg_temp.expect('no team notes without the team', pg_temp.err($$insert into public.mentor_notes (mentor_id, team_id, body) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'x')$$), '42501');
select pg_temp.expect('not someone else''s thread', pg_temp.err($$insert into public.mentor_notes (mentor_id, player_id, body) values ('cccccccc-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000c2', 'x')$$), '42501');
reset role;

-- Jordan: reads her messages, marks them read, can't rewrite or share them; sees no notes or focus
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000004');
select pg_temp.expect('Jordan has two messages', (select count(*) from public.mentor_messages), 2::bigint);
select pg_temp.expect('she sees the drill without the library', (select drill_name from public.mentor_messages where drill_id is not null), 'Mentor Test Drill');
update public.mentor_messages set read_at = now();
select pg_temp.expect('marked read', (select count(*) from public.mentor_messages where read_at is not null), 2::bigint);
select pg_temp.expect('a player can''t rewrite a message', pg_temp.err($$update public.mentor_messages set body = 'changed'$$), '42501');
select pg_temp.expect('a player can''t share a message', pg_temp.err($$update public.mentor_messages set shared_with_coaches = true$$), '42501');
select pg_temp.expect('players see no mentor notes', (select count(*) from public.mentor_notes), 0::bigint);
select pg_temp.expect('players see no focus areas', (select count(*) from public.mentor_focus), 0::bigint);
reset role;

-- Her parent reads every message, the notes and the focus areas; another parent reads none
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000005');
select pg_temp.expect('parent reads both messages', (select count(*) from public.mentor_messages), 2::bigint);
select pg_temp.expect('parent reads the note', (select count(*) from public.mentor_notes), 1::bigint);
select pg_temp.expect('parent reads the focus area', (select title from public.mentor_focus), 'Drive the drop ball');
select pg_temp.expect('parent can''t write notes', pg_temp.err($$insert into public.mentor_notes (mentor_id, player_id, body) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'x')$$), '42501');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000008');
select pg_temp.expect('another parent: no messages', (select count(*) from public.mentor_messages), 0::bigint);
select pg_temp.expect('another parent: no notes', (select count(*) from public.mentor_notes) + (select count(*) from public.mentor_focus), 0::bigint);
reset role;

-- Coaches read only shared messages; admins read all. Notes: coaches read, head coaches reply.
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect('head coach reads the shared message only', (select count(*) from public.mentor_messages), 1::bigint);
delete from public.mentor_messages;  -- removes only what she can see: the shared one
select pg_temp.expect('head coach reads the notes and focus', (select count(*) from public.mentor_notes) + (select count(*) from public.mentor_focus), 2::bigint);
insert into public.mentor_notes (mentor_id, player_id, body) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'Agreed. We''ll work it at practice too.');
select pg_temp.expect('reply signed as the coach', (select author_name || '/' || author_role from public.mentor_notes where author_role <> 'mentor'), 'M Coach/coach');
update public.mentor_focus set status = 'working_on';
select pg_temp.expect('coaches don''t change her focus areas', (select status from public.mentor_focus), 'working');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000007');
select pg_temp.expect('assistant reads no private messages', (select count(*) from public.mentor_messages), 0::bigint);
select pg_temp.expect('assistant reads the notes', (select count(*) from public.mentor_notes), 2::bigint);
select pg_temp.expect('assistant can''t reply', pg_temp.err($$insert into public.mentor_notes (mentor_id, player_id, body) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'x')$$), '42501');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000002');
select pg_temp.expect('admin reads the private message', (select count(*) from public.mentor_messages), 1::bigint);
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000001');
select pg_temp.expect('the mentor reads the coach''s reply', (select count(*) from public.mentor_notes), 2::bigint);
reset role;

-- ---------------------------------------------------------------------------
-- A whole-team request: the head coach approves; she works with the current roster
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000006');
select public.request_mentor('MNTR42', null);
reset role;
create temp table team_link as select id from public.mentor_links where mentor_id = 'cccccccc-0000-0000-0000-000000000006';
grant select on team_link to authenticated;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000005');
select pg_temp.expect('parents don''t see a pending team request', (select count(*) from public.mentor_links where player_id is null), 0::bigint);
select pg_temp.expect('parents can''t approve a team request', pg_temp.err($$select public.decide_mentor_link((select id from team_link), true)$$), '42501');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000007');
select pg_temp.expect('assistant: none to decide', public.mentor_requests_waiting(), 0::bigint);
select pg_temp.expect('assistant can''t approve', pg_temp.err($$select public.decide_mentor_link((select id from public.mentor_links where player_id is null), true)$$), '42501');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect('head coach: one to decide', public.mentor_requests_waiting(), 1::bigint);
select public.decide_mentor_link((select id from public.mentor_links where player_id is null), true);
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000006');
select pg_temp.expect('team mentor reads the roster', (select count(*) from public.players), 4::bigint);
insert into public.mentor_notes (mentor_id, team_id, kind, body) values ('cccccccc-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000b1', 'note', 'Team: two-strike approach this month.');
insert into public.mentor_focus (team_id, title) values ('00000000-0000-0000-0000-0000000000b1', 'Two-strike approach');
insert into public.mentor_messages (player_id, body) values ('00000000-0000-0000-0000-0000000000c1', 'Nice round today.');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000005');
select pg_temp.expect('parents see who works with the team', (select count(*) from public.mentors), 2::bigint);
select pg_temp.expect('team notes aren''t on the family page', (select count(*) from public.mentor_notes where team_id is not null), 0::bigint);
reset role;

-- Removing: her parent removes the one-player mentor, the head coach the team mentor
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
delete from public.mentor_links where player_id is not null;  -- not the head coach's call
reset role;
select pg_temp.expect('the one-player link stays', (select count(*) from public.mentor_links where player_id is not null), 1::bigint);
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000005');
delete from public.mentor_links where player_id = '00000000-0000-0000-0000-0000000000c2';
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
delete from public.mentor_links where player_id is null;
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000001');
select pg_temp.expect('removed: no players', (select count(*) from public.players), 0::bigint);
select pg_temp.expect('she still sees what she sent', (select count(*) from public.mentor_messages), 1::bigint);
select pg_temp.expect('no new notes once removed', pg_temp.err($$insert into public.mentor_notes (mentor_id, player_id, body) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'x')$$), '42501');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000006');
select pg_temp.expect('team link removed: no players', (select count(*) from public.players), 0::bigint);
-- a declined request can be asked again
select public.request_mentor('MNTR42', '');
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select public.decide_mentor_link((select id from public.mentor_links where status = 'pending'), false);
reset role;
set role authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000006');
select public.request_mentor('MNTR42', '');
select pg_temp.expect('asked again after a no', (select string_agg(status::text, ',' order by requested_at, status) from public.mentor_links), 'declined,pending');
reset role;

-- Clean up
update public.teams set team_code = (select team_code from saved_code) where id = '00000000-0000-0000-0000-0000000000b1';
delete from public.player_activities where source = 'mentor';
delete from public.mentor_messages where sender_id::text like 'cccccccc-%';
delete from public.practice_drills where id = 'cccccccc-0000-0000-0000-0000000000d1';
delete from public.mental_game_plans where player_id = '00000000-0000-0000-0000-0000000000c2';
delete from public.mentors where user_id::text like 'cccccccc-%';
delete from public.parent_links where parent_id::text like 'cccccccc-%';
delete from public.parent_accounts where user_id::text like 'cccccccc-%';
delete from public.player_claims where user_id::text like 'cccccccc-%';
delete from public.staff where user_id::text like 'cccccccc-%';
delete from auth.users where id::text like 'cccccccc-%';
