-- The log drain, in our own database (user, 2026-11-14: "build the log drain"; their choice over Vercel's
-- Pro-plan drains and outside log services, so nothing about players leaves the site).
-- docs/architecture/observability.md.
--   1. private.log_events: the site's structured log lines (src/lib/log.ts: already redacted, no emails,
--      tokens or secrets), kept 30 days.
--   2. drain_logs(): the server writes lines with the server secret, like report_error.
--   3. admin_logs(): admins read them on the Site health page, newest first, by level and search.
--   4. report_error() now emails the admins when an error is new, or comes back after it was resolved
--      (job email.error_alert), at most 10 a day.

-- 1. The lines
create table private.log_events (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  level   text not null check (level in ('info', 'warn', 'error')),
  event   text not null check (char_length(event) between 1 and 80),
  route   text check (char_length(route) <= 200),
  message text check (char_length(message) <= 500),
  fields  jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object' and pg_column_size(fields) <= 8192)
);
create index log_events_at on private.log_events (at);
create index log_events_level on private.log_events (level, id desc);
revoke all on private.log_events from public, anon, authenticated;
comment on table private.log_events is 'The log drain: the site''s structured log lines, redacted, kept 30 days (the admin Site health page).';

-- 2. Writing: the server, signed out, with the server secret. At most 50 lines a call and 5,000 an hour,
-- so a loop can't fill the database; anything malformed is left out, never an error.
create function private.drain_logs(p_secret text, p_lines jsonb) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_room integer;
  v_count integer;
begin
  perform private.jobs_check(p_secret);
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    return 0;
  end if;
  v_room := 5000 - (select count(*)::integer from private.log_events where at > now() - interval '1 hour');
  if v_room <= 0 then
    return 0;
  end if;
  insert into private.log_events (level, event, route, message, fields)
  select l->>'level', left(btrim(l->>'event'), 80), left(l->>'route', 200), left(l->>'message', 500),
         case when jsonb_typeof(l->'fields') = 'object' and pg_column_size(l->'fields') <= 8192 then l->'fields' else '{}'::jsonb end
    from jsonb_array_elements(p_lines) with ordinality as x(l, n)
   where n <= least(v_room, 50)
     and jsonb_typeof(l) = 'object'
     and l->>'level' in ('info', 'warn', 'error')
     and coalesce(btrim(l->>'event'), '') <> '';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
select private.expose('private.drain_logs(text, jsonb)', array['anon']);

-- 3. Reading: admins only. p_level 'warn' means warnings and errors; p_search looks in the event, the
-- message and the page; p_before pages back by id.
create function private.admin_logs(p_level text default null, p_search text default null, p_before bigint default null, p_limit integer default 100)
returns table (id bigint, at timestamptz, level text, event text, route text, message text, fields jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_like text := case when nullif(btrim(p_search), '') is null then null
                      else '%' || replace(replace(replace(left(btrim(p_search), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
begin
  if not (select private.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select e.id, e.at, e.level, e.event, e.route, e.message, e.fields
      from private.log_events e
     where (p_level is null or e.level = p_level or (p_level = 'warn' and e.level = 'error'))
       and (v_like is null or e.event ilike v_like or e.message ilike v_like or e.route ilike v_like)
       and (p_before is null or e.id < p_before)
     order by e.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;
select private.expose('private.admin_logs(text, text, bigint, integer)');

-- Kept 30 days (the Privacy notice: technical logs for a few weeks)
create function private.purge_logs() returns void
language sql security definer set search_path = '' as $$
  delete from private.log_events where at < now() - interval '30 days'
$$;
revoke all on function private.purge_logs() from public;
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-logs', '57 4 * * *', 'select private.purge_logs()');
  end if;
end $$;

-- 4. A new error, or one back after it was resolved, emails the admins once (a day per error), at most
-- 10 alert emails a day in all.
create or replace function private.report_error(p_secret text, p_fingerprint text, p_source text, p_name text,
                                                p_message text, p_route text default null, p_digest text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_seen boolean := false;
  v_resolved boolean := false;
begin
  perform private.jobs_check(p_secret);
  select true, g.resolved_at is not null into v_seen, v_resolved from private.error_groups g where g.fingerprint = p_fingerprint;
  v_seen := coalesce(v_seen, false);
  v_resolved := coalesce(v_resolved, false);
  if not v_seen and (select count(*) from private.error_groups where first_seen > now() - interval '1 hour') >= 200 then
    return;
  end if;
  insert into private.error_groups as g (fingerprint, source, name, message, route, digest)
  values (p_fingerprint, p_source, left(coalesce(nullif(btrim(p_name), ''), 'Error'), 120),
          left(coalesce(nullif(btrim(p_message), ''), '(no message)'), 500), left(p_route, 200), left(p_digest, 64))
  on conflict (fingerprint) do update
    set count = least(g.count, 2000000000) + 1, last_seen = now(), resolved_at = null,
        digest = coalesce(excluded.digest, g.digest);
  if (not v_seen or v_resolved)
     and (select count(*) from private.jobs where kind = 'email.error_alert' and created_at > now() - interval '1 day') < 10 then
    perform private.enqueue_job('email.error_alert', 'email.error_alert:' || p_fingerprint || ':' || to_char(now(), 'YYYY-MM-DD'),
                                jsonb_build_object('fingerprint', p_fingerprint));
  end if;
end $$;

-- What the alert email needs: the error, and the admins' addresses
create function private.jobs_error_alert(p_secret text, p_fingerprint text)
returns table (source text, name text, message text, route text, count integer, first_seen timestamptz, recipients text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.jobs_check(p_secret);
  return query
    select g.source, g.name, g.message, g.route, g.count, g.first_seen,
           coalesce((select array_agg(distinct u.email::text)
                       from public.staff s join auth.users u on u.id = s.user_id
                      where s.role = 'admin' and u.email is not null), array[]::text[])
      from private.error_groups g
     where g.fingerprint = p_fingerprint;
end $$;
select private.expose('private.jobs_error_alert(text, text)', array['anon']);
