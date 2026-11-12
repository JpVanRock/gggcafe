-- Admins see what a parent or a mentor sees (user, 2026-11-12): only admins, read only, and the
-- answer is what that person's own access rules allow. Own users, removed at the end.
-- Seed: team b1 = c1 Avery, c2 Jordan Kim, c3 Riley, c4 Morgan.
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
  ('abab0000-0000-0000-0000-000000000001', 'va-admin@example.test', '{}'),
  ('abab0000-0000-0000-0000-000000000002', 'va-coach@example.test', '{}'),
  ('abab0000-0000-0000-0000-000000000003', 'va-parent@example.test', '{"role": "parent", "display_name": "Val Parent"}'),
  ('abab0000-0000-0000-0000-000000000004', 'va-mentor@example.test', '{"role": "mentor", "display_name": "Max Mentor"}');
insert into public.staff (user_id, display_name, role) values
  ('abab0000-0000-0000-0000-000000000001', 'VA Admin', 'admin'),
  ('abab0000-0000-0000-0000-000000000002', 'VA Coach', 'coach');
insert into public.parent_accounts (user_id, display_name) values ('abab0000-0000-0000-0000-000000000003', 'Val Parent');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('abab0000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now());
insert into public.mentors (user_id, display_name, specialty) values ('abab0000-0000-0000-0000-000000000004', 'Max Mentor', 'Hitting');
insert into public.mentor_links (mentor_id, team_id, player_id, status) values
  ('abab0000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', 'approved');

-- Only admins
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('a coach can''t view as a parent',
  pg_temp.err($$select public.admin_view_parent('abab0000-0000-0000-0000-000000000003')$$), '42501');
select pg_temp.expect('a coach can''t view as a mentor',
  pg_temp.err($$select public.admin_view_mentor('abab0000-0000-0000-0000-000000000004')$$), '42501');
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('a parent can''t view as a mentor',
  pg_temp.err($$select public.admin_view_mentor('abab0000-0000-0000-0000-000000000004')$$), '42501');
select pg_temp.expect('a parent can''t read account details',
  pg_temp.err($$select public.admin_account('abab0000-0000-0000-0000-000000000004')$$), '42501');
reset role;

-- An admin sees the parent's page as the parent does
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-000000000001"}', false);
create temp table parent_view as select public.admin_view_parent('abab0000-0000-0000-0000-000000000003') as v;
select pg_temp.expect('the parent''s account', (select v -> 'account' ->> 'email' from parent_view), 'va-parent@example.test');
select pg_temp.expect('the parent''s team link', (select v -> 'links' -> 0 ->> 'status' from parent_view), 'approved');
select pg_temp.expect('the parent''s daughter', (select v -> 'daughters' -> 0 ->> 'player_name' from parent_view), 'Avery Lopez');
select pg_temp.expect('the parent''s team budget', (select jsonb_array_length(v -> 'budgets') from parent_view), 1);
select pg_temp.expect('back to the admin afterwards', auth.uid(), 'abab0000-0000-0000-0000-000000000001'::uuid);
-- ...and the mentor's page as the mentor does: only her player
create temp table mentor_view as select public.admin_view_mentor('abab0000-0000-0000-0000-000000000004') as v;
select pg_temp.expect('the mentor''s players: only hers',
  (select string_agg(p ->> 'name', ',') from mentor_view, jsonb_array_elements(v -> 'players') p), 'Jordan Kim');
select pg_temp.expect('the mentor''s link', (select v -> 'links' -> 0 ->> 'status' from mentor_view), 'approved');
select pg_temp.expect('the mentor''s profile', (select v -> 'mentor' ->> 'specialty' from mentor_view), 'Hitting');
select pg_temp.expect('an unknown account', pg_temp.err($$select public.admin_view_parent('abab0000-0000-0000-0000-0000000000ff')$$), 'P0002');
reset role;

-- Clean up
drop table parent_view;
drop table mentor_view;
select set_config('request.jwt.claims', '', false);
delete from public.mentor_links where mentor_id = 'abab0000-0000-0000-0000-000000000004';
delete from public.mentors where user_id = 'abab0000-0000-0000-0000-000000000004';
delete from public.parent_links where parent_id = 'abab0000-0000-0000-0000-000000000003';
delete from public.parent_accounts where user_id = 'abab0000-0000-0000-0000-000000000003';
delete from public.staff where user_id::text like 'abab0000-%';
delete from auth.users where id::text like 'abab0000-%';
