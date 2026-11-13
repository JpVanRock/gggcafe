-- Video calls (user, 2026-11-12): mentors and head coaches schedule a Zoom call with one player,
-- held inside the site (/calls/<id>). A site admin turns video calls on for a team; then that
-- team's head coach can switch them on for mentors (the Switchboard). With a team's calls off,
-- nobody on that team can schedule, start or join one; a player on more than one team needs
-- every one of her teams to allow it. Her parents are notified of every call and can join it;
-- head coaches can drop in on any call. Calls aren't recorded. Zoom holds the meeting: we keep
-- only its number (the passcode and the host's key come from Zoom when someone joins).
-- Docs: docs/features/video-calls.md.

-- 1. Which teams may hold video calls (a row = an admin turned them on) and whether mentors may.
create table public.team_video_access (
  team_id        uuid primary key references public.teams (id) on delete cascade,
  allowed_by     uuid default auth.uid() references auth.users (id) on delete set null,
  allowed_at     timestamptz not null default now(),
  mentors_on     boolean not null default false,
  mentors_set_by uuid references auth.users (id) on delete set null,
  mentors_set_at timestamptz
);
comment on table public.team_video_access is
  'Video calls: a row = a site admin turned them on for the team; mentors_on = its head coach let mentors call too.';
-- Exception to apply_staff_rls: only admins turn a team on or off (assistants can't); head coaches
-- only switch mentors on or off. Players, parents and mentors ask through the functions below.
alter table public.team_video_access enable row level security;
create policy "staff read video access" on public.team_video_access for select to authenticated
  using ((select private.is_staff()));
create policy "admins turn video calls on" on public.team_video_access for insert to authenticated
  with check ((select private.is_admin()) and not mentors_on);
create policy "admins turn video calls off" on public.team_video_access for delete to authenticated
  using ((select private.is_admin()));
create policy "head coaches switch mentors' video calls" on public.team_video_access for update to authenticated
  using ((select private.is_head_coach())) with check ((select private.is_head_coach()));
revoke update on public.team_video_access from authenticated;
grant update (mentors_on, mentors_set_by, mentors_set_at) on public.team_video_access to authenticated;

-- 2. The calls.
create table public.video_calls (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams (id) on delete cascade,
  player_id       uuid not null references public.players (id) on delete cascade,
  host_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  host_kind       text not null check (host_kind in ('coach', 'mentor')),
  host_name       text not null check (char_length(btrim(host_name)) between 1 and 80),
  topic           text not null check (char_length(btrim(topic)) between 1 and 120),
  starts_at       timestamptz not null,
  minutes         smallint not null check (minutes between 15 and 90),
  zoom_meeting_id text not null unique check (zoom_meeting_id ~ '^[0-9]{9,12}$'),
  cancelled_at    timestamptz,
  cancelled_by    uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index video_calls_team_idx on public.video_calls (team_id, starts_at);
create index video_calls_player_idx on public.video_calls (player_id, starts_at);
create index video_calls_host_idx on public.video_calls (host_id, starts_at);
comment on table public.video_calls is
  'Video calls a mentor or head coach scheduled with a player (Zoom, inside the site). Cancelled calls stay as the record.';

-- Every one of her current teams allows video calls (for a mentor's call: allows mentors), and
-- the call's team is one of them.
create function private.video_ok(p_team_id uuid, p_player_id uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.roster_entries r
            where r.player_id = p_player_id and r.team_id = p_team_id and r.active
              and r.season_id = private.team_current_season(r.team_id))
     and not exists (
           select 1 from public.roster_entries r
            where r.player_id = p_player_id and r.active and r.season_id = private.team_current_season(r.team_id)
              and not exists (select 1 from public.team_video_access a
                               where a.team_id = r.team_id and (p_kind = 'coach' or a.mentors_on)))
$$;
revoke all on function private.video_ok(uuid, uuid, text) from public;
grant execute on function private.video_ok(uuid, uuid, text) to authenticated;

alter table public.video_calls enable row level security;
-- Exception to apply_staff_rls: mentors schedule too, and assistants and viewers only read.
-- Reading: coaches oversee every call; the host; the player; her parents (the parent-view twin).
create policy "staff read video calls" on public.video_calls for select to authenticated
  using ((select private.is_staff()));
create policy "hosts read their video calls" on public.video_calls for select to authenticated
  using (host_id = (select auth.uid()));
create policy "players read their video calls" on public.video_calls for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "players read their video calls (parent view)" on public.video_calls for select to authenticated
  using (player_id in (select private.my_child_ids()));
-- Scheduling: head coaches with a player on their team, mentors with their own players
create policy "head coaches schedule video calls" on public.video_calls for insert to authenticated
  with check (host_kind = 'coach' and host_id = (select auth.uid()) and (select private.is_head_coach())
              and private.video_ok(team_id, player_id, 'coach'));
create policy "mentors schedule video calls" on public.video_calls for insert to authenticated
  with check (host_kind = 'mentor' and host_id = (select auth.uid())
              and player_id in (select private.my_mentee_ids())
              and private.video_ok(team_id, player_id, 'mentor'));
-- Cancelling: the host, or a head coach. Nothing else changes and nothing is deleted.
create policy "hosts cancel their video calls" on public.video_calls for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
create policy "head coaches cancel video calls" on public.video_calls for update to authenticated
  using ((select private.is_head_coach())) with check ((select private.is_head_coach()));
revoke update, delete on public.video_calls from authenticated;
grant update (cancelled_at, cancelled_by) on public.video_calls to authenticated;

-- Zoom runs one call at a time per host account, and a call is booked ahead.
create function private.video_call_checks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.starts_at < now() then
    raise exception 'That time has passed.' using errcode = 'P0007';
  end if;
  if exists (select 1 from public.video_calls c
              where c.cancelled_at is null
                and c.starts_at < new.starts_at + make_interval(mins => new.minutes)
                and new.starts_at < c.starts_at + make_interval(mins => c.minutes)) then
    raise exception 'Another video call is booked then.' using errcode = 'P0008';
  end if;
  return new;
end $$;
revoke all on function private.video_call_checks() from public;
create trigger video_call_checks before insert on public.video_calls
  for each row execute function private.video_call_checks();

-- 3. Notices: her parents and her own login hear about every call and cancellation; head coaches
-- and admins about mentors' calls; the host when someone else cancels.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('player-of-the-week', 'video-call'));

create function private.notify_video_call() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_when  text := to_char(new.starts_at at time zone 'America/New_York', 'Dy, Mon FMDD "at" FMHH12:MI AM');
  v_name  text;
  v_title text;
  v_body  text;
  v_me    uuid := (select auth.uid());
begin
  select coalesce(nullif(btrim(p.preferred_name), ''), p.first_name) into v_name from public.players p where p.id = new.player_id;
  if tg_op = 'INSERT' then
    v_title := 'Video call ' || v_when;
    v_body := new.host_name || case when new.host_kind = 'mentor' then ' (mentor)' else ' (head coach)' end
              || ' scheduled a video call with ' || v_name || ': ' || new.topic || '. Parents can join it from the family page.';
  elsif new.cancelled_at is not null and old.cancelled_at is null then
    v_title := 'Video call cancelled: ' || v_when;
    v_body := 'The call with ' || new.host_name || ' about ' || new.topic || ' is off.';
  else
    return null;
  end if;
  -- her approved parents
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select distinct l.parent_id, 'video-call', v_title, v_body, '/family', new.team_id, new.player_id
    from public.parent_links l
   where l.player_id = new.player_id and l.status = 'approved' and l.parent_id is distinct from v_me;
  -- her own login
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select distinct c.user_id, 'video-call', v_title, v_body, '/players/' || new.player_id, new.team_id, new.player_id
    from public.player_claims c join public.roster_entries r on r.id = c.roster_entry_id
   where r.player_id = new.player_id and c.status = 'approved' and c.user_id is distinct from v_me;
  -- head coaches and admins oversee mentors' calls
  if new.host_kind = 'mentor' then
    insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
    select s.user_id, 'video-call', v_title, v_body, '/dugout/calendar?team=' || new.team_id, new.team_id, new.player_id
      from public.staff s
     where s.role in ('coach', 'admin') and s.user_id is distinct from v_me;
  end if;
  -- the host, when someone else called it off
  if tg_op = 'UPDATE' and new.host_id is distinct from v_me then
    insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
    values (new.host_id, 'video-call', v_title, v_body,
            case when new.host_kind = 'mentor' then '/mentor/players/' || new.player_id else '/dugout/calendar?team=' || new.team_id end,
            new.team_id, new.player_id);
  end if;
  return null;
end $$;
revoke all on function private.notify_video_call() from public;
create trigger notify_video_call after insert or update of cancelled_at on public.video_calls
  for each row execute function private.notify_video_call();

-- 4. For the pages.
-- The team a call with her goes on (her first current team) when the caller may schedule one:
-- a head coach, or one of her mentors. Null when video calls are off for her.
create function private.video_call_team(p_player_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_kind text;
  v_team uuid;
begin
  if (select private.is_head_coach()) then
    v_kind := 'coach';
  elsif p_player_id in (select private.my_mentee_ids()) then
    v_kind := 'mentor';
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select r.team_id into v_team
    from public.roster_entries r join public.teams t on t.id = r.team_id
   where r.player_id = p_player_id and r.active and r.season_id = private.team_current_season(r.team_id)
   order by t.name, t.id
   limit 1;
  if v_team is null or not private.video_ok(v_team, p_player_id, v_kind) then
    return null;
  end if;
  return v_team;
end $$;
select private.expose('private.video_call_team(uuid)');

-- Joining: 'host' for whoever scheduled it, 'guest' for her, her parents and head coaches;
-- 'cancelled', or 'off' when her team's video calls are off. Anyone else is refused.
create function private.video_call_role(p_call_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.video_calls;
  v_me uuid := (select auth.uid());
begin
  select * into v from public.video_calls where id = p_call_id;
  if not found or not (v.host_id = v_me
                       or v.player_id in (select private.my_player_ids())
                       or v.player_id in (select private.my_child_ids())
                       or (select private.is_head_coach())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v.cancelled_at is not null then
    return 'cancelled';
  end if;
  if not private.video_ok(v.team_id, v.player_id, v.host_kind) then
    return 'off';
  end if;
  return case when v.host_id = v_me then 'host' else 'guest' end;
end $$;
select private.expose('private.video_call_role(uuid)');
