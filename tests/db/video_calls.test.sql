-- Video calls (user, 2026-11-12; migration 20261113000035): an admin turns them on for a team,
-- its head coach switches them on for mentors; mentors and head coaches schedule calls with a
-- player; her parents and her login are notified and can join; nobody else sees them.
-- Seed: c1 Avery on b1; d2 Casey on b2.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to authenticated;
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
  ('e7e7e7e7-0000-0000-0000-000000000001', 'vc-head@example.test', '{}'),
  ('e7e7e7e7-0000-0000-0000-000000000002', 'vc-assistant@example.test', '{}'),
  ('e7e7e7e7-0000-0000-0000-000000000003', 'vc-admin@example.test', '{}'),
  ('e7e7e7e7-0000-0000-0000-000000000004', 'vc-avery@example.test', '{"role": "player"}'),
  ('e7e7e7e7-0000-0000-0000-000000000005', 'vc-mentor@example.test', '{"role": "mentor"}'),
  ('e7e7e7e7-0000-0000-0000-000000000006', 'vc-parent@example.test', '{"role": "parent"}'),
  ('e7e7e7e7-0000-0000-0000-000000000007', 'vc-casey@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('e7e7e7e7-0000-0000-0000-000000000001', 'VC Head', 'coach'),
  ('e7e7e7e7-0000-0000-0000-000000000002', 'VC Assistant', 'assistant'),
  ('e7e7e7e7-0000-0000-0000-000000000003', 'VC Admin', 'admin');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select u.id, r.team_id, r.season_id, r.id, 'x', r.jersey_number, 'approved'
  from public.roster_entries r
  join (values ('e7e7e7e7-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid),
               ('e7e7e7e7-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-0000000000d2'::uuid)) u(id, player_id)
    on u.player_id = r.player_id;
insert into public.mentors (user_id, display_name) values ('e7e7e7e7-0000-0000-0000-000000000005', 'VC Mentor');
insert into public.mentor_links (mentor_id, player_id, status) values ('e7e7e7e7-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000c1', 'approved');
insert into public.parent_accounts (user_id, display_name) values ('e7e7e7e7-0000-0000-0000-000000000006', 'VC Parent');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('e7e7e7e7-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now());

-- Off until an admin turns it on: nobody schedules, and a head coach can't turn it on
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('off: the head coach can''t schedule', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'VC Head', 'Swing check', now() + interval '1 day', 30, '81000000001')$$), '42501');
select pg_temp.expect('a head coach can''t turn it on', pg_temp.err($$insert into public.team_video_access (team_id) values ('00000000-0000-0000-0000-0000000000b1')$$), '42501');
select pg_temp.expect('her call team: off', (select public.video_call_team('00000000-0000-0000-0000-0000000000c1')), null::uuid);
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000003"}', false);
insert into public.team_video_access (team_id) values ('00000000-0000-0000-0000-0000000000b1');
reset role;

-- On for b1: the head coach schedules with Avery; an assistant can't; one call at a time; not in the past
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('her call team: b1', (select public.video_call_team('00000000-0000-0000-0000-0000000000c1')), '00000000-0000-0000-0000-0000000000b1'::uuid);
insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'VC Head', 'Swing check', now() + interval '1 day', 30, '81000000001');
select pg_temp.expect('one call at a time', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'VC Head', 'Again', now() + interval '1 day 15 minutes', 30, '81000000002')$$), 'P0008');
select pg_temp.expect('not in the past', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'VC Head', 'Late', now() - interval '1 hour', 30, '81000000003')$$), 'P0007');
select pg_temp.expect('not a player on another team', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2', 'coach', 'VC Head', 'Hi', now() + interval '3 days', 30, '81000000004')$$), '42501');
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('an assistant can''t schedule', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'VC Assistant', 'Hi', now() + interval '4 days', 30, '81000000005')$$), '42501');
reset role;

