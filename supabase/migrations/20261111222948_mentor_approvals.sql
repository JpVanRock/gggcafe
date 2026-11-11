-- =============================================================================
-- GGG.Cafe — Mentors: approved by parents or the head coach, private messages,
-- notes with coaches, training for a group (user, 2026-11-11)
--
-- * Approval (replaces admin approval + coach assignment): a mentor asks with the
--   team code, for the whole team or for one player by name (request_mentor).
--   The head coach approves a whole-team request: she works with every player on
--   the team's current roster. A player's approved parents approve a request for
--   her daughter. Admins can approve either. What she sees follows those approvals
--   (private.my_mentee_ids()). public.mentor_links replaces public.mentor_players.
-- * Messages to a player stay between the mentor, the player, her parents and admins,
--   unless the mentor shares one with the coaches (shared_with_coaches).
-- * Notes with coaches (public.mentor_notes): discussion summaries and notes about a
--   player or the whole team; head coaches and admins reply. Focus areas
--   (public.mentor_focus): what she's working on with a player or the team, and what's
--   working. Coaches read both; a player's approved parents read the ones about her.
--   Players don't see either.
-- * Training dates: every approved mentor adds them, for one player or several
--   (no admin switch any more: mentors.can_schedule is gone).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Who a mentor works with
-- -----------------------------------------------------------------------------
create type public.mentor_link_status as enum ('pending', 'approved', 'declined');

create table public.mentor_links (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors (user_id) on delete cascade,
  -- the team whose code she used; for a whole-team link, the team she works with
  team_id     uuid references public.teams (id) on delete cascade,
  -- one player (her parents approve), or null for the whole team (the head coach approves)
  player_id   uuid references public.players (id) on delete cascade,
  player_name text check (player_name is null or char_length(player_name) <= 80),  -- as she typed it
  status      public.mentor_link_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by  uuid references auth.users (id) on delete set null,
  decided_at  timestamptz,
  check (player_id is not null or team_id is not null)
);
comment on table public.mentor_links is
  'Who a mentor works with: a whole team (head coach approves) or one player (her parents approve). Made by request_mentor(), decided by decide_mentor_link().';
create index mentor_links_mentor_idx on public.mentor_links (mentor_id);
create index mentor_links_team_idx on public.mentor_links (team_id);
create index mentor_links_player_idx on public.mentor_links (player_id);
create index mentor_links_decided_by_idx on public.mentor_links (decided_by);
-- one live request or approval per team / per player (a declined one can be asked again)
create unique index mentor_links_one_team on public.mentor_links (mentor_id, team_id)
  where player_id is null and status <> 'declined';
create unique index mentor_links_one_player on public.mentor_links (mentor_id, player_id)
  where player_id is not null and status <> 'declined';

-- Earlier coach assignments (if any) become approved player links.
insert into public.mentor_links (mentor_id, player_id, status, requested_at, decided_by, decided_at)
select mp.mentor_id, mp.player_id, 'approved', mp.created_at, mp.assigned_by, mp.created_at from public.mentor_players mp;

-- The helpers every mentor read policy uses, now from the approvals.
create or replace function private.my_mentee_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.player_id from public.mentor_links l
   where l.mentor_id = (select auth.uid()) and l.status = 'approved' and l.player_id is not null
  union
  select r.player_id from public.mentor_links l
    join public.roster_entries r on r.team_id = l.team_id and r.active and r.season_id = private.team_current_season(l.team_id)
   where l.mentor_id = (select auth.uid()) and l.status = 'approved' and l.player_id is null
$$;

/** The teams she works with as a whole (approved by the head coach). */
create function private.my_mentor_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.team_id from public.mentor_links l
   where l.mentor_id = (select auth.uid()) and l.status = 'approved' and l.player_id is null
$$;
revoke all on function private.my_mentor_team_ids() from public;
grant execute on function private.my_mentor_team_ids() to authenticated;

create or replace function private.my_mentee_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.team_id from public.mentor_links l
   where l.mentor_id = (select auth.uid()) and l.status = 'approved' and l.player_id is null
  union
  select r.team_id from public.roster_entries r
   where r.player_id in (select private.my_mentee_ids())
$$;

-- A mentor is someone with at least one approval (until then she reads nothing).
create or replace function private.is_mentor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mentors m
                  where m.user_id = (select auth.uid())
                    and exists (select 1 from public.mentor_links l where l.mentor_id = m.user_id and l.status = 'approved'))
$$;

drop table public.mentor_players;

