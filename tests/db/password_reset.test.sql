-- Password reset limit: 4 reset emails per address every 20 minutes (allow_password_reset).
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;

delete from private.password_reset_requests;

-- Signed out, like the forgot-password page
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('1st request allowed', public.allow_password_reset('reset-test@example.test'), true);
select pg_temp.expect('2nd request allowed', public.allow_password_reset('reset-test@example.test'), true);
select pg_temp.expect('3rd request allowed', public.allow_password_reset('reset-test@example.test'), true);
select pg_temp.expect('4th request allowed', public.allow_password_reset(' Reset-Test@Example.TEST '), true);
select pg_temp.expect('5th request in 20 minutes refused (any case/spacing)', public.allow_password_reset('reset-test@example.test'), false);
select pg_temp.expect('another address is counted on its own', public.allow_password_reset('someone-else@example.test'), true);
do $$ begin
  perform 1 from private.password_reset_requests;
  raise exception 'FAIL: signed-out visitors can read the reset log';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.expect('only fingerprints are stored, never the address',
  (select count(*) from private.password_reset_requests where email_hash like '%@%' or length(email_hash) <> 64), 0::bigint);
select pg_temp.expect('refused requests are not logged',
  (select count(*) from private.password_reset_requests), 5::bigint);

-- Requests older than 20 minutes no longer count
update private.password_reset_requests set requested_at = now() - interval '21 minutes';
set role anon;
select pg_temp.expect('allowed again after 20 minutes', public.allow_password_reset('reset-test@example.test'), true);
reset role;

-- Signed-in users have no direct access either
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-000000000002"}', false);
do $$ begin
  delete from private.password_reset_requests;
  raise exception 'FAIL: a signed-in user could clear the reset log';
exception when insufficient_privilege then null;
end $$;
reset role;

delete from private.password_reset_requests;
