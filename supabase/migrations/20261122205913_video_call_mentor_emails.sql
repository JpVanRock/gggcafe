-- Emails to the mentors a head coach invited to a video call (user, 2026-11-22: "Also email invited mentors when a
-- call is booked"). The same email.video_call job that emails the players' parents now emails each invited mentor
-- too, when the call is booked and when it's cancelled (docs/architecture/jobs.md). Like jobs_video_call_email(),
-- only the job worker, with the jobs secret, can read it: one row per invited mentor with an email.
create function private.jobs_video_call_mentor_email(p_secret text, p_call_id uuid)
returns table (email text, mentor_name text, player_first text, group_size smallint, host_name text, topic text,
               starts_at timestamptz, minutes smallint, cancelled boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.jobs_check(p_secret);
  return query
    select u.email::text, m.mentor_name, coalesce(nullif(btrim(p.preferred_name), ''), p.first_name),
           c.group_size, c.host_name, c.topic, c.starts_at, c.minutes, c.cancelled_at is not null
      from public.video_calls c
      join public.video_call_mentors m on m.call_id = c.id
      join auth.users u on u.id = m.mentor_id
      join public.players p on p.id = c.player_id
     where c.id = p_call_id and u.email is not null
     order by m.mentor_name;
end $$;
select private.expose('private.jobs_video_call_mentor_email(text, uuid)', array['anon']);
