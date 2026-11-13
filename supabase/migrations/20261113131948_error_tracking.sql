-- Error tracking (user, 2026-11-13; docs/architecture/observability.md; Phase 1 of the architecture
-- review). Errors from the server, server actions, route handlers, the browser and the job worker
-- are grouped by a fingerprint (what went wrong, where) and counted here, in our own database, so
-- nothing about players goes to an outside error service. Site admins read them on /health.
--
-- Writing: the server reports with the server secret (the job worker's, jobs_secret in Vault), the
-- same machine-to-database path the worker uses; browsers report through /api/errors, never here.
-- At most 200 new groups an hour are kept, so a flood of different errors can't fill the table.
-- Groups not seen for 30 days are purged daily.

create table private.error_groups (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{16}$'),
  source      text not null check (source in ('server', 'action', 'route', 'browser', 'job')),
  name        text not null check (char_length(name) between 1 and 120),
  message     text not null check (char_length(message) between 1 and 500),
  route       text check (char_length(route) <= 200),
  digest      text check (char_length(digest) <= 64),
  count       integer not null default 1 check (count >= 1),
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  resolved_at timestamptz
);
create index error_groups_recent on private.error_groups (last_seen desc);
create index error_groups_first on private.error_groups (first_seen);
revoke all on private.error_groups from public, anon, authenticated;
comment on table private.error_groups is 'Errors grouped by fingerprint and counted (the admin Site health page).';

-- The server reports an error (secret-checked like the job functions). A resolved group that
-- happens again opens again.
create function private.report_error(p_secret text, p_fingerprint text, p_source text, p_name text,
                                     p_message text, p_route text default null, p_digest text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.jobs_check(p_secret);
  if not exists (select 1 from private.error_groups where fingerprint = p_fingerprint)
     and (select count(*) from private.error_groups where first_seen > now() - interval '1 hour') >= 200 then
    return;
  end if;
  insert into private.error_groups as g (fingerprint, source, name, message, route, digest)
  values (p_fingerprint, p_source, left(coalesce(nullif(btrim(p_name), ''), 'Error'), 120),
          left(coalesce(nullif(btrim(p_message), ''), '(no message)'), 500), left(p_route, 200), left(p_digest, 64))
  on conflict (fingerprint) do update
    set count = least(g.count, 2000000000) + 1, last_seen = now(), resolved_at = null,
        digest = coalesce(excluded.digest, g.digest);
end $$;
select private.expose('private.report_error(text, text, text, text, text, text, text)', array['anon']);

-- Admins: the groups seen in the last p_days days, open ones first.
create function private.error_summary(p_days integer default 7)
returns table (fingerprint text, source text, name text, message text, route text, digest text,
               count integer, first_seen timestamptz, last_seen timestamptz, resolved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (select private.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select g.fingerprint, g.source, g.name, g.message, g.route, g.digest, g.count, g.first_seen, g.last_seen, g.resolved_at
      from private.error_groups g
     where g.last_seen > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
     order by (g.resolved_at is null) desc, g.last_seen desc
     limit 200;
end $$;
select private.expose('private.error_summary(integer)');

-- Admins: mark a group resolved (it opens again if it happens again).
create function private.resolve_error(p_fingerprint text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update private.error_groups set resolved_at = now() where fingerprint = p_fingerprint and resolved_at is null;
end $$;
select private.expose('private.resolve_error(text)');

-- Admins: how the job worker is doing over the last 7 days, and its latest problems.
create function private.jobs_summary()
returns table (kind text, waiting bigint, done bigint, skipped bigint, dead bigint, retrying bigint,
               last_error text, last_error_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (select private.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select j.kind,
           count(*) filter (where j.done_at is null and j.attempts = 0),
           count(*) filter (where j.outcome = 'done'),
           count(*) filter (where j.outcome = 'skipped'),
           count(*) filter (where j.outcome = 'dead'),
           count(*) filter (where j.done_at is null and j.attempts > 0),
           (array_agg(j.last_error order by j.created_at desc) filter (where j.last_error is not null and j.outcome is distinct from 'done'))[1],
           max(j.created_at) filter (where j.last_error is not null and j.outcome is distinct from 'done')
      from private.jobs j
     where j.created_at > now() - interval '7 days' or j.done_at is null
     group by j.kind
     order by j.kind;
end $$;
select private.expose('private.jobs_summary()');

create function private.purge_errors() returns void
language sql security definer set search_path = '' as $$
  delete from private.error_groups where last_seen < now() - interval '30 days'
$$;
revoke all on function private.purge_errors() from public;
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-errors', '53 4 * * *', 'select private.purge_errors()');
  end if;
end $$;
