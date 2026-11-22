-- Mentors on a head coach's video call (user, 2026-11-22: "As a coach scheduling a zoom call would like to invite
-- mentor ... allow to show on the mentors calendar and approve access"). docs/features/video-calls.md.
--   1. public.video_call_mentors: the mentors a head coach invited to a call. A mentor can be invited only to a call
--      whose every player they're already approved for (a whole-team mentor of that team, or the one-on-one mentor
--      her parents approved), so an invite never puts a mentor with a player nobody approved them for.
--   2. book_video_call() takes the mentors too (head coaches only), in the same step as the call and its players.
--   3. An invited mentor reads the call (their mentor calendar and home list it), joins it as a guest while they
--      still work with its players (video_call_role), and is told (a notice when invited, and when it's cancelled).
--      The players and parents on the call, and its host, see which mentors are invited.

-- 1. Who's invited
create table public.video_call_mentors (
  call_id     uuid not null references public.video_calls (id) on delete cascade,
  mentor_id   uuid not null references public.mentors (user_id) on delete cascade,
  -- the mentor's name when invited, so players and parents on the call can read it (they can't read mentors)
  mentor_name text not null check (char_length(mentor_name) between 1 and 80),
  primary key (call_id, mentor_id)
);
create index video_call_mentors_mentor_idx on public.video_call_mentors (mentor_id);
comment on table public.video_call_mentors is
  'Mentors a head coach invited to a video call. Written only by book_video_call(); each one is approved for every player on the call.';

-- The players a given mentor is approved for: my_mentee_ids() for someone else. Not callable by users: only the
-- definer functions below use it.
create function private.mentee_ids_of(p_mentor uuid) returns setof uuid
language sql stable set search_path = '' as $$
  select l.player_id from public.mentor_links l
   where l.mentor_id = p_mentor and l.status = 'approved' and l.player_id is not null
  union
  select r.player_id from public.mentor_links l
    join public.roster_entries r on r.team_id = l.team_id and r.active and r.season_id = private.team_current_season(l.team_id)
   where l.mentor_id = p_mentor and l.status = 'approved' and l.player_id is null
$$;
revoke all on function private.mentee_ids_of(uuid) from public;

-- Calls the signed-in mentor is invited to
create function private.my_mentor_video_call_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.call_id from public.video_call_mentors m where m.mentor_id = (select auth.uid())
$$;
revoke all on function private.my_mentor_video_call_ids() from public;
grant execute on function private.my_mentor_video_call_ids() to authenticated;

-- Reading. Exception to apply_staff_rls, like video_calls and video_call_players: staff and the host read every
-- invited mentor; an invited mentor reads the mentors on their calls; the players on a call, and their parents,
-- read who's coming. Nobody writes it directly.
alter table public.video_call_mentors enable row level security;
create policy "staff read call mentors" on public.video_call_mentors for select to authenticated
  using ((select private.is_staff()));
create policy "hosts read their call mentors" on public.video_call_mentors for select to authenticated
  using (exists (select 1 from public.video_calls c where c.id = call_id and c.host_id = (select auth.uid())));
create policy "mentors read their call mentors" on public.video_call_mentors for select to authenticated
  using (call_id in (select private.my_mentor_video_call_ids()));
create policy "players read their call mentors" on public.video_call_mentors for select to authenticated
  using (call_id in (select private.my_video_call_ids()));
create policy "players read their call mentors (parent view)" on public.video_call_mentors for select to authenticated
  using (call_id in (select private.my_child_video_call_ids()));
revoke insert, update, delete on public.video_call_mentors from authenticated, anon;

-- An invited mentor reads the call and who's on it (they're approved for every player on it)
create policy "invited mentors read their video calls" on public.video_calls for select to authenticated
  using (id in (select private.my_mentor_video_call_ids()));
create policy "invited mentors read call invites" on public.video_call_players for select to authenticated
  using (call_id in (select private.my_mentor_video_call_ids()));

