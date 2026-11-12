-- The Switchboard (user, 2026-11-12; migration 20261112134451). Head coaches turn features off
-- per team; the people it's about read their teams' switches; with Message players or Add
-- training off, mentors can't post them. Seed: c1 Avery on b1; d2 Casey on b2.
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
  ('e6e6e6e6-0000-0000-0000-000000000001', 'sb-head@example.test', '{}'),
  ('e6e6e6e6-0000-0000-0000-000000000002', 'sb-assistant@example.test', '{}'),
  ('e6e6e6e6-0000-0000-0000-000000000003', 'sb-avery@example.test', '{"role": "player"}'),
  ('e6e6e6e6-0000-0000-0000-000000000004', 'sb-casey@example.test', '{"role": "player"}'),
  ('e6e6e6e6-0000-0000-0000-000000000005', 'sb-mentor@example.test', '{"role": "mentor"}'),
  ('e6e6e6e6-0000-0000-0000-000000000006', 'sb-parent@example.test', '{"role": "parent"}');
insert into public.staff (user_id, display_name, role) values
  ('e6e6e6e6-0000-0000-0000-000000000001', 'SB Head', 'coach'),
  ('e6e6e6e6-0000-0000-0000-000000000002', 'SB Assistant', 'assistant');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select u.id, r.team_id, r.season_id, r.id, 'x', r.jersey_number, 'approved'
  from public.roster_entries r
  join (values ('e6e6e6e6-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid),
               ('e6e6e6e6-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-0000000000d2'::uuid)) u(id, player_id)
    on u.player_id = r.player_id;
insert into public.mentors (user_id, display_name) values ('e6e6e6e6-0000-0000-0000-000000000005', 'SB Mentor');
insert into public.mentor_links (mentor_id, player_id, status) values ('e6e6e6e6-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000c1', 'approved');
insert into public.parent_accounts (user_id, display_name) values ('e6e6e6e6-0000-0000-0000-000000000006', 'SB Parent');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('e6e6e6e6-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now());

-- Only head coaches switch; an assistant can't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant can''t', pg_temp.err($$insert into public.team_features_off (team_id, feature) values ('00000000-0000-0000-0000-0000000000b1', 'player.goals')$$), '42501');
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000001"}', false);
insert into public.team_features_off (team_id, feature) values
  ('00000000-0000-0000-0000-0000000000b1', 'mentor.messages'),
  ('00000000-0000-0000-0000-0000000000b1', 'mentor.training'),
  ('00000000-0000-0000-0000-0000000000b1', 'player.goals');
select pg_temp.expect('a key that isn''t one', pg_temp.err($$insert into public.team_features_off (team_id, feature) values ('00000000-0000-0000-0000-0000000000b1', 'everything')$$), '23514');
reset role;

-- Avery (b1) and her parent read b1's switches; Casey (b2) reads none
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('Avery reads her team''s', (select count(*) from public.team_features_off), 3::bigint);
select pg_temp.expect('her switches', (select string_agg(f, ',' order by f) from public.player_features_off('00000000-0000-0000-0000-0000000000c1') f), 'mentor.messages,mentor.training,player.goals');
select pg_temp.expect('she can''t switch them', pg_temp.err($$delete from public.team_features_off$$) || (select count(*) from public.team_features_off)::text, '3');
select pg_temp.expect('not another player''s', pg_temp.err($$select * from public.player_features_off('00000000-0000-0000-0000-0000000000c2')$$), '42501');
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('Casey reads none', (select count(*) from public.team_features_off), 0::bigint);
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000006"}', false);
select pg_temp.expect('her parent reads them', (select count(*) from public.team_features_off), 3::bigint);
reset role;

-- With Message players and Add training off, her mentor can't post them
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('mentor reads her switches', (select count(*) from public.player_features_off('00000000-0000-0000-0000-0000000000c1')), 3::bigint);
select pg_temp.expect('no message', pg_temp.err($$insert into public.mentor_messages (player_id, body) values ('00000000-0000-0000-0000-0000000000c1', 'Hi')$$), '42501');
select pg_temp.expect('no training', pg_temp.err($$insert into public.player_activities (player_id, title, days, starts_on, ends_on, source) values ('00000000-0000-0000-0000-0000000000c1', 'Lesson', '{2}', '2027-01-05', '2027-01-05', 'mentor')$$), '42501');
reset role;

-- Switched back on, it works again
delete from public.team_features_off where team_id = '00000000-0000-0000-0000-0000000000b1' and feature like 'mentor.%';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000005"}', false);
insert into public.mentor_messages (player_id, body) values ('00000000-0000-0000-0000-0000000000c1', 'SB hello');
select pg_temp.expect('the message went', (select count(*) from public.mentor_messages where body = 'SB hello'), 1::bigint);
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.mentor_messages where body = 'SB hello';
delete from public.team_features_off where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.parent_links where parent_id::text like 'e6e6e6e6-%';
delete from public.parent_accounts where user_id::text like 'e6e6e6e6-%';
delete from public.mentor_links where mentor_id::text like 'e6e6e6e6-%';
delete from public.mentors where user_id::text like 'e6e6e6e6-%';
delete from public.player_claims where user_id::text like 'e6e6e6e6-%';
delete from public.staff where user_id::text like 'e6e6e6e6-%';
delete from auth.users where id::text like 'e6e6e6e6-%';
