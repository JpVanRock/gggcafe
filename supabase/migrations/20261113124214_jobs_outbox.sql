-- Outbox and job worker (user, 2026-11-13; docs/architecture/jobs.md; Phase 1 of the architecture
-- review). Work that shouldn't run inside a request goes into private.jobs, in the same transaction
-- as the change that causes it. The worker (src/app/api/jobs/route.ts) claims due jobs, runs them,
-- and records success, a skip, or the error with a retry time (exponential backoff, then "dead").
--
-- Who runs the worker: pg_cron checks every minute, and every new job kicks it at once, by calling
-- the worker's address with pg_net. No user session is involved, so the worker proves itself with
-- one shared secret: Supabase Vault holds it (name 'jobs_secret', with the address as
-- 'jobs_worker_url') and Vercel holds the same value as JOBS_SECRET. The job functions below are
-- callable without signing in but do nothing without that secret. Until both are set, jobs wait.
--
-- First jobs: email parents when a video call is booked or cancelled; delete a cancelled call's
-- Zoom meeting (with retries, instead of a best-effort call inside the request).

create table private.jobs (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind ~ '^[a-z]+(\.[a-z_]+)+$'),
  dedupe_key   text not null unique check (char_length(dedupe_key) <= 200),
  payload      jsonb not null default '{}',
  run_at       timestamptz not null default now(),
  attempts     integer not null default 0,
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  locked_at    timestamptz,
  done_at      timestamptz,
  outcome      text check (outcome in ('done', 'skipped', 'dead')),
  last_error   text check (char_length(last_error) <= 2000),
  created_at   timestamptz not null default now(),
  check ((done_at is null) = (outcome is null))
);
create index jobs_due on private.jobs (run_at) where done_at is null;
create index jobs_done on private.jobs (done_at) where done_at is not null;
revoke all on private.jobs from public, anon, authenticated;
comment on table private.jobs is 'The outbox: work for the job worker. A row per job; dedupe_key makes enqueueing idempotent.';

-- Add a job (from triggers and definer functions). The same dedupe_key twice is one job.
create function private.enqueue_job(p_kind text, p_dedupe_key text, p_payload jsonb default '{}', p_run_at timestamptz default now())
returns void
language sql volatile security definer set search_path = '' as $$
  insert into private.jobs (kind, dedupe_key, payload, run_at)
  values (p_kind, p_dedupe_key, coalesce(p_payload, '{}'), coalesce(p_run_at, now()))
  on conflict (dedupe_key) do nothing
$$;
revoke all on function private.enqueue_job(text, text, jsonb, timestamptz) from public;

