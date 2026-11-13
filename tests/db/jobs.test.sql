-- The outbox and job worker (migration 20261113124214): jobs are added once per dedupe key;
-- the worker's functions refuse anyone without the jobs secret; claiming skips locked and future
-- jobs; failures back off, then die; video calls enqueue parent emails and Zoom cleanup.
-- Seed: c1 Avery on b1.
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

insert into vault.decrypted_secrets (name, decrypted_secret) values ('jobs_secret', 'jobs-test-secret-0123456789abcdefghijklmnop');
insert into auth.users (id, email, raw_user_meta_data) values
  ('e9e9e9e9-0000-0000-0000-000000000001', 'jobs-parent@example.test', '{"role": "parent"}'),
  ('e9e9e9e9-0000-0000-0000-000000000002', 'jobs-waiting@example.test', '{"role": "parent"}');
insert into public.parent_accounts (user_id, display_name) values
  ('e9e9e9e9-0000-0000-0000-000000000001', 'Jobs Parent'), ('e9e9e9e9-0000-0000-0000-000000000002', 'Jobs Waiting');
insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_at) values
  ('e9e9e9e9-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'approved', now()),
  ('e9e9e9e9-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'Avery Lopez', '00000000-0000-0000-0000-0000000000c1', 'pending', null);
delete from private.jobs;

-- Enqueueing is idempotent per dedupe key
select private.enqueue_job('test.thing', 'test.thing:1', '{"n": 1}');
select private.enqueue_job('test.thing', 'test.thing:1', '{"n": 2}');
select pg_temp.expect('one job per key', (select count(*) from private.jobs where dedupe_key = 'test.thing:1'), 1::bigint);
select pg_temp.expect('a bad kind', pg_temp.err($$select private.enqueue_job('Bad Kind', 'x')$$), '23514');

-- A video call booked, then cancelled: parent emails and the Zoom cleanup
insert into public.video_calls (id, team_id, player_id, host_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
values ('e9e9e9e9-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
        'e9e9e9e9-0000-0000-0000-000000000001', 'coach', 'Jobs Coach', 'Swing check', now() + interval '2 days', 30, '81000000901');
select pg_temp.expect('booked email queued', (select payload ->> 'event' from private.jobs where dedupe_key = 'email.video_call:booked:e9e9e9e9-0000-0000-0000-0000000000ca'), 'booked');
update public.video_calls set cancelled_at = now() where id = 'e9e9e9e9-0000-0000-0000-0000000000ca';
select pg_temp.expect('cancel email and Zoom cleanup queued',
  (select string_agg(kind, ',' order by kind) from private.jobs where dedupe_key like '%e9e9e9e9-0000-0000-0000-0000000000ca' and dedupe_key not like '%booked%'),
  'email.video_call,zoom.delete_meeting');
select pg_temp.expect('the meeting to delete', (select payload ->> 'meeting_id' from private.jobs where kind = 'zoom.delete_meeting'), '81000000901');

-- Without the secret, nothing; nobody signed in can read the jobs table
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('wrong secret', pg_temp.err($$select * from public.jobs_claim('not-the-secret-not-the-secret-not-it', 10)$$), '42501');
select pg_temp.expect('no secret', pg_temp.err($$select * from public.jobs_claim(null, 10)$$), '42501');
select pg_temp.expect('no email data without it', pg_temp.err($$select * from public.jobs_video_call_email('nope', 'e9e9e9e9-0000-0000-0000-0000000000ca')$$), '42501');
select pg_temp.expect('the table is private', pg_temp.err($$select count(*) from private.jobs$$), '42501');
reset role;

-- The worker claims due jobs once; a second worker gets none of them
set role anon;
select pg_temp.expect('claims all four', (select count(*) from public.jobs_claim('jobs-test-secret-0123456789abcdefghijklmnop', 10)), 4::bigint);
select pg_temp.expect('nothing left to claim', (select count(*) from public.jobs_claim('jobs-test-secret-0123456789abcdefghijklmnop', 10)), 0::bigint);
select pg_temp.expect('the email has her approved parent only',
  (select array_to_string(recipients, ',') || ' / ' || player_first || ' / ' || cancelled::text
     from public.jobs_video_call_email('jobs-test-secret-0123456789abcdefghijklmnop', 'e9e9e9e9-0000-0000-0000-0000000000ca')),
  'jobs-parent@example.test / Avery / true');
reset role;

-- Finish one, skip one, fail one (it backs off), and let one die (ids looked up beforehand:
-- the worker's role can't read the table)
create temp table j as select id, kind, dedupe_key from private.jobs;
grant select on j to anon;
set role anon;
select public.jobs_finish('jobs-test-secret-0123456789abcdefghijklmnop', (select id from j where dedupe_key = 'test.thing:1'));
reset role;
select pg_temp.expect('done', (select outcome from private.jobs where dedupe_key = 'test.thing:1'), 'done');
set role anon;
select public.jobs_finish('jobs-test-secret-0123456789abcdefghijklmnop', (select id from j where dedupe_key like 'email.video_call:booked:%'), 'skipped', 'email is not set up');
select pg_temp.expect('a bad outcome', pg_temp.err($$select public.jobs_finish('jobs-test-secret-0123456789abcdefghijklmnop', 1, 'dead')$$), '22023');
select public.jobs_fail('jobs-test-secret-0123456789abcdefghijklmnop', (select id from j where kind = 'zoom.delete_meeting'), 'Zoom said no');
reset role;
select pg_temp.expect('skipped with a note', (select outcome || ': ' || last_error from private.jobs where dedupe_key like 'email.video_call:booked:%'), 'skipped: email is not set up');
select pg_temp.expect('failed: waits a minute, unlocked',
  (select (run_at > now() + interval '50 seconds')::text || ' ' || (locked_at is null)::text || ' ' || coalesce(outcome, 'open') from private.jobs where kind = 'zoom.delete_meeting'),
  'true true open');
set role anon;
select pg_temp.expect('not due yet', (select count(*) from public.jobs_claim('jobs-test-secret-0123456789abcdefghijklmnop', 10)), 0::bigint);
reset role;
update private.jobs set run_at = now() - interval '1 second', max_attempts = 2 where kind = 'zoom.delete_meeting';
set role anon;
select pg_temp.expect('due again', (select attempts from public.jobs_claim('jobs-test-secret-0123456789abcdefghijklmnop', 10)), 2);
select public.jobs_fail('jobs-test-secret-0123456789abcdefghijklmnop', (select id from j where kind = 'zoom.delete_meeting'), 'Zoom said no again');
reset role;
select pg_temp.expect('dead after its last try', (select outcome from private.jobs where kind = 'zoom.delete_meeting'), 'dead');

-- A crashed worker's job comes back after 5 minutes
update private.jobs set locked_at = now() - interval '6 minutes' where dedupe_key like 'email.video_call:cancelled:%';
set role anon;
select pg_temp.expect('reclaimed', (select count(*) from public.jobs_claim('jobs-test-secret-0123456789abcdefghijklmnop', 10)), 1::bigint);
reset role;

-- Finished jobs go after 30 days
update private.jobs set done_at = now() - interval '31 days' where dedupe_key = 'test.thing:1';
select private.purge_jobs();
select pg_temp.expect('purged', (select count(*) from private.jobs where dedupe_key = 'test.thing:1'), 0::bigint);

-- Clean up
delete from private.jobs;
delete from public.notifications where player_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'video-call';
delete from public.video_calls where id = 'e9e9e9e9-0000-0000-0000-0000000000ca';
delete from public.parent_links where parent_id::text like 'e9e9e9e9-%';
delete from public.parent_accounts where user_id::text like 'e9e9e9e9-%';
delete from auth.users where id::text like 'e9e9e9e9-%';
delete from vault.decrypted_secrets where name = 'jobs_secret';
