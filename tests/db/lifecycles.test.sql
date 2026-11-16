-- Lifecycle guards (migration 20261116030522; docs/architecture/state-machines.md): each approval
-- request moves only along its edges. A decided request can't be decided again, whoever tries.
-- Seed: b1 Sample Squad 14U, c1 Avery on it.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
create function pg_temp.err(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return '';
exception when others then
  return sqlstate;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('1fe1fe00-0000-0000-0000-000000000001', 'lc-parent@example.test', '{"role": "parent"}'),
  ('1fe1fe00-0000-0000-0000-000000000002', 'lc-player@example.test', '{"role": "player"}'),
  ('1fe1fe00-0000-0000-0000-000000000003', 'lc-coach@example.test', '{}'),
  ('1fe1fe00-0000-0000-0000-000000000004', 'lc-mentor@example.test', '{"role": "mentor"}');
insert into public.parent_accounts (user_id, display_name) values ('1fe1fe00-0000-0000-0000-000000000001', 'LC Parent');
insert into public.mentors (user_id, display_name) values ('1fe1fe00-0000-0000-0000-000000000004', 'LC Mentor');
insert into public.parent_links (id, parent_id, team_id, child_name) values
  ('1fe1fe00-0000-0000-0000-0000000000a1', '1fe1fe00-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez');
insert into public.player_claims (id, user_id, team_id, season_id, typed_name) values
  ('1fe1fe00-0000-0000-0000-0000000000a2', '1fe1fe00-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1',
   private.team_current_season('00000000-0000-0000-0000-0000000000b1'), 'Avery Lopez');
insert into public.staff_requests (user_id, display_name, role) values
  ('1fe1fe00-0000-0000-0000-000000000003', 'LC Coach', 'coach');
insert into public.mentor_links (id, mentor_id, team_id) values
  ('1fe1fe00-0000-0000-0000-0000000000a4', '1fe1fe00-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1');

-- Parent links: decided once
select pg_temp.expect('parent: approve a waiting request',
  pg_temp.err($$update public.parent_links set status = 'approved', player_id = '00000000-0000-0000-0000-0000000000c1' where id = '1fe1fe00-0000-0000-0000-0000000000a1'$$), '');
select pg_temp.expect('parent: a stale decline is refused',
  pg_temp.err($$update public.parent_links set status = 'declined' where id = '1fe1fe00-0000-0000-0000-0000000000a1'$$), 'P0010');
select pg_temp.expect('parent: still approved', (select status::text from public.parent_links where id = '1fe1fe00-0000-0000-0000-0000000000a1'), 'approved');
select pg_temp.expect('parent: other columns still change',
  pg_temp.err($$update public.parent_links set child_name = 'Avery L.' where id = '1fe1fe00-0000-0000-0000-0000000000a1'$$), '');

-- Player claims: decline, ask again, approve; consent withdrawal may decline an approved claim
select pg_temp.expect('claim: decline', pg_temp.err($$update public.player_claims set status = 'declined' where id = '1fe1fe00-0000-0000-0000-0000000000a2'$$), '');
select pg_temp.expect('claim: declined can''t jump to approved',
  pg_temp.err($$update public.player_claims set status = 'approved' where id = '1fe1fe00-0000-0000-0000-0000000000a2'$$), 'P0010');
select pg_temp.expect('claim: she asks again', pg_temp.err($$update public.player_claims set status = 'pending' where id = '1fe1fe00-0000-0000-0000-0000000000a2'$$), '');
select pg_temp.expect('claim: approve', pg_temp.err($$update public.player_claims set status = 'approved',
  roster_entry_id = (select r.id from public.roster_entries r where r.team_id = '00000000-0000-0000-0000-0000000000b1' and r.player_id = '00000000-0000-0000-0000-0000000000c1' and r.active limit 1)
  where id = '1fe1fe00-0000-0000-0000-0000000000a2'$$), '');
select pg_temp.expect('claim: approved can''t go back to waiting',
  pg_temp.err($$update public.player_claims set status = 'pending' where id = '1fe1fe00-0000-0000-0000-0000000000a2'$$), 'P0010');
select pg_temp.expect('claim: approved can be declined (consent withdrawn)',
  pg_temp.err($$update public.player_claims set status = 'declined' where id = '1fe1fe00-0000-0000-0000-0000000000a2'$$), '');

-- Coach sign-ups and mentor links: decided once
select pg_temp.expect('staff: approve', pg_temp.err($$update public.staff_requests set status = 'approved' where user_id = '1fe1fe00-0000-0000-0000-000000000003'$$), '');
select pg_temp.expect('staff: no second decision',
  pg_temp.err($$update public.staff_requests set status = 'declined' where user_id = '1fe1fe00-0000-0000-0000-000000000003'$$), 'P0010');
select pg_temp.expect('mentor: decline', pg_temp.err($$update public.mentor_links set status = 'declined' where id = '1fe1fe00-0000-0000-0000-0000000000a4'$$), '');
select pg_temp.expect('mentor: no second decision',
  pg_temp.err($$update public.mentor_links set status = 'approved' where id = '1fe1fe00-0000-0000-0000-0000000000a4'$$), 'P0010');

-- Every approval table has its guard, with the edges src/lib/lifecycles.ts declares
-- (tests/unit/lifecycles.test.ts compares the two lists).
select pg_temp.expect('five lifecycle guards',
  (select string_agg(c.relname, ',' order by c.relname)
     from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
    where p.proname = 'guard_transition' and not t.tgisinternal),
  'mentor_links,parent_links,parental_consents,player_claims,staff_requests');

-- clean up
delete from public.parent_links where id = '1fe1fe00-0000-0000-0000-0000000000a1';
delete from public.player_claims where id = '1fe1fe00-0000-0000-0000-0000000000a2';
delete from public.staff_requests where user_id = '1fe1fe00-0000-0000-0000-000000000003';
delete from public.mentor_links where id = '1fe1fe00-0000-0000-0000-0000000000a4';
delete from auth.users where id::text like '1fe1fe00-%';