-- The worker's secret, from Supabase Vault (read dynamically: the local test database stubs it).
create function private.jobs_vault(p_name text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 order by created_at desc limit 1' into v using p_name;
  return v;
end $$;
revoke all on function private.jobs_vault(text) from public;

create function private.jobs_check(p_secret text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text := private.jobs_vault('jobs_secret');
begin
  if v_secret is null or char_length(v_secret) < 32 or p_secret is null
     or sha256(convert_to(p_secret, 'UTF8')) <> sha256(convert_to(v_secret, 'UTF8')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;
revoke all on function private.jobs_check(text) from public;

-- Claim up to p_limit due jobs (several workers never get the same one); a job a crashed worker
-- held for 5 minutes is due again.
create function private.jobs_claim(p_secret text, p_limit integer default 10)
returns table (id bigint, kind text, payload jsonb, attempts integer)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.jobs_check(p_secret);
  return query
    with claimed as (
      update private.jobs j set locked_at = now(), attempts = j.attempts + 1
       where j.id in (select q.id from private.jobs q
                       where q.done_at is null and q.run_at <= now()
                         and (q.locked_at is null or q.locked_at < now() - interval '5 minutes')
                       order by q.run_at
                       limit least(greatest(coalesce(p_limit, 10), 1), 50)
                       for update skip locked)
      returning j.id, j.kind, j.payload, j.attempts
    )
    select claimed.id, claimed.kind, claimed.payload, claimed.attempts from claimed;
end $$;
select private.expose('private.jobs_claim(text, integer)', array['anon']);

-- Done ('done', or 'skipped' with a note, e.g. email isn't set up).
create function private.jobs_finish(p_secret text, p_id bigint, p_outcome text default 'done', p_note text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.jobs_check(p_secret);
  if p_outcome not in ('done', 'skipped') then
    raise exception 'bad outcome' using errcode = '22023';
  end if;
  update private.jobs set done_at = now(), outcome = p_outcome, locked_at = null, last_error = left(p_note, 2000)
   where id = p_id and done_at is null;
end $$;
select private.expose('private.jobs_finish(text, bigint, text, text)', array['anon']);

-- Failed: try again after 1, 2, 4 ... minutes (at most 6 hours), until max_attempts, then dead.
create function private.jobs_fail(p_secret text, p_id bigint, p_error text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.jobs_check(p_secret);
  update private.jobs
     set locked_at = null,
         last_error = left(coalesce(p_error, 'failed'), 2000),
         done_at = case when attempts >= max_attempts then now() end,
         outcome = case when attempts >= max_attempts then 'dead' end,
         run_at = case when attempts >= max_attempts then run_at
                       else now() + least(interval '1 minute' * power(2, greatest(attempts - 1, 0)), interval '6 hours') end
   where id = p_id and done_at is null;
end $$;
select private.expose('private.jobs_fail(text, bigint, text)', array['anon']);

-- What the video-call email needs: her approved parents' addresses and the call.
create function private.jobs_video_call_email(p_secret text, p_call_id uuid)
returns table (recipients text[], player_first text, host_name text, host_kind text, topic text,
               starts_at timestamptz, minutes smallint, cancelled boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.jobs_check(p_secret);
  return query
    select coalesce((select array_agg(distinct u.email order by u.email)
                       from public.parent_links l join auth.users u on u.id = l.parent_id
                      where l.player_id = c.player_id and l.status = 'approved' and u.email is not null), '{}'),
           coalesce(nullif(btrim(p.preferred_name), ''), p.first_name),
           c.host_name, c.host_kind, c.topic, c.starts_at, c.minutes, c.cancelled_at is not null
      from public.video_calls c join public.players p on p.id = c.player_id
     where c.id = p_call_id;
end $$;
select private.expose('private.jobs_video_call_email(text, uuid)', array['anon']);

-- Kick the worker when jobs are due (pg_net: the call goes out after the transaction commits).
create function private.kick_jobs_worker() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
begin
  if to_regnamespace('net') is null
     or not exists (select 1 from private.jobs
                     where done_at is null and run_at <= now()
                       and (locked_at is null or locked_at < now() - interval '5 minutes')) then
    return;
  end if;
  v_url := private.jobs_vault('jobs_worker_url');
  v_secret := private.jobs_vault('jobs_secret');
  if v_url is null or v_secret is null or v_url !~ '^https://' then
    return;
  end if;
  execute 'select net.http_get(url := $1, headers := $2, timeout_milliseconds := 30000)'
    using v_url, jsonb_build_object('Authorization', 'Bearer ' || v_secret);
end $$;
revoke all on function private.kick_jobs_worker() from public;

create function private.kick_jobs_after_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.kick_jobs_worker();
  return null;
end $$;
revoke all on function private.kick_jobs_after_enqueue() from public;
create trigger kick_worker after insert on private.jobs
  for each statement execute function private.kick_jobs_after_enqueue();

-- Finished jobs stay 30 days (for looking into problems), then go.
create function private.purge_jobs() returns void
language sql security definer set search_path = '' as $$
  delete from private.jobs where done_at < now() - interval '30 days'
$$;
revoke all on function private.purge_jobs() from public;

-- Video calls: email her parents when one is booked or cancelled; delete a cancelled call's Zoom meeting.
create function private.enqueue_video_call_jobs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.enqueue_job('email.video_call', 'email.video_call:booked:' || new.id, jsonb_build_object('call_id', new.id, 'event', 'booked'));
  elsif new.cancelled_at is not null and old.cancelled_at is null then
    perform private.enqueue_job('email.video_call', 'email.video_call:cancelled:' || new.id, jsonb_build_object('call_id', new.id, 'event', 'cancelled'));
    perform private.enqueue_job('zoom.delete_meeting', 'zoom.delete_meeting:' || new.id, jsonb_build_object('call_id', new.id, 'meeting_id', new.zoom_meeting_id));
  end if;
  return null;
end $$;
revoke all on function private.enqueue_video_call_jobs() from public;
create trigger enqueue_jobs after insert or update of cancelled_at on public.video_calls
  for each row execute function private.enqueue_video_call_jobs();

-- On Supabase: pg_net for the calls, pg_cron every minute (and a daily purge). The local test
-- database has neither and skips this.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('kick-jobs-worker', '* * * * *', 'select private.kick_jobs_worker()');
    perform cron.schedule('purge-jobs', '41 4 * * *', 'select private.purge_jobs()');
  end if;
end $$;
