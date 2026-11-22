-- Group video calls hold up to 20 players instead of 12 (user, 2026-11-22: "Call cap should be increased to 20"),
-- so a head coach can call a whole roster with the form's "Select all". Every invited player's parents can join
-- too; 20 players, their parents and the coaches stay within a Zoom meeting's 100 people.
-- The app's limit is CALL_MAX_PLAYERS in src/lib/video-calls.ts (the same number).

alter table public.video_calls drop constraint video_calls_group_size_check;
alter table public.video_calls add constraint video_calls_group_size_check check (group_size between 1 and 20);

-- book_video_call() from migration 20261114224959, with 20 in place of 12; nothing else changes. Its public
-- wrapper and grants stay (create or replace keeps them).
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
  if coalesce(cardinality(v_players), 0) not between 1 and 20 then
    raise exception 'pick 1 to 20 players' using errcode = '22023';
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
