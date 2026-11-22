-- Group video calls: the team's roster is the limit, not a fixed number (user, 2026-11-22: "why not just say
-- select all players the team max on the roster"; 12 until today, then 20 in 20261122161228). book_video_call()
-- already takes only players on the team's current roster (video_ok), so "Select all players" can invite the whole
-- team. 100 stays as a bound no roster reaches (it's also the most people a Zoom meeting holds), so a malformed
-- request can't make it check thousands of ids. The app's bound is CALL_PLAYER_BOUND in src/lib/video-calls.ts.

alter table public.video_calls drop constraint video_calls_group_size_check;
alter table public.video_calls add constraint video_calls_group_size_check check (group_size between 1 and 100);

-- book_video_call() as in 20261122161228, with the bound of 100; nothing else changes. Its public wrapper and
-- grants stay (create or replace keeps them).
create or replace function private.book_video_call(p_team_id uuid, p_player_ids uuid[], p_host_name text, p_topic text,
                                        p_starts_at timestamptz, p_minutes integer, p_zoom_meeting_id text, p_calendars text[])
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_me      uuid := (select auth.uid());
  v_players uuid[];
  v_lead    uuid;
  v_kind    text;
  v_cal     text[] := coalesce(p_calendars, '{}');
  v_id      uuid;
  v_p       uuid;
begin
  if v_me is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select array_agg(distinct x) into v_players from unnest(p_player_ids) as x where x is not null;
  if coalesce(cardinality(v_players), 0) not between 1 and 100 then
    raise exception 'pick at least 1 player (100 at most)' using errcode = '22023';
  end if;
  select x into v_lead from unnest(p_player_ids) with ordinality as u(x, n) where x is not null order by n limit 1;
  if (select private.is_head_coach()) then
    v_kind := 'coach';
    if not ('coaches' = any (v_cal)) then
      v_cal := v_cal || 'coaches'::text;
    end if;
  elsif exists (select 1 from public.mentors m where m.user_id = v_me) then
    v_kind := 'mentor';
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  foreach v_p in array v_players loop
    if not private.video_ok(p_team_id, v_p, v_kind)
       or (v_kind = 'mentor' and v_p not in (select private.my_mentee_ids())) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end loop;
  insert into public.video_calls (team_id, player_id, host_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id, calendars, group_size)
  values (p_team_id, v_lead, v_me, v_kind, p_host_name, p_topic, p_starts_at, p_minutes, p_zoom_meeting_id, v_cal, cardinality(v_players))
  returning id into v_id;
  insert into public.video_call_players (call_id, player_id) select v_id, x from unnest(v_players) as x on conflict do nothing;
  return v_id;
end $$;
