-- Error tracking (migration 20261113131948): the server reports with the server secret; errors are
-- grouped and counted; a resolved group opens again when it happens again; only admins read and
-- resolve; at most 200 new groups an hour; old groups are purged.
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
grant execute on function pg_temp.err(text) to anon, authenticated;

insert into vault.decrypted_secrets (name, decrypted_secret) values ('jobs_secret', 'errors-test-secret-0123456789abcdefghijklmn');
insert into auth.users (id, email) values
  ('eaeaeaea-0000-0000-0000-000000000001', 'err-admin@example.test'),
  ('eaeaeaea-0000-0000-0000-000000000002', 'err-coach@example.test');
insert into public.staff (user_id, display_name, role) values
  ('eaeaeaea-0000-0000-0000-000000000001', 'Err Admin', 'admin'),
  ('eaeaeaea-0000-0000-0000-000000000002', 'Err Coach', 'coach');
delete from private.error_groups;

-- The server reports (signed out, with the secret); without it, nothing
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('no secret', pg_temp.err($$select public.report_error('nope-nope-nope-nope-nope-nope-nope-nope', '0123456789abcdef', 'server', 'TypeError', 'x')$$), '42501');
select public.report_error('errors-test-secret-0123456789abcdefghijklmn', '0123456789abcdef', 'server', 'TypeError', 'Cannot read properties of null', '/players/[id]', 'd1');
select public.report_error('errors-test-secret-0123456789abcdefghijklmn', '0123456789abcdef', 'server', 'TypeError', 'Cannot read properties of null', '/players/[id]', 'd2');
select pg_temp.expect('bad fingerprint', pg_temp.err($$select public.report_error('errors-test-secret-0123456789abcdefghijklmn', 'NOT-HEX', 'server', 'E', 'x')$$), '23514');
select pg_temp.expect('bad source', pg_temp.err($$select public.report_error('errors-test-secret-0123456789abcdefghijklmn', 'aaaaaaaaaaaaaaaa', 'space', 'E', 'x')$$), '23514');
select pg_temp.expect('the table is private', pg_temp.err($$select count(*) from private.error_groups$$), '42501');
reset role;
select pg_temp.expect('grouped and counted', (select count || ' ' || digest from private.error_groups where fingerprint = '0123456789abcdef'), '2 d2');

-- Admins read and resolve; a head coach can't
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"eaeaeaea-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('a head coach can''t read them', pg_temp.err($$select * from public.error_summary(7)$$), '42501');
select pg_temp.expect('or resolve them', pg_temp.err($$select public.resolve_error('0123456789abcdef')$$), '42501');
select pg_temp.expect('or see the jobs', pg_temp.err($$select * from public.jobs_summary()$$), '42501');
select set_config('request.jwt.claims', '{"sub":"eaeaeaea-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('the admin reads it', (select name || ': ' || message || ' x' || count from public.error_summary(7)), 'TypeError: Cannot read properties of null x2');
select public.resolve_error('0123456789abcdef');
select pg_temp.expect('resolved', (select resolved_at is not null from public.error_summary(7)), true);
select pg_temp.expect('the admin sees the jobs summary', pg_temp.err($$select * from public.jobs_summary()$$), '');
reset role;

-- It happens again: open again
set role anon;
select public.report_error('errors-test-secret-0123456789abcdefghijklmn', '0123456789abcdef', 'server', 'TypeError', 'Cannot read properties of null', '/players/[id]');
reset role;
select pg_temp.expect('open again', (select (resolved_at is null)::text || ' ' || count from private.error_groups where fingerprint = '0123456789abcdef'), 'true 3');

-- A flood of different errors: 200 new groups an hour, then they're dropped
do $$
begin
  for i in 1..205 loop
    perform private.report_error('errors-test-secret-0123456789abcdefghijklmn', lpad(to_hex(i), 16, 'f'), 'browser', 'Error', 'flood ' || i);
  end loop;
end $$;
select pg_temp.expect('capped at 200 new an hour', (select count(*) from private.error_groups where first_seen > now() - interval '1 hour'), 200::bigint);

-- Old groups go
update private.error_groups set last_seen = now() - interval '31 days' where fingerprint = '0123456789abcdef';
select private.purge_errors();
select pg_temp.expect('purged', (select count(*) from private.error_groups where fingerprint = '0123456789abcdef'), 0::bigint);

-- Clean up
delete from private.error_groups;
delete from public.staff where user_id::text like 'eaeaeaea-%';
delete from auth.users where id::text like 'eaeaeaea-%';
delete from vault.decrypted_secrets where name = 'jobs_secret';
