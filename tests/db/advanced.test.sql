-- G3 Advanced: only admins grant access; a player keeps her own book only while
-- she has it. Own users, removed at the end. Seed: c1 Avery Lopez #7 (team b1).
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

insert into auth.users (id, email) values
  ('99999999-0000-0000-0000-000000000001', 'adv-player@example.test'),
  ('99999999-0000-0000-0000-000000000002', 'adv-coach@example.test'),
  ('99999999-0000-0000-0000-000000000003', 'adv-admin@example.test');
insert into public.staff (user_id, display_name, role) values
  ('99999999-0000-0000-0000-000000000002', 'Adv Coach', 'coach'),
  ('99999999-0000-0000-0000-000000000003', 'Adv Admin', 'admin');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select '99999999-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'Avery Lopez', '7', 'approved'
  from public.roster_entries r
 where r.player_id = '00000000-0000-0000-0000-0000000000c1' and r.team_id = '00000000-0000-0000-0000-0000000000b1';

-- Locked: she can't start a book
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('locked: no access row', (select count(*) from public.player_advanced_access), 0::bigint);
do $$ begin
  insert into public.player_advanced_chapters (player_id, chapter) values ('00000000-0000-0000-0000-0000000000c1', 'pre-game');
  raise exception 'FAIL: wrote a chapter without G3 Advanced';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.player_advanced_access (player_id) values ('00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: a player unlocked herself';
exception when insufficient_privilege then null;
end $$;
reset role;

-- A coach can't grant it; an admin can
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000002"}', false);
do $$ begin
  insert into public.player_advanced_access (player_id) values ('00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: a coach granted G3 Advanced';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000003"}', false);
insert into public.player_advanced_access (player_id) values ('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect('granted by the admin', (select granted_by::text from public.player_advanced_access), '99999999-0000-0000-0000-000000000003');
reset role;

-- Unlocked: her own book, nobody else's
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('she sees her access', (select source from public.player_advanced_access), 'admin');
insert into public.player_advanced_books (player_id) values ('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect('default title', (select title from public.player_advanced_books), 'How to Cook');
update public.player_advanced_books set title = 'Avery Cooks' where player_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.player_advanced_chapters (player_id, chapter, owned, mine, completed_at)
values ('00000000-0000-0000-0000-0000000000c1', 'pre-game', '{pre-target}', '{"Ten throws to a target before I talk to anyone"}', now());
select pg_temp.expect('her chapter saved', (select owned[1] || ' / ' || mine[1] from public.player_advanced_chapters),
  'pre-target / Ten throws to a target before I talk to anyone');
do $$ begin
  insert into public.player_advanced_chapters (player_id, chapter) values ('00000000-0000-0000-0000-0000000000c2', 'pre-game');
  raise exception 'FAIL: wrote a teammate''s chapter';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  delete from public.player_advanced_access where player_id = '00000000-0000-0000-0000-0000000000c1';
  if not exists (select 1 from public.player_advanced_access) then raise exception 'FAIL: a player removed her access row'; end if;
end $$;
reset role;

-- Confirmed positions (the Pitching chapter): coaches confirm, players only read
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000001"}', false);
do $$ begin
  insert into public.player_confirmed_positions (player_id, position) values ('00000000-0000-0000-0000-0000000000c1', 'P');
  raise exception 'FAIL: a player confirmed herself as a pitcher';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000002"}', false);
insert into public.player_confirmed_positions (player_id, position) values ('00000000-0000-0000-0000-0000000000c1', 'P');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('she sees she''s a confirmed pitcher', (select string_agg(position::text, ',') from public.player_confirmed_positions), 'P');
reset role;

-- Access removed: her book is closed again (kept, not deleted)
delete from public.player_advanced_access where player_id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('closed: she can''t read it', (select count(*) from public.player_advanced_chapters), 0::bigint);
update public.player_advanced_books set title = 'sneaky' where player_id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select pg_temp.expect('closed: title unchanged and work kept',
  (select title || ' ' || (select count(*) from public.player_advanced_chapters)::text from public.player_advanced_books), 'Avery Cooks 1');

-- Clean up
delete from public.player_confirmed_positions where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_advanced_chapters where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_advanced_books where player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.player_claims where user_id = '99999999-0000-0000-0000-000000000001';
delete from public.staff where user_id::text like '99999999-%';
delete from auth.users where id::text like '99999999-%';
