-- The log drain (migration 20261114214843): the server writes log lines with the server secret; malformed
-- lines are left out; at most 50 a call; only admins read them, by level and search, newest first;
-- lines older than 30 days are purged; the admins' addresses for error alerts.
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

insert into vault.decrypted_secrets (name, decrypted_secret) values ('jobs_secret', 'drain-test-secret-0123456789abcdefghijklmn');
insert into auth.users (id, email) values
  ('ebebebeb-0000-0000-0000-000000000001', 'drain-admin@example.test'),
  ('ebebebeb-0000-0000-0000-000000000002', 'drain-coach@example.test');
insert into public.staff (user_id, display_name, role) values
  ('ebebebeb-0000-0000-0000-000000000001', 'Drain Admin', 'admin'),
  ('ebebebeb-0000-0000-0000-000000000002', 'Drain Coach', 'coach');
delete from private.log_events;

-- The server writes, signed out, with the secret; without it, nothing
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('no secret', pg_temp.err($$select public.drain_logs('nope-nope-nope-nope-nope-nope-nope-nope', '[]')$$), '42501');
select pg_temp.expect('three good lines of five', public.drain_logs('drain-test-secret-0123456789abcdefghijklmn', $j$[
  {"level": "error", "event": "error", "route": "/players/[id]", "message": "Cannot read properties of null", "fields": {"source": "server"}},
  {"level": "info", "event": "jobs.run", "fields": {"claimed": 2, "done": 2}},
  {"level": "warn", "event": "zoom.error", "message": "Zoom said no: rate limit", "fields": "not an object"},
  {"level": "debug", "event": "nope"},
  {"level": "info", "event": "   "}
]$j$::jsonb), 3);
select pg_temp.expect('not an array', public.drain_logs('drain-test-secret-0123456789abcdefghijklmn', '{"level": "info"}'), 0);
select pg_temp.expect('at most 50 a call', public.drain_logs('drain-test-secret-0123456789abcdefghijklmn',
  (select jsonb_agg(jsonb_build_object('level', 'info', 'event', 'test.bulk')) from generate_series(1, 60))), 50);
select pg_temp.expect('the table is private', pg_temp.err($$select count(*) from private.log_events$$), '42501');
select pg_temp.expect('anon can''t read', pg_temp.err($$select * from public.admin_logs()$$), '42501');
reset role;
select pg_temp.expect('a bad fields value is stored empty', (select fields from private.log_events where event = 'zoom.error'), '{}'::jsonb);

-- Only admins read them
select set_config('test.first_log', (select min(id)::text from private.log_events), false);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ebebebeb-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('a coach can''t read', pg_temp.err($$select * from public.admin_logs()$$), '42501');
select set_config('request.jwt.claims', '{"sub":"ebebebeb-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('newest first, 100 at a time', (select count(*) from public.admin_logs()), 53::bigint);
select pg_temp.expect('errors only', (select count(*) from public.admin_logs('error')), 1::bigint);
select pg_temp.expect('warnings include errors', (select count(*) from public.admin_logs('warn')), 2::bigint);
select pg_temp.expect('search the message', (select event from public.admin_logs(null, 'rate limit')), 'zoom.error');
select pg_temp.expect('search the page', (select count(*) from public.admin_logs(null, '/players/')), 1::bigint);
select pg_temp.expect('a % is just a character', (select count(*) from public.admin_logs(null, '%')), 0::bigint);
select pg_temp.expect('page back', (select count(*) from public.admin_logs(null, null, current_setting('test.first_log')::bigint + 2)), 2::bigint);
reset role;

-- Lines older than 30 days go
update private.log_events set at = now() - interval '31 days' where event = 'jobs.run';
select private.purge_logs();
select pg_temp.expect('purged', (select count(*) from private.log_events where event = 'jobs.run'), 0::bigint);

-- The admins' addresses for an error alert (the server secret again)
insert into private.error_groups (fingerprint, source, name, message) values ('fedcba9876543210', 'server', 'TypeError', 'x');
set role anon;
select pg_temp.expect('alert needs the secret', pg_temp.err($$select * from public.jobs_error_alert('nope-nope-nope-nope-nope-nope-nope-nope', 'fedcba9876543210')$$), '42501');
select pg_temp.expect('admins only', (select 'drain-admin@example.test' = any (recipients) and not 'drain-coach@example.test' = any (recipients)
  from public.jobs_error_alert('drain-test-secret-0123456789abcdefghijklmn', 'fedcba9876543210')), true);
reset role;

-- Clean up
delete from private.log_events;
delete from private.error_groups where fingerprint = 'fedcba9876543210';
delete from public.staff where user_id::text like 'ebebebeb-%';
delete from auth.users where id::text like 'ebebebeb-%';
delete from vault.decrypted_secrets where name = 'jobs_secret';
