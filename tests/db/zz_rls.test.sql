-- Checks who can see and change what. Runs after stats.test.sql.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'admin@example.test'),
  ('11111111-0000-0000-0000-000000000002', 'coach@example.test'),
  ('11111111-0000-0000-0000-000000000003', 'viewer@example.test'),
  ('11111111-0000-0000-0000-000000000004', 'stranger@example.test');
insert into public.staff (user_id, display_name, role) values
  ('11111111-0000-0000-0000-000000000001', 'Admin',  'admin'),
  ('11111111-0000-0000-0000-000000000002', 'Coach',  'coach'),
  ('11111111-0000-0000-0000-000000000003', 'Viewer', 'viewer');

-- Signed-out visitor: sees nothing
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('anon teams',   (select count(*) from public.teams), 0::bigint),
       pg_temp.expect('anon scouting',(select count(*) from public.scouting_reports), 0::bigint),
       pg_temp.expect('anon batting view', (select count(*) from public.batting_season), 0::bigint);
reset role;

-- Signed in but not on staff: sees nothing, can't write
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('stranger players', (select count(*) from public.players), 0::bigint),
       pg_temp.expect('stranger staff',   (select count(*) from public.staff), 0::bigint);
do $$ begin
  insert into public.teams (name) values ('Stranger FC');
  raise exception 'FAIL: stranger could insert a team';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Viewer: reads everything, writes nothing
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('viewer teams', (select count(*) from public.teams), 2::bigint),
       pg_temp.expect('viewer pitching view', (select count(*) from public.pitching_season), 1::bigint);
do $$ begin
  insert into public.coach_notes (player_id, area, note)
  values ('00000000-0000-0000-0000-0000000000c1', 'hitting', 'viewer note');
  raise exception 'FAIL: viewer could write a coach note';
exception when insufficient_privilege then null;
end $$;
update public.teams set notes = 'viewer edit';
select pg_temp.expect('viewer update had no effect',
  (select count(*) from public.teams where notes = 'viewer edit'), 0::bigint);
reset role;

-- Coach: reads and writes app data, can't manage staff
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000002"}', false);
insert into public.coach_notes (player_id, area, note)
values ('00000000-0000-0000-0000-0000000000c3', 'catching', 'Quicker transfer on throws to 2B.');
select pg_temp.expect('coach note author defaults to the coach',
  (select author_id from public.coach_notes where note like 'Quicker transfer%'),
  '11111111-0000-0000-0000-000000000002'::uuid);
do $$ begin
  insert into public.staff (user_id, display_name, role)
  values ('11111111-0000-0000-0000-000000000004', 'Sneaky', 'admin');
  raise exception 'FAIL: coach could add staff';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Admin: can manage staff
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000001"}', false);
insert into public.staff (user_id, display_name, role)
values ('11111111-0000-0000-0000-000000000004', 'New Coach', 'coach');
reset role;
select pg_temp.expect('admin added staff',
  (select role::text from public.staff where user_id = '11111111-0000-0000-0000-000000000004'), 'coach');

-- private helpers are not callable by signed-out visitors
do $$ begin
  if has_function_privilege('anon', 'private.is_staff()', 'execute') then
    raise exception 'FAIL: anon can execute private.is_staff()';
  end if;
  if has_function_privilege('authenticated', 'private.apply_staff_rls(regclass)', 'execute') then
    raise exception 'FAIL: authenticated can execute private.apply_staff_rls()';
  end if;
end $$;
