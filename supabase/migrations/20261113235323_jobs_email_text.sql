-- The job worker's parent-email lookup failed on Supabase (user, 2026-11-13; found while checking the
-- email setup): auth.users.email is varchar(255) there, and a plpgsql "return query" must match the
-- declared text[] exactly, so every video-call email job failed with "structure of query does not
-- match function result type". Same function, with the email cast to text. The local test stub now
-- uses Supabase's varchar columns, so tests/db/jobs.test.sql catches this kind of mismatch.
-- create or replace keeps the grants and the public wrapper from private.expose().
create or replace function private.jobs_video_call_email(p_secret text, p_call_id uuid)
returns table (recipients text[], player_first text, host_name text, host_kind text, topic text,
               starts_at timestamptz, minutes smallint, cancelled boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.jobs_check(p_secret);
  return query
    select coalesce((select array_agg(distinct u.email::text order by u.email::text)
                       from public.parent_links l join auth.users u on u.id = l.parent_id
                      where l.player_id = c.player_id and l.status = 'approved' and u.email is not null), '{}'),
           coalesce(nullif(btrim(p.preferred_name), ''), p.first_name),
           c.host_name, c.host_kind, c.topic, c.starts_at, c.minutes, c.cancelled_at is not null
      from public.video_calls c join public.players p on p.id = c.player_id
     where c.id = p_call_id;
end $$;