-- 2. Booking with mentors: book_video_call() as in 20261122161707, plus p_mentor_ids (head coaches only, 20 at
-- most). Raises P0012 when a mentor isn't approved for every player on the call. The old 8-argument function and
-- its wrapper go; calls without mentors still pass 8 arguments (p_mentor_ids defaults to none).
drop function public.book_video_call(uuid, uuid[], text, text, timestamptz, integer, text, text[]);
drop function private.book_video_call(uuid, uuid[], text, text, timestamptz, integer, text, text[]);
create function private.book_video_call(p_team_id uuid, p_player_ids uuid[], p_host_name text, p_topic text,
                                        p_starts_at timestamptz, p_minutes integer, p_zoom_meeting_id text, p_calendars text[],
                                        p_mentor_ids uuid[] default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_me      uuid := (select auth.uid());
  v_players uuid[];
  v_mentors uuid[];
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
  -- the host never invites themselves
  select array_agg(distinct x) into v_mentors from unnest(coalesce(p_mentor_ids, '{}')) as x where x is not null and x <> v_me;
  if coalesce(cardinality(v_mentors), 0) > 20 then
    raise exception 'invite 20 mentors at most' using errcode = '22023';
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
  -- mentors: a head coach invites them, and each must be approved for every player on the call
  if v_mentors is not null then
    if v_kind <> 'coach' then
      raise exception 'only head coaches invite mentors' using errcode = '42501';
    end if;
    foreach v_p in array v_mentors loop
      if not exists (select 1 from public.mentors m where m.user_id = v_p)
         or exists (select 1 from unnest(v_players) as x where x not in (select private.mentee_ids_of(v_p))) then
        raise exception 'a mentor joins only calls with players they work with' using errcode = 'P0012';
      end if;
    end loop;
  end if;
  insert into public.video_calls (team_id, player_id, host_id, host_kind, host_name, topic, starts_at, minutes, zoom_meeting_id, calendars, group_size)
  values (p_team_id, v_lead, v_me, v_kind, p_host_name, p_topic, p_starts_at, p_minutes, p_zoom_meeting_id, v_cal, cardinality(v_players))
  returning id into v_id;
  insert into public.video_call_players (call_id, player_id) select v_id, x from unnest(v_players) as x on conflict do nothing;
  insert into public.video_call_mentors (call_id, mentor_id, mentor_name)
  select v_id, m.user_id, m.display_name from public.mentors m where m.user_id = any (coalesce(v_mentors, '{}'));
  return v_id;
end $$;
select private.expose('private.book_video_call(uuid, uuid[], text, text, timestamptz, integer, text, text[], uuid[])');

-- 3. Joining: as in 20261114224959, plus an invited mentor, as a guest, while they still work with every player
-- on the call (her parents or the head coach may have removed them since); 'off' as for the lead player.
create or replace function private.video_call_role(p_call_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.video_calls;
  v_me uuid := (select auth.uid());
  v_mine uuid[];
begin
  select * into v from public.video_calls where id = p_call_id;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select array_agg(x.player_id) into v_mine
    from public.video_call_players x
   where x.call_id = p_call_id
     and (x.player_id in (select private.my_player_ids()) or x.player_id in (select private.my_child_ids()));
  if v.host_id = v_me or (select private.is_head_coach()) then
    if v.cancelled_at is not null then
      return 'cancelled';
    end if;
    if not private.video_ok(v.team_id, v.player_id, v.host_kind) then
      return 'off';
    end if;
    return case when v.host_id = v_me then 'host' else 'guest' end;
  end if;
  if v_mine is null then
    if v_me is null
       or not exists (select 1 from public.video_call_mentors m where m.call_id = p_call_id and m.mentor_id = v_me)
       or exists (select 1 from public.video_call_players x
                   where x.call_id = p_call_id and x.player_id not in (select private.mentee_ids_of(v_me))) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    -- an invited mentor: on as long as calls are on for the lead player
    v_mine := array[v.player_id];
  end if;
  if v.cancelled_at is not null then
    return 'cancelled';
  end if;
  if not exists (select 1 from unnest(v_mine) as m where private.video_ok(v.team_id, m, v.host_kind)) then
    return 'off';
  end if;
  return 'guest';
end $$;

-- Notices: an invited mentor hears about the call as they're invited (it links to the call page) ...
create function private.notify_video_call_mentor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c      public.video_calls;
  v_name text;
begin
  select * into c from public.video_calls where id = new.call_id;
  if not found or c.cancelled_at is not null or new.mentor_id = (select auth.uid()) then
    return null;
  end if;
  select coalesce(nullif(btrim(p.preferred_name), ''), p.first_name) into v_name from public.players p where p.id = c.player_id;
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  values (new.mentor_id, 'video-call',
          'Video call ' || to_char(c.starts_at at time zone 'America/New_York', 'Dy, Mon FMDD "at" FMHH12:MI AM'),
          c.host_name || ' (head coach) invited you to a '
            || case when c.group_size > 1 then 'group video call (' || c.group_size || ' players) with ' || v_name || ' and others' else 'video call with ' || v_name end
            || ': ' || c.topic || '. It''s on your mentor calendar.',
          '/calls/' || c.id, c.team_id, c.player_id);
  return null;
end $$;
revoke all on function private.notify_video_call_mentor() from public;
create trigger notify_video_call_mentor after insert on public.video_call_mentors
  for each row execute function private.notify_video_call_mentor();

-- ... and when it's cancelled: notify_video_call() as in 20261114224959, plus the invited mentors.
create or replace function private.notify_video_call() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_when  text := to_char(new.starts_at at time zone 'America/New_York', 'Dy, Mon FMDD "at" FMHH12:MI AM');
  v_name  text;
  v_title text;
  v_body  text;
  v_me    uuid := (select auth.uid());
  v_who   text;
begin
  select coalesce(nullif(btrim(p.preferred_name), ''), p.first_name) into v_name from public.players p where p.id = new.player_id;
  v_who := v_name || case when new.group_size > 1 then ' and ' || (new.group_size - 1) || ' other player' || case when new.group_size > 2 then 's' else '' end else '' end;
  if tg_op = 'INSERT' then
    -- players and parents hear from notify_video_call_player as each is invited
    if new.host_kind <> 'mentor' then
      return null;
    end if;
    v_title := 'Video call ' || v_when;
    v_body := new.host_name || ' (mentor) scheduled a video call with ' || v_who || ': ' || new.topic || '.';
    insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
    select s.user_id, 'video-call', v_title, v_body, '/dugout/calendar?team=' || new.team_id, new.team_id, new.player_id
      from public.staff s
     where s.role in ('coach', 'admin') and s.user_id is distinct from v_me;
    return null;
  end if;
  if not (new.cancelled_at is not null and old.cancelled_at is null) then
    return null;
  end if;
  v_title := 'Video call cancelled: ' || v_when;
  v_body := 'The call with ' || new.host_name || ' about ' || new.topic || ' is off.';
  -- every invited player's approved parents, and her own login
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select distinct on (l.parent_id) l.parent_id, 'video-call', v_title, v_body, '/family', new.team_id, l.player_id
    from public.video_call_players x join public.parent_links l on l.player_id = x.player_id
   where x.call_id = new.id and l.status = 'approved' and l.parent_id is distinct from v_me;
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select distinct on (c.user_id) c.user_id, 'video-call', v_title, v_body, '/players/' || r.player_id, new.team_id, r.player_id
    from public.video_call_players x
    join public.roster_entries r on r.player_id = x.player_id
    join public.player_claims c on c.roster_entry_id = r.id
   where x.call_id = new.id and c.status = 'approved' and c.user_id is distinct from v_me;
  -- the mentors a head coach invited
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select m.mentor_id, 'video-call', v_title, v_body, '/mentor', new.team_id, new.player_id
    from public.video_call_mentors m
   where m.call_id = new.id and m.mentor_id is distinct from v_me;
  if new.host_kind = 'mentor' then
    insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
    select s.user_id, 'video-call', v_title, v_body, '/dugout/calendar?team=' || new.team_id, new.team_id, new.player_id
      from public.staff s
     where s.role in ('coach', 'admin') and s.user_id is distinct from v_me;
  end if;
  if new.host_id is distinct from v_me then
    insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
    values (new.host_id, 'video-call', v_title, v_body,
            case when new.host_kind = 'mentor' then '/mentor' else '/dugout/calendar?team=' || new.team_id end,
            new.team_id, new.player_id);
  end if;
  return null;
end $$;
