-- Offseason training (Phase 2): phases players can read, team routines copied to the
-- current roster and kept in step (also when the roster changes), coach routines a
-- player can check off but not change, editable test bands, the starter library, and
-- the offseason draft (head coach only; players see squads through team_squads()).
-- Seed: team b1, season a1, roster c1 Avery #7, c2 Jordan #21, c3 Riley #00, c4 Morgan #3.
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
  ('ffffffff-0000-0000-0000-000000000001', 'coach-t@example.test', '{}'),
  ('ffffffff-0000-0000-0000-000000000002', 'assist-t@example.test', '{}'),
  ('ffffffff-0000-0000-0000-000000000003', 'avery-t@example.test', '{"role": "player"}');
insert into public.staff (user_id, display_name, role) values
  ('ffffffff-0000-0000-0000-000000000001', 'T Coach', 'coach'),
  ('ffffffff-0000-0000-0000-000000000002', 'T Assistant', 'assistant');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'ffffffff-0000-0000-0000-000000000003', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';

select pg_temp.expect('starter library', (select count(*) >= 15 from public.drills where focus is not null), true);
select pg_temp.expect('the ACL warm-up', (select focus from public.drills where name = 'Landing Warm-Up (ACL prevention)'), 'landing');

-- An assistant coach plans a phase and pushes a routine
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000002"}', false);
insert into public.training_phases (id, team_id, kind, name, starts_on, ends_on)
values ('ffffffff-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'build', 'Build', '2026-11-09', '2027-01-10');
insert into public.team_routines (id, team_id, phase_id, title, details, category, days, starts_on)
values ('ffffffff-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'ffffffff-0000-0000-0000-0000000000a1',
        'Landing warm-up', '10 minutes', 'workout', '{1,3,5}', '2026-11-09');
select pg_temp.expect('copies for the roster', public.sync_team_routine('ffffffff-0000-0000-0000-0000000000b1'), 4);
select pg_temp.expect('a second sync adds none', public.sync_team_routine('ffffffff-0000-0000-0000-0000000000b1'), 0);
update public.team_routines set details = '12 minutes' where id = 'ffffffff-0000-0000-0000-0000000000b1';
select public.sync_team_routine('ffffffff-0000-0000-0000-0000000000b1');
reset role;
select pg_temp.expect('copies follow the template', (select string_agg(distinct details, ',') from public.player_activities where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1'), '12 minutes');
select pg_temp.expect('copies are coach routines', (select string_agg(distinct source, ',') from public.player_activities where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1'), 'coach');

-- Avery: reads the phase, checks the routine off, can't change or remove it
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('she reads her phase', (select name from public.training_phases where id = 'ffffffff-0000-0000-0000-0000000000a1'), 'Build');
select pg_temp.expect('no team templates for players', (select count(*) from public.team_routines), 0::bigint);
insert into public.twis_checks (player_id, activity_id, on_date)
select '00000000-0000-0000-0000-0000000000c1', id, '2026-11-09' from public.player_activities
 where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1' and player_id = '00000000-0000-0000-0000-0000000000c1';
update public.player_activities set title = 'Skip it' where team_routine_id is not null;
delete from public.player_activities where team_routine_id is not null;
select pg_temp.expect('she can''t add a coach routine', pg_temp.err($$insert into public.player_activities (player_id, title, starts_on, source) values ('00000000-0000-0000-0000-0000000000c1', 'x', '2026-11-09', 'coach')$$), '42501');
select pg_temp.expect('her own routines still work', pg_temp.err($$insert into public.player_activities (player_id, title, starts_on) values ('00000000-0000-0000-0000-0000000000c1', 'Tee work', '2026-11-09')$$), '');
select pg_temp.expect('she can''t sync', pg_temp.err($$select public.sync_team_routine('ffffffff-0000-0000-0000-0000000000b1')$$), '42501');
reset role;
select pg_temp.expect('her copy is untouched', (select title from public.player_activities where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1' and player_id = '00000000-0000-0000-0000-0000000000c1'), 'Landing warm-up');
select pg_temp.expect('her check-off saved', (select count(*) from public.twis_checks c join public.player_activities a on a.id = c.activity_id where a.team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1'), 1::bigint);

-- Roster changes: a new player gets it; a player who leaves has hers ended
insert into public.players (id, first_name, last_name) values ('ffffffff-0000-0000-0000-0000000000c9', 'Nia', 'New');
insert into public.roster_entries (team_id, season_id, player_id, jersey_number)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-0000000000c9', '44');
select pg_temp.expect('the new player has it', (select count(*) from public.player_activities where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1' and player_id = 'ffffffff-0000-0000-0000-0000000000c9'), 1::bigint);
update public.roster_entries set active = false where player_id = 'ffffffff-0000-0000-0000-0000000000c9';
select pg_temp.expect('her copy ended', (select ends_on is not null from public.player_activities where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1' and player_id = 'ffffffff-0000-0000-0000-0000000000c9'), true);

-- Test bands: staff edit, everyone signed in reads, players can't write
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000002"}', false);
insert into public.test_bands (metric_key, age_group, cutoffs) values ('pro_agility', '14U', '{6.2,5.8,5.5,5.2}');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('she reads the bands', (select cutoffs[1] from public.test_bands where metric_key = 'pro_agility' and age_group = '14U'), 6.2::numeric);
select pg_temp.expect('she can''t change them', pg_temp.err($$insert into public.test_bands (metric_key, age_group, cutoffs) values ('plank', '14U', '{1,2,3,4}')$$), '42501');
select pg_temp.expect('she can''t write measurements', pg_temp.err($$insert into public.measurements (player_id, metric_key, value) values ('00000000-0000-0000-0000-0000000000c1', 'pro_agility', 5.6)$$), '42501');
reset role;

-- The draft: the head coach makes squads; the assistant can't; players see them
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant can''t make squads', pg_temp.err($$insert into public.offseason_squads (team_id, name, captain_id, pick_order) values ('00000000-0000-0000-0000-0000000000b1', 'Heat', '00000000-0000-0000-0000-0000000000c1', 1)$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000001"}', false);
insert into public.offseason_squads (id, team_id, name, captain_id, pick_order) values
  ('ffffffff-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'Heat', '00000000-0000-0000-0000-0000000000c1', 1),
  ('ffffffff-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 'Storm', '00000000-0000-0000-0000-0000000000c2', 2);
insert into public.offseason_squad_members (team_id, player_id, squad_id, pick_no) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'ffffffff-0000-0000-0000-0000000000d1', 0),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', 'ffffffff-0000-0000-0000-0000000000d2', 0),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c3', 'ffffffff-0000-0000-0000-0000000000d1', 1);
select pg_temp.expect('one squad per player', pg_temp.err($$insert into public.offseason_squad_members (team_id, player_id, squad_id, pick_no) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c3', 'ffffffff-0000-0000-0000-0000000000d2', 2)$$), '23505');
select pg_temp.expect('no members across teams', pg_temp.err($$insert into public.offseason_squad_members (team_id, player_id, squad_id, pick_no) values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c4', 'ffffffff-0000-0000-0000-0000000000d2', 2)$$), '23503');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('she sees the squads', (select jsonb_array_length(public.team_squads('00000000-0000-0000-0000-0000000000b1'))), 2);
select pg_temp.expect('with members', (select jsonb_array_length(public.team_squads('00000000-0000-0000-0000-0000000000b1') -> 0 -> 'members')), 2);
select pg_temp.expect('not another team''s', pg_temp.err($$select public.team_squads('00000000-0000-0000-0000-0000000000b2')$$), '42501');
select pg_temp.expect('no direct reads', (select count(*) from public.offseason_squads), 0::bigint);
reset role;

-- Clean up
delete from public.offseason_squads where id::text like 'ffffffff-%';
delete from public.test_bands where metric_key = 'pro_agility' and age_group = '14U';
delete from public.twis_checks where activity_id in (select id from public.player_activities where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1');
delete from public.player_activities where team_routine_id = 'ffffffff-0000-0000-0000-0000000000b1' or (player_id = '00000000-0000-0000-0000-0000000000c1' and title = 'Tee work');
delete from public.team_routines where id::text like 'ffffffff-%';
delete from public.training_phases where id::text like 'ffffffff-%';
delete from public.roster_entries where player_id = 'ffffffff-0000-0000-0000-0000000000c9';
delete from public.players where id = 'ffffffff-0000-0000-0000-0000000000c9';
delete from public.player_claims where user_id::text like 'ffffffff-%';
delete from public.staff where user_id::text like 'ffffffff-%';
delete from auth.users where id::text like 'ffffffff-%';
