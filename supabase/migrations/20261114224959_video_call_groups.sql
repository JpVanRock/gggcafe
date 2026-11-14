-- Group video calls (user, 2026-11-14: "allow them to schedule a video meeting and invite players that are
-- approved on their roster"; their choice: several players in one call). docs/features/video-calls.md.
--   1. public.video_call_players: every player invited to a call. The call's player_id stays its first
--      player (the lead); a trigger adds the lead here, so this list is complete for every call, old ones too.
--      video_calls.group_size says how many players, so a player or parent sees "a group call, 3 players"
--      without seeing the other children's names (they read only their own invite rows).
--   2. book_video_call(): one step that checks every player (a head coach: on the team, calls allowed; a
--      mentor: also on their approved roster), books the call and adds the invites, 1 to 12 players, one team.
--   3. Invited players and their parents read the call, join it (video_call_role), get the notices, and her
--      parents get the emails (jobs_video_call_email: one row per invited player).

-- 1. Who's invited
alter table public.video_calls add column group_size smallint not null default 1 check (group_size between 1 and 12);
comment on column public.video_calls.group_size is 'How many players are invited (video_call_players); 1 for a one-on-one call.';

create table public.video_call_players (
  call_id   uuid not null references public.video_calls (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  primary key (call_id, player_id)
);
create index video_call_players_player_idx on public.video_call_players (player_id);
comment on table public.video_call_players is
  'Every player invited to a video call (the lead included). Written only by triggers and book_video_call().';

insert into public.video_call_players (call_id, player_id) select id, player_id from public.video_calls on conflict do nothing;

-- the lead joins the list as the call is made (direct bookings included)
create function private.video_call_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.video_call_players (call_id, player_id) values (new.id, new.player_id) on conflict do nothing;
  return null;
end $$;
revoke all on function private.video_call_lead() from public;
create trigger video_call_lead after insert on public.video_calls for each row execute function private.video_call_lead();

-- Calls a player is invited to: hers (her own login), and her parents' (the parent-view twin)
create function private.my_video_call_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select v.call_id from public.video_call_players v where v.player_id in (select private.my_player_ids())
$$;
create function private.my_child_video_call_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select v.call_id from public.video_call_players v where v.player_id in (select private.my_child_ids())
$$;
revoke all on function private.my_video_call_ids() from public;
revoke all on function private.my_child_video_call_ids() from public;
grant execute on function private.my_video_call_ids() to authenticated;
grant execute on function private.my_child_video_call_ids() to authenticated;

-- Reading. Exception to apply_staff_rls, like video_calls: staff and the host read every invite of a call;
-- a player, and her parents, read only her own invite rows (not the other children on a group call).
alter table public.video_call_players enable row level security;
create policy "staff read call invites" on public.video_call_players for select to authenticated
  using ((select private.is_staff()));
create policy "hosts read their call invites" on public.video_call_players for select to authenticated
  using (exists (select 1 from public.video_calls c where c.id = call_id and c.host_id = (select auth.uid())));
create policy "players read their call invites" on public.video_call_players for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "players read their call invites (parent view)" on public.video_call_players for select to authenticated
  using (player_id in (select private.my_child_ids()));
revoke insert, update, delete on public.video_call_players from authenticated, anon;

create policy "players read their group video calls" on public.video_calls for select to authenticated
  using (id in (select private.my_video_call_ids()));
create policy "players read their group video calls (parent view)" on public.video_calls for select to authenticated
  using (id in (select private.my_child_video_call_ids()));

-- 2. Booking: the call and its invites in one step. Raises 42501 when the caller may not book with any one
-- of the players, 22023 for an empty or too-long list; the call's own checks (P0007 past, P0008 another call
-- then, P0009 too many bookings) still apply.
create function private.book_video_call(p_team_id uuid, p_player_ids uuid[], p_host_name text, p_topic text,
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
  if coalesce(cardinality(v_players), 0) not between 1 and 12 then
    raise exception 'pick 1 to 12 players' using errcode = '22023';
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
select private.expose('private.book_video_call(uuid, uuid[], text, text, timestamptz, integer, text, text[])');

-- A mentor's players they may book a call with now, and the team the call would go on
create function private.mentor_call_players() returns table (player_id uuid, team_id uuid)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
    select s.p, s.t
      from (select m.p, (select r.team_id
                           from public.roster_entries r join public.teams tm on tm.id = r.team_id
                          where r.player_id = m.p and r.active and r.season_id = private.team_current_season(r.team_id)
                          order by tm.name, tm.id limit 1) as t
              from (select private.my_mentee_ids() as p) m) s
     where s.t is not null and private.video_ok(s.t, s.p, 'mentor');
end $$;
select private.expose('private.mentor_call_players()');

-- 3. Joining: the host; an invited player, her parents; head coaches. 'off' when calls are off for the
-- caller's own player on the call (or, for the host and coaches, for the lead).
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
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v.cancelled_at is not null then
    return 'cancelled';
  end if;
  if not exists (select 1 from unnest(v_mine) as m where private.video_ok(v.team_id, m, v.host_kind)) then
    return 'off';
  end if;
  return 'guest';
end $$;

-- Notices: each invited player's login and parents hear about the booking as she's added to it; the
-- cancellation reaches every invited player; head coaches hear about mentors' calls; the host about a
-- cancellation by someone else.
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

-- A player is invited: her approved parents and her own login hear about it
create function private.notify_video_call_player() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c       public.video_calls;
  v_name  text;
  v_title text;
  v_body  text;
  v_me    uuid := (select auth.uid());
begin
  select * into c from public.video_calls where id = new.call_id;
  if not found or c.cancelled_at is not null then
    return null;
  end if;
  select coalesce(nullif(btrim(p.preferred_name), ''), p.first_name) into v_name from public.players p where p.id = new.player_id;
  v_title := 'Video call ' || to_char(c.starts_at at time zone 'America/New_York', 'Dy, Mon FMDD "at" FMHH12:MI AM');
  v_body := c.host_name || case when c.host_kind = 'mentor' then ' (mentor)' else ' (head coach)' end
            || ' scheduled a ' || case when c.group_size > 1 then 'group video call (' || c.group_size || ' players)' else 'video call' end
            || ' with ' || v_name || ': ' || c.topic || '. Parents can join it from the family page.';
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select distinct l.parent_id, 'video-call', v_title, v_body, '/family', c.team_id, new.player_id
    from public.parent_links l
   where l.player_id = new.player_id and l.status = 'approved' and l.parent_id is distinct from v_me;
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select distinct cl.user_id, 'video-call', v_title, v_body, '/players/' || new.player_id, c.team_id, new.player_id
    from public.player_claims cl join public.roster_entries r on r.id = cl.roster_entry_id
   where r.player_id = new.player_id and cl.status = 'approved' and cl.user_id is distinct from v_me;
  return null;
end $$;
revoke all on function private.notify_video_call_player() from public;
create trigger notify_video_call_player after insert on public.video_call_players
  for each row execute function private.notify_video_call_player();

-- The parents' emails: one row per invited player (her approved parents, her first name), so each family's
-- email names their own daughter. The worker sends one email per address.
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
                      where l.player_id = x.player_id and l.status = 'approved' and u.email is not null), '{}'),
           coalesce(nullif(btrim(p.preferred_name), ''), p.first_name),
           c.host_name, c.host_kind, c.topic, c.starts_at, c.minutes, c.cancelled_at is not null
      from public.video_calls c
      join public.video_call_players x on x.call_id = c.id
      join public.players p on p.id = x.player_id
     where c.id = p_call_id
     order by (x.player_id = c.player_id) desc, p.first_name;
end $$;
