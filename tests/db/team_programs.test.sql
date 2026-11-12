-- Team Hitting Philosophy and the Throwing Program (user, 2026-11-12; migration
-- 20261112132321). Head coaches and admins write; assistants and viewers read; a player
-- reads her own team's (not another team's). Seed: c1 Avery on b1; d2 Casey on b2.
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
  ('e2e2e2e2-0000-0000-0000-000000000001', 'tp-avery@example.test', '{"role": "player"}'),
  ('e2e2e2e2-0000-0000-0000-000000000002', 'tp-casey@example.test', '{"role": "player"}'),
  ('e2e2e2e2-0000-0000-0000-000000000003', 'tp-assistant@example.test', '{}'),
  ('e2e2e2e2-0000-0000-0000-000000000004', 'tp-coach@example.test', '{}');
insert into public.staff (user_id, display_name, role) values
  ('e2e2e2e2-0000-0000-0000-000000000003', 'TP Assistant', 'assistant'),
  ('e2e2e2e2-0000-0000-0000-000000000004', 'TP Coach', 'coach');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select u.id, r.team_id, r.season_id, r.id, 'x', r.jersey_number, 'approved'
  from public.roster_entries r
  join (values ('e2e2e2e2-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid),
               ('e2e2e2e2-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-0000000000d2'::uuid)) u(id, player_id)
    on u.player_id = r.player_id;

-- The head coach writes both
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2e2e2e2-0000-0000-0000-000000000004"}', false);
insert into public.team_hitting_philosophy (team_id, statement, sections)
values ('00000000-0000-0000-0000-0000000000b1', 'On time.', '[{"title": "Two strikes", "body": "Battle."}]');
insert into public.team_throwing_programs (team_id, grp, intro, steps)
values ('00000000-0000-0000-0000-0000000000b1', 'innies', 'Quick feet.', '[{"name": "Wrist flicks", "dose": "10", "cue": null}]');
select pg_temp.expect('a group that isn''t one', pg_temp.err($$insert into public.team_throwing_programs (team_id, grp) values ('00000000-0000-0000-0000-0000000000b1', 'pitchers')$$), '23514');
select pg_temp.expect('sections must be a list', pg_temp.err($$update public.team_hitting_philosophy set sections = '{}' where team_id = '00000000-0000-0000-0000-0000000000b1'$$), '23514');
update public.team_hitting_philosophy set statement = 'On time, on the attack.' where team_id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.expect('who changed it last', (select updated_by::text from public.team_hitting_philosophy where team_id = '00000000-0000-0000-0000-0000000000b1'), 'e2e2e2e2-0000-0000-0000-000000000004');
reset role;

-- An assistant reads but can't write
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2e2e2e2-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('assistant reads the philosophy', (select statement from public.team_hitting_philosophy where team_id = '00000000-0000-0000-0000-0000000000b1'), 'On time, on the attack.');
select pg_temp.expect('assistant can''t change it', pg_temp.err($$update public.team_hitting_philosophy set statement = 'x' where team_id = '00000000-0000-0000-0000-0000000000b1'$$) ||
  (select count(*) from public.team_hitting_philosophy where statement = 'x')::text, '0');
select pg_temp.expect('assistant can''t add a program', pg_temp.err($$insert into public.team_throwing_programs (team_id, grp) values ('00000000-0000-0000-0000-0000000000b1', 'outies')$$), '42501');
reset role;

-- Avery (b1) reads her team's; Casey (b2) doesn't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2e2e2e2-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('Avery reads her team''s philosophy', (select count(*) from public.team_hitting_philosophy), 1::bigint);
select pg_temp.expect('Avery reads her team''s program', (select count(*) from public.team_throwing_programs), 1::bigint);
select pg_temp.expect('Avery can''t write it', pg_temp.err($$insert into public.team_throwing_programs (team_id, grp) values ('00000000-0000-0000-0000-0000000000b1', 'catchers')$$), '42501');
select set_config('request.jwt.claims', '{"sub":"e2e2e2e2-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('Casey doesn''t read another team''s', (select count(*) from public.team_hitting_philosophy) + (select count(*) from public.team_throwing_programs), 0::bigint);
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.team_hitting_philosophy where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.team_throwing_programs where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.player_claims where user_id::text like 'e2e2e2e2-%';
delete from public.staff where user_id::text like 'e2e2e2e2-%';
delete from auth.users where id::text like 'e2e2e2e2-%';
