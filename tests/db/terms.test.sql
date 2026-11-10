-- Terms of Service agreements (terms_acceptances): recorded at sign-up from the account's metadata,
-- or by the user on /terms/accept; the database stamps who and when; nobody edits or deletes them;
-- each account sees its own, admins see all.
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
grant execute on function pg_temp.err(text) to authenticated, anon;

-- Sign-up with the box checked: the trigger records it with the account's creation time
insert into auth.users (id, email, raw_user_meta_data, created_at) values
  ('7e7e7e7e-0000-0000-0000-000000000001', 'agreed@example.test', '{"role": "player", "terms_version": "2026-11-09"}', now() - interval '1 hour'),
  ('7e7e7e7e-0000-0000-0000-000000000002', 'older@example.test', '{"role": "parent"}', now()),
  ('7e7e7e7e-0000-0000-0000-000000000003', 'odd@example.test', '{"terms_version": "yes please"}', now()),
  ('7e7e7e7e-0000-0000-0000-000000000004', 'terms-admin@example.test', '{}', now());
insert into public.staff (user_id, display_name, role) values ('7e7e7e7e-0000-0000-0000-000000000004', 'Tess Admin', 'admin');

select pg_temp.expect('sign-up agreement recorded',
  (select count(*) from public.terms_acceptances where user_id = '7e7e7e7e-0000-0000-0000-000000000001' and version = '2026-11-09'), 1::bigint);
select pg_temp.expect('stamped with the sign-up time',
  (select accepted_at = u.created_at from public.terms_acceptances t join auth.users u on u.id = t.user_id where t.user_id = '7e7e7e7e-0000-0000-0000-000000000001'), true);
select pg_temp.expect('no agreement in metadata: nothing recorded',
  (select count(*) from public.terms_acceptances where user_id = '7e7e7e7e-0000-0000-0000-000000000002'), 0::bigint);
select pg_temp.expect('a made-up version is ignored (sign-up still works)',
  (select count(*) from public.terms_acceptances where user_id = '7e7e7e7e-0000-0000-0000-000000000003'), 0::bigint);

-- An account made before the Terms agrees on /terms/accept
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"7e7e7e7e-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('agrees', pg_temp.err($$insert into public.terms_acceptances (version) values ('2026-11-09') on conflict do nothing$$), '');
select pg_temp.expect('agreeing twice is harmless', pg_temp.err($$insert into public.terms_acceptances (version) values ('2026-11-09') on conflict do nothing$$), '');
select pg_temp.expect('sees only her own agreement', (select count(*) from public.terms_acceptances), 1::bigint);
select pg_temp.expect('recorded for her account', (select user_id from public.terms_acceptances), '7e7e7e7e-0000-0000-0000-000000000002'::uuid);
select pg_temp.expect('can''t record for someone else',
  pg_temp.err($$insert into public.terms_acceptances (user_id, version) values ('7e7e7e7e-0000-0000-0000-000000000003', '2026-11-09')$$), '42501');
select pg_temp.expect('can''t backdate an agreement',
  pg_temp.err($$insert into public.terms_acceptances (version, accepted_at) values ('2026-11-10', now() - interval '1 year')$$), '42501');
select pg_temp.expect('can''t change an agreement', pg_temp.err($$update public.terms_acceptances set version = '2020-01-01'$$), '42501');
select pg_temp.expect('can''t delete an agreement', pg_temp.err($$delete from public.terms_acceptances$$), '42501');
select pg_temp.expect('a version must be a date', pg_temp.err($$insert into public.terms_acceptances (version) values ('latest')$$), '23514');

-- Admins see everyone's; signed-out visitors see nothing
select set_config('request.jwt.claims', '{"sub":"7e7e7e7e-0000-0000-0000-000000000004"}', false);
select pg_temp.expect('admin sees all agreements',
  (select count(*) from public.terms_acceptances where user_id::text like '7e7e7e7e-%'), 2::bigint);
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('signed-out visitors can''t read agreements', pg_temp.err($$select 1 from public.terms_acceptances$$), '42501');
reset role;

-- Deleting an account deletes its agreements with it
delete from public.staff where user_id = '7e7e7e7e-0000-0000-0000-000000000004';
delete from auth.users where id::text like '7e7e7e7e-%';
select pg_temp.expect('agreements go with the account',
  (select count(*) from public.terms_acceptances where user_id::text like '7e7e7e7e-%'), 0::bigint);