-- Mentors: not until the head coach switches them on
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('mentor: off for her', (select public.video_call_team('00000000-0000-0000-0000-0000000000c1')), null::uuid);
select pg_temp.expect('mentor can''t schedule yet', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'mentor', 'VC Mentor', 'Drop ball', now() + interval '2 days', 30, '81000000006')$$), '42501');
select pg_temp.expect('mentor can''t switch it on', pg_temp.err($$update public.team_video_access set mentors_on = true$$)
  || (select count(*) from public.team_video_access where mentors_on)::text, '0');
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001"}', false);
update public.team_video_access set mentors_on = true, mentors_set_at = now() where team_id = '00000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('mentor: on for her', (select public.video_call_team('00000000-0000-0000-0000-0000000000c1')), '00000000-0000-0000-0000-0000000000b1'::uuid);
insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'mentor', 'VC Mentor', 'Drop ball', now() + interval '2 days', 45, '81000000006');
select pg_temp.expect('only her own players', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', 'mentor', 'VC Mentor', 'Hi', now() + interval '5 days', 30, '81000000007')$$), '42501');
select pg_temp.expect('not as a coach', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'VC Mentor', 'Hi', now() + interval '5 days', 30, '81000000008')$$), '42501');
select pg_temp.expect('the mentor reads only her own calls', (select count(*) from public.video_calls), 1::bigint);
select pg_temp.expect('mentor hosts hers', (select public.video_call_role(id) from public.video_calls where zoom_meeting_id = '81000000006'), 'host');
reset role;
create temp table vc_ids as select id, zoom_meeting_id from public.video_calls where zoom_meeting_id like '8100000000%';
grant select on vc_ids to authenticated;

-- Who reads them and who was told
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000006"}', false);
select pg_temp.expect('her parent reads both', (select count(*) from public.video_calls), 2::bigint);
select pg_temp.expect('her parent was told of both', (select count(*) from public.notifications where kind = 'video-call'), 2::bigint);
select pg_temp.expect('her parent joins as a guest', (select public.video_call_role(id) from public.video_calls where zoom_meeting_id = '81000000006'), 'guest');
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('Avery reads both', (select count(*) from public.video_calls), 2::bigint);
select pg_temp.expect('Avery was told of both', (select count(*) from public.notifications where kind = 'video-call'), 2::bigint);
select pg_temp.expect('Avery can''t cancel', pg_temp.err($$update public.video_calls set cancelled_at = now()$$)
  || (select count(*) from public.video_calls where cancelled_at is not null)::text, '0');
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000007"}', false);
select pg_temp.expect('Casey reads none', (select count(*) from public.video_calls), 0::bigint);
select pg_temp.expect('Casey can''t join', pg_temp.err($$select public.video_call_role((select id from vc_ids where zoom_meeting_id = '81000000006'))$$), '42501');
select pg_temp.expect('Casey can''t ask about Avery', pg_temp.err($$select public.video_call_team('00000000-0000-0000-0000-0000000000c1')$$), '42501');
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('an assistant reads both', (select count(*) from public.video_calls), 2::bigint);
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('head coach told of the mentor''s call', (select count(*) from public.notifications where kind = 'video-call'), 1::bigint);
select pg_temp.expect('head coach drops in', (select public.video_call_role(id) from public.video_calls where zoom_meeting_id = '81000000006'), 'guest');
reset role;

-- Mentors switched off: her mentor's call can't happen
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001"}', false);
update public.team_video_access set mentors_on = false where team_id = '00000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000006"}', false);
select pg_temp.expect('mentor call off', (select public.video_call_role(id) from public.video_calls where zoom_meeting_id = '81000000006'), 'off');
select pg_temp.expect('coach call still on', (select public.video_call_role(id) from public.video_calls where zoom_meeting_id = '81000000001'), 'guest');
-- the mentor cancels hers; her parent hears
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000005"}', false);
update public.video_calls set cancelled_at = now(), cancelled_by = 'e7e7e7e7-0000-0000-0000-000000000005' where zoom_meeting_id = '81000000006';
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000006"}', false);
select pg_temp.expect('cancelled', (select public.video_call_role(id) from public.video_calls where zoom_meeting_id = '81000000006'), 'cancelled');
select pg_temp.expect('her parent was told', (select count(*) from public.notifications where title like 'Video call cancelled%'), 1::bigint);
-- the admin turns the team off: nothing on b1 can happen
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000003"}', false);
delete from public.team_video_access where team_id = '00000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('team off', (select public.video_call_role(id) from public.video_calls where zoom_meeting_id = '81000000001'), 'off');
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.notifications where user_id::text like 'e7e7e7e7-%';
delete from public.video_calls where zoom_meeting_id like '8100000000%';
delete from public.team_video_access where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.parent_links where parent_id::text like 'e7e7e7e7-%';
delete from public.parent_accounts where user_id::text like 'e7e7e7e7-%';
delete from public.mentor_links where mentor_id::text like 'e7e7e7e7-%';
delete from public.mentors where user_id::text like 'e7e7e7e7-%';
delete from public.player_claims where user_id::text like 'e7e7e7e7-%';
delete from public.staff where user_id::text like 'e7e7e7e7-%';
delete from auth.users where id::text like 'e7e7e7e7-%';
