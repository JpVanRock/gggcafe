-- Rate limits (migration 20261113041701): fixed-window counters per user and bucket; the public
-- check for server actions, and triggers on busy write tables. Seed: c1 Avery on b1.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('e8e8e8e8-0000-0000-0000-000000000001', 'rl-avery@example.test', '{"role": "player"}'),
  ('e8e8e8e8-0000-0000-0000-000000000002', 'rl-other@example.test', '{}');
insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status)
select 'e8e8e8e8-0000-0000-0000-000000000001', r.team_id, r.season_id, r.id, 'x', r.jersey_number, 'approved'
  from public.roster_entries r where r.player_id = '00000000-0000-0000-0000-0000000000c1';

-- The check server actions use: three in the window, then no; another user has their own count
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e8e8e8e8-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('1st', public.rate_limit_hit('test.bucket', 3, 3600), true);
select pg_temp.expect('2nd', public.rate_limit_hit('test.bucket', 3, 3600), true);
select pg_temp.expect('3rd', public.rate_limit_hit('test.bucket', 3, 3600), true);
select pg_temp.expect('4th is over', public.rate_limit_hit('test.bucket', 3, 3600), false);
select pg_temp.expect('another bucket is separate', public.rate_limit_hit('test.other', 3, 3600), true);
select pg_temp.expect('a bad bucket name', pg_temp.err($$select public.rate_limit_hit('Bad Bucket!', 3, 3600)$$), '22023');
select pg_temp.expect('a bad window', pg_temp.err($$select public.rate_limit_hit('test.bucket', 3, 5)$$), '22023');
select pg_temp.expect('counters are private', pg_temp.err($$select count(*) from private.rate_limit_hits$$), '42501');
select set_config('request.jwt.claims', '{"sub":"e8e8e8e8-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('another user counts alone', public.rate_limit_hit('test.bucket', 3, 3600), true);
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect('signed-out visitors can''t call it', pg_temp.err($$select public.rate_limit_hit('test.bucket', 3, 3600)$$), '42501');
reset role;

-- The journal trigger: 30 entries an hour, then P0009
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e8e8e8e8-0000-0000-0000-000000000001"}', false);
do $$
begin
  for i in 1..30 loop
    insert into public.player_journal_entries (player_id, session_date, notes)
    values ('00000000-0000-0000-0000-0000000000c1', current_date, 'RL entry ' || i);
  end loop;
end $$;
select pg_temp.expect('the 31st is refused', pg_temp.err($$insert into public.player_journal_entries (player_id, session_date, notes)
  values ('00000000-0000-0000-0000-0000000000c1', current_date, 'RL entry 31')$$), 'P0009');
select pg_temp.expect('30 saved', (select count(*) from public.player_journal_entries where notes like 'RL entry %'), 30::bigint);
reset role;

-- Video call bookings: 4 an hour per person (migration 20261113130143), then P0009
insert into auth.users (id, email) values ('e8e8e8e8-0000-0000-0000-000000000003', 'rl-head@example.test');
insert into public.staff (user_id, display_name, role) values ('e8e8e8e8-0000-0000-0000-000000000003', 'RL Head', 'coach');
insert into public.team_video_access (team_id) values ('00000000-0000-0000-0000-0000000000b1') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e8e8e8e8-0000-0000-0000-000000000003"}', false);
do $$
begin
  for i in 1..4 loop
    insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'RL Head', 'RL call ' || i,
            now() + make_interval(days => i), 30, '8200000000' || i);
  end loop;
end $$;
select pg_temp.expect('the 5th booking in an hour is refused', pg_temp.err($$insert into public.video_calls (team_id, player_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'coach', 'RL Head', 'RL call 5', now() + interval '5 days', 30, '82000000005')$$), 'P0009');
reset role;
select pg_temp.expect('4 booked', (select count(*) from public.video_calls where topic like 'RL call %'), 4::bigint);

-- Writes with no signed-in user (jobs, the owner) aren't limited
select set_config('request.jwt.claims', '', false);
insert into public.player_journal_entries (player_id, session_date, notes) values ('00000000-0000-0000-0000-0000000000c1', current_date, 'RL entry owner');
select pg_temp.expect('owner write', (select count(*) from public.player_journal_entries where notes = 'RL entry owner'), 1::bigint);

-- Purging keeps today's counters
select private.purge_rate_limits();
select pg_temp.expect('recent counters stay', (select count(*) > 0 from private.rate_limit_hits where user_id::text like 'e8e8e8e8-%'), true);

-- Clean up
delete from private.jobs where payload ->> 'call_id' in (select id::text from public.video_calls where topic like 'RL call %');
delete from public.notifications where kind = 'video-call' and player_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.video_calls where topic like 'RL call %';
delete from public.team_video_access where team_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.staff where user_id::text like 'e8e8e8e8-%';
delete from public.player_journal_entries where notes like 'RL entry%';
delete from private.rate_limit_hits where user_id::text like 'e8e8e8e8-%';
delete from public.player_claims where user_id::text like 'e8e8e8e8-%';
delete from auth.users where id::text like 'e8e8e8e8-%';
