-- Rate limits (user, 2026-11-12; the architecture review in docs/architecture/scaling.md, Phase 1).
-- Fixed-window counters per signed-in user and bucket, kept in the private schema (not exposed by
-- the API). Two ways in:
--   * public.rate_limit_hit(bucket, max, window_seconds): server actions ask before something
--     costly that the database can't see (calls to Zoom). True = go ahead (and it's counted).
--   * private.enforce_rate_limit(bucket, max, window_seconds): triggers on busy write tables, so the
--     limit holds even for writes that skip the site and go straight to the database API with the
--     user's own token. Raises P0009 when the limit is reached (friendlyDbError explains it).
-- Counters older than a day are deleted hourly (pg_cron, where it exists).

create table private.rate_limit_hits (
  user_id      uuid not null,
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (user_id, bucket, window_start)
);
create index rate_limit_hits_window on private.rate_limit_hits (window_start);
revoke all on private.rate_limit_hits from public, anon, authenticated;

-- Count one hit for the caller in this bucket's current window; true while within the limit.
create function private.rate_limit_take(p_bucket text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_me    uuid := (select auth.uid());
  v_start timestamptz;
  v_hits  integer;
begin
  if v_me is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(p_bucket, '') !~ '^[a-z][a-z_.]{1,39}$' or p_max is null or p_max < 1
     or p_window_seconds is null or p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'bad rate limit' using errcode = '22023';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limit_hits as h (user_id, bucket, window_start, hits)
  values (v_me, p_bucket, v_start, 1)
  on conflict (user_id, bucket, window_start) do update set hits = h.hits + 1
  returning h.hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke all on function private.rate_limit_take(text, integer, integer) from public;

-- For server actions: the public wrapper (signed-in users only; it only ever counts the caller).
create function private.rate_limit_hit(p_bucket text, p_max integer, p_window_seconds integer) returns boolean
language sql volatile security definer set search_path = '' as $$
  select private.rate_limit_take(p_bucket, p_max, p_window_seconds)
$$;
select private.expose('private.rate_limit_hit(text, integer, integer)');

-- For triggers: raise when the caller is over the limit. Writes the database makes on its own
-- (no signed-in user: migrations, jobs, other triggers run by the owner) aren't limited.
create function private.enforce_rate_limit(p_bucket text, p_max integer, p_window_seconds integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;
  if not private.rate_limit_take(p_bucket, p_max, p_window_seconds) then
    raise exception 'Too many in a short time. Wait a few minutes and try again.' using errcode = 'P0009';
  end if;
end $$;
revoke all on function private.enforce_rate_limit(text, integer, integer) from public;

-- The busy write tables: mentor messages, journal entries, video call bookings.
create function private.limit_mentor_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('mentor.messages', 60, 3600);
  return new;
end $$;
revoke all on function private.limit_mentor_messages() from public;
create trigger rate_limit before insert on public.mentor_messages
  for each row execute function private.limit_mentor_messages();

create function private.limit_journal_entries() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('journal.entries', 30, 3600);
  return new;
end $$;
revoke all on function private.limit_journal_entries() from public;
create trigger rate_limit before insert on public.player_journal_entries
  for each row execute function private.limit_journal_entries();

create function private.limit_video_calls() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('video_calls.book', 12, 3600);
  return new;
end $$;
revoke all on function private.limit_video_calls() from public;
create trigger rate_limit before insert on public.video_calls
  for each row execute function private.limit_video_calls();

-- Old counters go hourly where pg_cron exists (Supabase); the local test database has none.
create function private.purge_rate_limits() returns void
language sql security definer set search_path = '' as $$
  delete from private.rate_limit_hits where window_start < now() - interval '1 day'
$$;
revoke all on function private.purge_rate_limits() from public;
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-rate-limits', '17 * * * *', 'select private.purge_rate_limits()');
  end if;
end $$;