alter table public.mentor_links enable row level security;
-- Not apply_staff_rls: mentors, parents and coaches each see their part, and every
-- change goes through request_mentor() / decide_mentor_link() or a delete below.
create policy "mentor sees her requests" on public.mentor_links for select to authenticated
  using (mentor_id = (select auth.uid()));
create policy "staff see mentor links" on public.mentor_links for select to authenticated
  using ((select private.is_staff()));
create policy "parents see their daughter's mentors" on public.mentor_links for select to authenticated
  using ((player_id is not null and (select private.is_parent_of(player_id)))
         or (player_id is null and status = 'approved' and team_id in (select private.my_parent_team_ids())));
create policy "remove a mentor link" on public.mentor_links for delete to authenticated
  using (mentor_id = (select auth.uid())                                                   -- she withdraws
         or (player_id is null and (select private.is_head_coach()))                       -- whole team: head coach
         or (player_id is not null and ((select private.is_parent_of(player_id)) or (select private.is_admin()))));

-- Parents read the names of the mentors who asked for or work with their daughter.
create policy "parents read their daughter's mentors" on public.mentors for select to authenticated
  using (exists (select 1 from public.mentor_links l
                  where l.mentor_id = mentors.user_id
                    and ((l.player_id is not null and (select private.is_parent_of(l.player_id)))
                         or (l.player_id is null and l.status = 'approved' and l.team_id in (select private.my_parent_team_ids())))));

