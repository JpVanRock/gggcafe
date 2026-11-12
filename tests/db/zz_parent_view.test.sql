-- Parents "View as player" (user, 2026-11-12; migration 20261112012728): an approved parent reads
-- what her daughter reads, and only that, and can't write any of it. Also a rule for the future:
-- every SELECT rule a player reads by needs a "(parent view)" twin. Own users, removed at the end.
-- Seed: team b1 = c1 Avery, c2 Jordan Kim, c3 Riley, c4 Morgan (season a1).
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

-- Every player SELECT rule has its parent twin (a new feature's rule needs one too: add it in its migration)
do $$
declare
  v_missing text;
begin
  select string_agg(p.schemaname || '.' || p.tablename || ': ' || p.policyname, '; ') into v_missing
    from pg_policies p
   where p.cmd in ('SELECT', 'ALL') and p.qual is not null
     and (p.qual like '%my_player_ids()%' or p.qual like '%my_current_team_ids()%' or p.qual like '%has_player_access()%')
     and not exists (select 1 from pg_policies t
                      where t.schemaname = p.schemaname and t.tablename = p.tablename
                        and t.policyname = left(p.policyname, 48) || ' (parent view)');
  if v_missing is not null then
    raise exception 'FAIL: player rules with no parent view twin: %', v_missing;
  end if;
  -- the twins only read
  if exists (select 1 from pg_policies where policyname like '%(parent view)' and cmd <> 'SELECT') then
    raise exception 'FAIL: a parent view rule allows more than reading';
  end if;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('acac0000-0000-0000-0000-000000000001', 'pv-parent@example.test', '{"role": "parent"}'),
  ('acac0000-0000-0000-0000-000000000002', 'pv-other@example.test', '{"role": "parent"}');
insert into public.parent_accounts (user_id, display_name) values
  ('acac0000-0000-0000-0000-000000000001', 'Pat Parent'),
  ('acac0000-0000-0000-0000-000000000002', 'Ola Other');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('acac0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now()),
  ('acac0000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'Riley', '00000000-0000-0000-0000-0000000000c3', 'pending', null);
insert into public.development_goals (player_id, area, title) values ('00000000-0000-0000-0000-0000000000c1', 'hitting', 'PV: hit .400');

-- The approved parent reads her daughter, as her daughter would
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"acac0000-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('her daughter is the one she can view', (select string_agg(id::text, ',') from public.my_child_ids() id), '00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect('she reads her daughter''s profile', (select count(*) from public.players where id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint);
select pg_temp.expect('she reads her daughter''s goals', (select count(*) from public.development_goals where title = 'PV: hit .400'), 1::bigint);
select pg_temp.expect('she sees her daughter''s team', (select count(*) from public.teams where id = '00000000-0000-0000-0000-0000000000b1'), 1::bigint);
select pg_temp.expect('not another player''s profile', (select count(*) from public.players where id = '00000000-0000-0000-0000-0000000000c3'), 0::bigint);
select pg_temp.expect('she can''t add a goal for her', pg_temp.err($$insert into public.development_goals (player_id, area, title) values ('00000000-0000-0000-0000-0000000000c1', 'hitting', 'PV: nope')$$), '42501');
select pg_temp.expect('she can''t change one', pg_temp.err($$update public.development_goals set title = 'PV: changed' where title = 'PV: hit .400'$$) ||
  (select count(*) from public.development_goals where title = 'PV: changed')::text, '0');
select pg_temp.expect('her daughter''s quizzes list opens', pg_temp.err($$select * from public.team_quizzes_for('00000000-0000-0000-0000-0000000000c1')$$), '');
select pg_temp.expect('not another player''s quizzes', pg_temp.err($$select * from public.team_quizzes_for('00000000-0000-0000-0000-0000000000c3')$$), '42501');
reset role;

-- A parent whose request is still waiting sees nothing
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"acac0000-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('a waiting parent views no one', (select count(*) from public.my_child_ids()), 0::bigint);
select pg_temp.expect('and reads no player', (select count(*) from public.players), 0::bigint);
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.development_goals where title like 'PV:%';
delete from public.parent_links where parent_id::text like 'acac0000-%';
delete from public.parent_accounts where user_id::text like 'acac0000-%';
delete from auth.users where id::text like 'acac0000-%';
