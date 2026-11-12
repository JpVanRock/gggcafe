-- Coaches who are parents (user, 2026-11-12; migration 20261112133311): a coach claims a
-- daughter from our roster with claim_my_daughter(). A head coach's claim is approved at
-- once; an assistant's waits for the head coach; viewers can't. Seed: b1 is ours (c1 Avery,
-- c2 Jordan); b2 isn't (d1 Taylor).
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

insert into auth.users (id, email) values
  ('e4e4e4e4-0000-0000-0000-000000000001', 'cp-head@example.test'),
  ('e4e4e4e4-0000-0000-0000-000000000002', 'cp-assistant@example.test'),
  ('e4e4e4e4-0000-0000-0000-000000000003', 'cp-viewer@example.test');
insert into public.staff (user_id, display_name, role) values
  ('e4e4e4e4-0000-0000-0000-000000000001', 'CP Head', 'coach'),
  ('e4e4e4e4-0000-0000-0000-000000000002', 'CP Assistant', 'assistant'),
  ('e4e4e4e4-0000-0000-0000-000000000003', 'CP Viewer', 'viewer');

-- The head coach claims Avery: approved, with a parent profile named like their staff record
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e4e4e4e4-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('head coach''s claim', public.claim_my_daughter('00000000-0000-0000-0000-0000000000c1'), 'approved');
select pg_temp.expect('claiming again changes nothing', public.claim_my_daughter('00000000-0000-0000-0000-0000000000c1'), 'approved');
select pg_temp.expect('one link', (select count(*) from public.parent_links where parent_id = 'e4e4e4e4-0000-0000-0000-000000000001'), 1::bigint);
select pg_temp.expect('the parent side opens', (select string_agg(id::text, ',') from public.my_child_ids() id), '00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect('not a team that isn''t ours', pg_temp.err($$select public.claim_my_daughter('00000000-0000-0000-0000-0000000000d1')$$), 'P0006');
reset role;
select pg_temp.expect('parent profile', (select display_name from public.parent_accounts where user_id = 'e4e4e4e4-0000-0000-0000-000000000001'), 'CP Head');

-- An assistant's claim waits for the head coach
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e4e4e4e4-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('assistant''s claim', public.claim_my_daughter('00000000-0000-0000-0000-0000000000c2'), 'pending');
select pg_temp.expect('nothing opens yet', (select count(*) from public.my_child_ids()), 0::bigint);
reset role;
select pg_temp.expect('her name on the request', (select child_name || ' · ' || status from public.parent_links where parent_id = 'e4e4e4e4-0000-0000-0000-000000000002'), 'Jordan Kim · pending');

-- A viewer can't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e4e4e4e4-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('viewer can''t claim', pg_temp.err($$select public.claim_my_daughter('00000000-0000-0000-0000-0000000000c1')$$), '42501');
reset role;

-- Clean up
select set_config('request.jwt.claims', '', false);
delete from public.parent_links where parent_id::text like 'e4e4e4e4-%';
delete from public.parent_accounts where user_id::text like 'e4e4e4e4-%';
delete from public.staff where user_id::text like 'e4e4e4e4-%';
delete from auth.users where id::text like 'e4e4e4e4-%';