-- A mentor asks to work with a team (no name) or one player (her name as on the roster).
-- Creates her mentor profile the first time. Returns the team's name.
create function private.request_mentor(p_code text, p_player_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := (select auth.uid());
  v_meta      jsonb;
  v_email     text;
  v_team_id   uuid;
  v_team_name text;
  v_name      text := lower(regexp_replace(trim(coalesce(p_player_name, '')), '\s+', ' ', 'g'));
  v_players   uuid[];
begin
  select u.raw_user_meta_data, u.email into v_meta, v_email from auth.users u where u.id = v_uid;
  if v_uid is null or not (coalesce(v_meta ->> 'role', '') = 'mentor' or exists (select 1 from public.mentors where user_id = v_uid)) then
    raise exception 'only mentor accounts can ask' using errcode = '42501';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'that name is too long' using errcode = '22023';
  end if;
  select t.id, t.name into v_team_id, v_team_name
    from public.teams t where t.is_own_team and t.team_code = private.clean_team_code(p_code);
  if v_team_id is null then
    raise exception 'that team code doesn''t match a team' using errcode = 'P0006';
  end if;

  insert into public.mentors (user_id, display_name, specialty, approved_by)
  values (v_uid,
          left(coalesce(nullif(trim(v_meta ->> 'display_name'), ''), split_part(v_email, '@', 1), 'Mentor'), 80),
          nullif(left(trim(coalesce(v_meta ->> 'specialty', '')), 60), ''),
          null)
  on conflict (user_id) do nothing;

  if v_name = '' then
    insert into public.mentor_links (mentor_id, team_id) values (v_uid, v_team_id)
    on conflict do nothing;
    return v_team_name;
  end if;

  -- her name as the team has it, on the current roster
  select array_agg(distinct p.id) into v_players
    from public.roster_entries r join public.players p on p.id = r.player_id
   where r.team_id = v_team_id and r.active and r.season_id = private.team_current_season(v_team_id)
     and v_name in (lower(p.first_name || ' ' || p.last_name), lower(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name));
  if coalesce(array_length(v_players, 1), 0) = 0 then
    raise exception 'no player by that name on the roster' using errcode = 'P0007';
  end if;
  if array_length(v_players, 1) > 1 then
    raise exception 'more than one player by that name' using errcode = 'P0008';
  end if;
  insert into public.mentor_links (mentor_id, team_id, player_id, player_name)
  select v_uid, v_team_id, p.id, coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name
    from public.players p where p.id = v_players[1]
  on conflict do nothing;
  return v_team_name;
end $$;
select private.expose('private.request_mentor(text,text)');

-- Approve or decline a request: the head coach (whole team), her parents (one player), or an admin.
create function private.decide_mentor_link(p_link_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.mentor_links;
begin
  select * into v_link from public.mentor_links where id = p_link_id for update;
  if v_link.id is null or v_link.status <> 'pending' then
    raise exception 'that request was already decided' using errcode = 'P0002';
  end if;
  if not (case when v_link.player_id is null then (select private.is_head_coach())
               else (select private.is_parent_of(v_link.player_id)) or (select private.is_admin()) end) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.mentor_links
     set status = case when p_approve then 'approved'::public.mentor_link_status else 'declined'::public.mentor_link_status end,
         decided_by = (select auth.uid()), decided_at = now()
   where id = p_link_id;
end $$;
select private.expose('private.decide_mentor_link(uuid,boolean)');

-- Whole-team requests waiting on a head coach (the waiting count on the menu and Dugout).
create function private.mentor_requests_waiting() returns bigint
language sql stable security definer set search_path = '' as $$
  select case when (select private.is_head_coach())
              then (select count(*) from public.mentor_links l where l.status = 'pending' and l.player_id is null)
              else 0::bigint end
$$;
select private.expose('private.mentor_requests_waiting()');

-- Her requests with the team names (she can't read a team until she's approved).
create function private.my_mentor_links()
returns table (id uuid, team_id uuid, team_name text, player_id uuid, player_name text, status public.mentor_link_status, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.team_id, t.name, l.player_id,
         coalesce(case when l.status = 'approved' then (select coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name from public.players p where p.id = l.player_id) end, l.player_name),
         l.status, l.requested_at
    from public.mentor_links l left join public.teams t on t.id = l.team_id
   where l.mentor_id = (select auth.uid())
   order by l.requested_at desc
$$;
select private.expose('private.my_mentor_links()');

-- Admin approval of mentor sign-ups is gone (parents and head coaches approve now).
drop function public.pending_mentors();
drop function private.pending_mentors();

-- -----------------------------------------------------------------------------
-- 2. Messages: private unless the mentor shares one with the coaches
-- -----------------------------------------------------------------------------
alter table public.mentor_messages add column shared_with_coaches boolean not null default false;
comment on column public.mentor_messages.shared_with_coaches is
  'The mentor shared this message with the coaches. Admins and the player''s parents read every message.';

drop policy "staff read every message" on public.mentor_messages;
create policy "admins read every message" on public.mentor_messages for select to authenticated
  using ((select private.is_admin()));
create policy "coaches read shared messages" on public.mentor_messages for select to authenticated
  using (shared_with_coaches and (select private.is_staff()));
create policy "parents read their daughter's messages" on public.mentor_messages for select to authenticated
  using ((select private.is_parent_of(player_id)));
create policy "sender shares or unshares" on public.mentor_messages for update to authenticated
  using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
grant update (shared_with_coaches) on public.mentor_messages to authenticated;

-- Only the sender changes sharing; only the player marks a message read. (Invoker, so
-- current_user is the caller's role, as in private.guard_team_code.)
create function private.guard_mentor_message_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;  -- maintenance as the database owner
  end if;
  if new.shared_with_coaches is distinct from old.shared_with_coaches and old.sender_id is distinct from (select auth.uid()) then
    raise exception 'only the mentor who sent it can share it' using errcode = '42501';
  end if;
  if new.read_at is distinct from old.read_at and not (old.player_id in (select private.my_player_ids())) then
    raise exception 'only the player marks it read' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.guard_mentor_message_update() from public;
create trigger guard_mentor_message_update before update on public.mentor_messages
  for each row execute function private.guard_mentor_message_update();

drop policy "head coaches remove messages" on public.mentor_messages;
create policy "admins and head coaches remove messages they see" on public.mentor_messages for delete to authenticated
  using ((select private.is_admin()) or (shared_with_coaches and (select private.is_head_coach())));

drop policy "message photos: sender, player, staff" on storage.objects;
create policy "message photos: sender, player, parents, admins, shared" on storage.objects for select to authenticated
  using (bucket_id = 'message-photos'
         and (split_part(name, '/', 1) = (select auth.uid())::text
              or (select private.is_admin())
              or name in (select m.photo_path from public.mentor_messages m
                           where m.player_id in (select private.my_player_ids())
                              or (select private.is_parent_of(m.player_id))
                              or (m.shared_with_coaches and (select private.is_staff())))));

-- -----------------------------------------------------------------------------
-- 3. Working with the coaches: notes and focus areas (about a player or the whole team)
-- -----------------------------------------------------------------------------
create table public.mentor_notes (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors (user_id) on delete cascade,  -- whose thread
  player_id   uuid references public.players (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete cascade,
  kind        text not null default 'note' check (kind in ('summary', 'note')),
  discussed_on date,  -- a discussion summary: the day she talked with the coaches
  body        text not null check (char_length(body) between 1 and 2000),
  author_id   uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text not null default '' check (char_length(author_name) <= 80),
  author_role text not null default 'mentor' check (author_role in ('mentor', 'coach', 'admin')),
  created_at  timestamptz not null default now(),
  check (num_nonnulls(player_id, team_id) = 1)
);
comment on table public.mentor_notes is
  'A mentor''s notes with the coaches about a player or the whole team: discussion summaries, notes and coaches'' replies. Not for players.';
create index mentor_notes_player_idx on public.mentor_notes (player_id, created_at desc);
create index mentor_notes_team_idx on public.mentor_notes (team_id, created_at desc);
create index mentor_notes_mentor_idx on public.mentor_notes (mentor_id, created_at desc);
create index mentor_notes_author_idx on public.mentor_notes (author_id);

create table public.mentor_focus (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null default auth.uid() references public.mentors (user_id) on delete cascade,
  player_id   uuid references public.players (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  details     text check (details is null or char_length(details) <= 500),
  status      text not null default 'working_on' check (status in ('working_on', 'working')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (num_nonnulls(player_id, team_id) = 1)
);
comment on table public.mentor_focus is
  'What a mentor is working on with a player or the team (working_on), and what''s working. Coaches read; parents read their daughter''s.';
create index mentor_focus_player_idx on public.mentor_focus (player_id);
create index mentor_focus_team_idx on public.mentor_focus (team_id);
create index mentor_focus_mentor_idx on public.mentor_focus (mentor_id);

-- Who wrote a note always comes from the database.
create function private.mentor_note_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_id := (select auth.uid());
  new.created_at := now();
  if new.mentor_id = (select auth.uid()) then
    new.author_role := 'mentor';
    new.author_name := coalesce((select display_name from public.mentors where user_id = (select auth.uid())), 'Mentor');
  else
    new.author_role := case when (select private.is_admin()) then 'admin' else 'coach' end;
    new.author_name := coalesce((select display_name from public.staff where user_id = (select auth.uid())), 'Coach');
  end if;
  if new.kind <> 'summary' then
    new.discussed_on := null;
  end if;
  return new;
end $$;
revoke all on function private.mentor_note_defaults() from public;
create trigger mentor_note_defaults before insert on public.mentor_notes
  for each row execute function private.mentor_note_defaults();

-- Explicit policies (not apply_staff_rls): the mentor writes her own, head coaches
-- reply, staff read, parents read the ones about their daughter, players see none.
alter table public.mentor_notes enable row level security;
create policy "mentor reads her notes" on public.mentor_notes for select to authenticated
  using (mentor_id = (select auth.uid()));
create policy "staff read mentor notes" on public.mentor_notes for select to authenticated
  using ((select private.is_staff()));
create policy "parents read notes about their daughter" on public.mentor_notes for select to authenticated
  using (player_id is not null and (select private.is_parent_of(player_id)));
create policy "mentor writes about her players and teams" on public.mentor_notes for insert to authenticated
  with check (mentor_id = (select auth.uid()) and (select private.is_mentor())
              and (player_id in (select private.my_mentee_ids()) or team_id in (select private.my_mentor_team_ids())));
create policy "head coaches reply" on public.mentor_notes for insert to authenticated
  with check ((select private.is_head_coach()) and mentor_id <> (select auth.uid()));
create policy "authors and admins remove notes" on public.mentor_notes for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

alter table public.mentor_focus enable row level security;
create policy "mentor reads her focus areas" on public.mentor_focus for select to authenticated
  using (mentor_id = (select auth.uid()));
create policy "staff read focus areas" on public.mentor_focus for select to authenticated
  using ((select private.is_staff()));
create policy "parents read their daughter's focus areas" on public.mentor_focus for select to authenticated
  using (player_id is not null and (select private.is_parent_of(player_id)));
create policy "mentor adds focus areas" on public.mentor_focus for insert to authenticated
  with check (mentor_id = (select auth.uid()) and (select private.is_mentor())
              and (player_id in (select private.my_mentee_ids()) or team_id in (select private.my_mentor_team_ids())));
create policy "mentor updates her focus areas" on public.mentor_focus for update to authenticated
  using (mentor_id = (select auth.uid()))
  with check (mentor_id = (select auth.uid()) and (select private.is_mentor())
              and (player_id in (select private.my_mentee_ids()) or team_id in (select private.my_mentor_team_ids())));
create policy "mentor removes her focus areas" on public.mentor_focus for delete to authenticated
  using (mentor_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 4. Training dates: every approved mentor, for any of her players
-- -----------------------------------------------------------------------------
drop policy "mentor adds dates for her players" on public.player_activities;
create policy "mentor adds dates for her players" on public.player_activities for insert to authenticated
  with check (source = 'mentor' and created_by = (select auth.uid()) and (select private.is_mentor())
              and player_id in (select private.my_mentee_ids()));
drop function private.mentor_can_schedule();
alter table public.mentors drop column can_schedule;
