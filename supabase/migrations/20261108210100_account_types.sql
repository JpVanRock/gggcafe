-- =============================================================================
-- Account types (user, 2026-11-08). Five ways to register, each with its own home:
--   Head Coach      staff role 'coach'      -> /dashboard  (an admin approves)
--   Assistant Coach staff role 'assistant'  -> /dashboard  (a head coach approves)
--   Player          player_claims           -> /me         (a coach approves her claim,
--                                              or her parent creates her login)
--   Parent          parent_links            -> /family     (a coach approves)
--   Mentor          mentors                 -> /mentor     (an admin approves)
-- The admin keeps role 'admin': everything a head coach has, plus staff,
-- mentors and G3 Advanced. Every sign-up confirms its email first (Supabase
-- Auth "Confirm email" is on); parent-made player logins need no email.
--
-- Assistant Coaches edit like coaches, except:
--   - Team Culture and Standards, GameDay, parents and mentors: head coach/admin only
--   - practice plans: they see every plan, but change only the ones they wrote
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role helpers
-- -----------------------------------------------------------------------------
-- Assistants can edit (the standard staff policies), so they keep the shared
-- tools: roster and claims, calendar, drills, budget, player development.
create or replace function private.can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.staff_role()::text in ('coach', 'assistant', 'admin'), false)
$$;

-- Head coach or admin: the tools assistants don't get.
create function private.is_head_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.staff_role()::text in ('coach', 'admin'), false)
$$;
revoke all on function private.is_head_coach() from public;
grant execute on function private.is_head_coach() to authenticated;

-- Swap a table's standard coach write policies (apply_staff_rls) for head-coach ones.
-- Staff still read it.
create function private.apply_head_coach_writes(tbl regclass) returns void
language plpgsql set search_path = '' as $$
begin
  execute format('drop policy if exists "coaches can insert" on %s', tbl);
  execute format('drop policy if exists "coaches can update" on %s', tbl);
  execute format('drop policy if exists "coaches can delete" on %s', tbl);
  execute format(
    'create policy "head coaches can insert" on %s for insert to authenticated with check ((select private.is_head_coach()))', tbl);
  execute format(
    'create policy "head coaches can update" on %s for update to authenticated using ((select private.is_head_coach())) with check ((select private.is_head_coach()))', tbl);
  execute format(
    'create policy "head coaches can delete" on %s for delete to authenticated using ((select private.is_head_coach()))', tbl);
end;
$$;
revoke all on function private.apply_head_coach_writes(regclass) from public;

-- Culture, GameDay, mentor assignments
select private.apply_head_coach_writes('public.team_culture');
select private.apply_head_coach_writes('public.team_standards');
select private.apply_head_coach_writes('public.gameday_profiles');
select private.apply_head_coach_writes('public.gameday_lineups');
select private.apply_head_coach_writes('public.mentor_players');

-- -----------------------------------------------------------------------------
-- Parents: head coaches and admins decide requests, see parents' emails and set
-- the team code.
-- -----------------------------------------------------------------------------
drop policy "coaches decide parent links" on public.parent_links;
create policy "head coaches decide parent links" on public.parent_links for update to authenticated
  using ((select private.is_head_coach())) with check ((select private.is_head_coach()));
drop policy "parents withdraw, coaches remove" on public.parent_links;
create policy "parents withdraw, head coaches remove" on public.parent_links for delete to authenticated
  using (parent_id = (select auth.uid()) or (select private.is_head_coach()));
drop policy "coaches remove parent profiles" on public.parent_accounts;
create policy "head coaches remove parent profiles" on public.parent_accounts for delete to authenticated
  using ((select private.is_head_coach()));

create or replace function private.team_parent_links(p_team_id uuid)
returns table (link_id uuid, parent_name text, email text, child_name text, player_id uuid, status public.parent_link_status, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, a.display_name, u.email::text, l.child_name, l.player_id, l.status, l.requested_at
    from public.parent_links l
    join public.parent_accounts a on a.user_id = l.parent_id
    join auth.users u on u.id = l.parent_id
   where l.team_id = p_team_id and (select private.is_head_coach())
   order by l.status, l.requested_at
$$;

-- Invoker, so current_user is the API role (signed-in users); maintenance as the
-- database owner isn't blocked.
create function private.guard_team_parent_code() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.parent_code is distinct from old.parent_code
     and current_user in ('authenticated', 'anon')
     and not (select private.is_head_coach()) then
    raise exception 'only head coaches change the parent code' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_parent_code before update of parent_code on public.teams
  for each row execute function private.guard_team_parent_code();

-- Waiting approvals per team: parent requests count only for head coaches.
create or replace function private.pending_approvals()
returns table (team_id uuid, team_name text, player_claims bigint, parent_requests bigint)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name,
         (select count(*) from public.player_claims c where c.team_id = t.id and c.status = 'pending'),
         case when (select private.is_head_coach())
              then (select count(*) from public.parent_links l where l.team_id = t.id and l.status = 'pending')
              else 0::bigint end
    from public.teams t
   where t.is_own_team and (select private.can_edit())
     and (exists (select 1 from public.player_claims c where c.team_id = t.id and c.status = 'pending')
          or ((select private.is_head_coach())
              and exists (select 1 from public.parent_links l where l.team_id = t.id and l.status = 'pending')))
   order by t.name
$$;

-- -----------------------------------------------------------------------------
-- Mentors: head coaches and admins remove messages and their photos
-- (assignments are head-coach writes above).
-- -----------------------------------------------------------------------------
drop policy "coaches remove messages" on public.mentor_messages;
create policy "head coaches remove messages" on public.mentor_messages for delete to authenticated
  using ((select private.is_head_coach()));
drop policy "coaches remove message photos" on storage.objects;
create policy "head coaches remove message photos" on storage.objects for delete to authenticated
  using (bucket_id = 'message-photos' and (select private.is_head_coach()));

-- -----------------------------------------------------------------------------
-- Practice plans: every coach sees every plan; assistants change only their own.
-- -----------------------------------------------------------------------------
create function private.can_edit_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.is_head_coach())
      or ((select private.can_edit())
          and exists (select 1 from public.practice_plans p where p.id = p_plan_id and p.created_by = (select auth.uid())))
$$;
revoke all on function private.can_edit_plan(uuid) from public;
grant execute on function private.can_edit_plan(uuid) to authenticated;

drop policy "coaches can insert" on public.practice_plans;
drop policy "coaches can update" on public.practice_plans;
drop policy "coaches can delete" on public.practice_plans;
create policy "coaches add plans" on public.practice_plans for insert to authenticated
  with check ((select private.is_head_coach()) or ((select private.can_edit()) and created_by = (select auth.uid())));
create policy "head coaches, or the assistant who wrote it, change a plan" on public.practice_plans for update to authenticated
  using ((select private.is_head_coach()) or ((select private.can_edit()) and created_by = (select auth.uid())))
  with check ((select private.is_head_coach()) or ((select private.can_edit()) and created_by = (select auth.uid())));
create policy "head coaches, or the assistant who wrote it, remove a plan" on public.practice_plans for delete to authenticated
  using ((select private.is_head_coach()) or ((select private.can_edit()) and created_by = (select auth.uid())));

do $$
declare t text;
begin
  foreach t in array array['public.practice_plan_drills', 'public.practice_plan_positions'] loop
    execute format('drop policy "coaches can insert" on %s', t);
    execute format('drop policy "coaches can update" on %s', t);
    execute format('drop policy "coaches can delete" on %s', t);
    execute format('create policy "plan editors add" on %s for insert to authenticated with check ((select private.can_edit_plan(plan_id)))', t);
    execute format('create policy "plan editors change" on %s for update to authenticated using ((select private.can_edit_plan(plan_id))) with check ((select private.can_edit_plan(plan_id)))', t);
    execute format('create policy "plan editors remove" on %s for delete to authenticated using ((select private.can_edit_plan(plan_id)))', t);
  end loop;
end $$;

-- Assistants are on the coaching staff a plan can be shared with.
create or replace function private.coaching_staff()
returns table (user_id uuid, display_name text, email text)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.display_name, u.email::text
    from public.staff s
    join auth.users u on u.id = s.user_id
   where s.role::text in ('coach', 'assistant', 'admin')
     and (select private.can_edit())
   order by s.display_name
$$;

-- -----------------------------------------------------------------------------
-- Coach sign-ups: Head Coaches wait for an admin; Assistant Coaches for a head
-- coach (or admin). Approval adds them to public.staff.
-- -----------------------------------------------------------------------------
create table public.staff_requests (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role         text not null check (role in ('coach', 'assistant')),
  team_id      uuid references public.teams (id) on delete set null,       -- assistants: the team they coach with
  note         text check (note is null or char_length(note) <= 120),     -- head coaches: their team or organization
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  decided_by   uuid references auth.users (id) on delete set null,
  decided_at   timestamptz
);
comment on table public.staff_requests is
  'Coach sign-ups waiting for approval. Written only by request_staff_access() and decide_staff_request().';
-- RLS exception (no apply_staff_rls): the person asking reads her own request; staff read all;
-- nobody writes rows directly.
alter table public.staff_requests enable row level security;
create policy "see your own request, staff see all" on public.staff_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- Ask to join as a coach (called on the first sign-in after confirming the email).
-- Returns 'staff' if she's already on staff, else the request's status.
create function private.request_staff_access(p_role text, p_name text, p_team_id uuid, p_note text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_status text;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff where user_id = v_uid) then
    return 'staff';
  end if;
  select status into v_status from public.staff_requests where user_id = v_uid;
  if found then
    return v_status;
  end if;
  if p_role not in ('coach', 'assistant') then
    raise exception 'choose head coach or assistant coach' using errcode = '22023';
  end if;
  if coalesce(trim(p_name), '') = '' or char_length(trim(p_name)) > 80 then
    raise exception 'enter your name' using errcode = '22023';
  end if;
  if p_role = 'assistant' and not exists (select 1 from public.teams where id = p_team_id and is_own_team) then
    raise exception 'choose your team' using errcode = '22023';
  end if;
  insert into public.staff_requests (user_id, display_name, role, team_id, note)
  values (v_uid, trim(p_name), p_role, case when p_role = 'assistant' then p_team_id end,
          nullif(left(trim(coalesce(p_note, '')), 120), ''));
  return 'pending';
end;
$$;
revoke all on function private.request_staff_access(text, text, uuid, text) from public;
grant execute on function private.request_staff_access(text, text, uuid, text) to authenticated;
create function public.request_staff_access(p_role text, p_name text, p_team_id uuid default null, p_note text default null) returns text
language sql security invoker set search_path = '' as $$ select private.request_staff_access(p_role, p_name, p_team_id, p_note) $$;
revoke all on function public.request_staff_access(text, text, uuid, text) from public, anon;
grant execute on function public.request_staff_access(text, text, uuid, text) to authenticated;

-- Requests the signed-in user may decide: admins all; head coaches assistants.
create function private.staff_requests_to_decide()
returns table (user_id uuid, display_name text, email text, role text, team_id uuid, team_name text, note text, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.user_id, r.display_name, u.email::text, r.role, r.team_id, t.name, r.note, r.requested_at
    from public.staff_requests r
    join auth.users u on u.id = r.user_id
    left join public.teams t on t.id = r.team_id
   where r.status = 'pending'
     and not exists (select 1 from public.staff s where s.user_id = r.user_id)
     and ((select private.is_admin()) or (r.role = 'assistant' and (select private.is_head_coach())))
   order by r.requested_at
$$;
revoke all on function private.staff_requests_to_decide() from public;
grant execute on function private.staff_requests_to_decide() to authenticated;
create function public.staff_requests_to_decide()
returns table (user_id uuid, display_name text, email text, role text, team_id uuid, team_name text, note text, requested_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.staff_requests_to_decide() $$;
revoke all on function public.staff_requests_to_decide() from public, anon;
grant execute on function public.staff_requests_to_decide() to authenticated;

create function private.decide_staff_request(p_user_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.staff_requests;
begin
  select * into v_req from public.staff_requests where user_id = p_user_id and status = 'pending' for update;
  if not found then
    raise exception 'that request isn''t waiting' using errcode = 'P0002';
  end if;
  if not ((select private.is_admin()) or (v_req.role = 'assistant' and (select private.is_head_coach()))) then
    raise exception 'only an admin approves head coaches; head coaches approve assistant coaches' using errcode = '42501';
  end if;
  if p_approve then
    insert into public.staff (user_id, display_name, role)
    values (v_req.user_id, v_req.display_name, v_req.role::public.staff_role)
    on conflict (user_id) do nothing;
  end if;
  update public.staff_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_by = (select auth.uid()), decided_at = now()
   where user_id = p_user_id;
end;
$$;
revoke all on function private.decide_staff_request(uuid, boolean) from public;
grant execute on function private.decide_staff_request(uuid, boolean) to authenticated;
create function public.decide_staff_request(p_user_id uuid, p_approve boolean) returns void
language sql security invoker set search_path = '' as $$ select private.decide_staff_request(p_user_id, p_approve) $$;
revoke all on function public.decide_staff_request(uuid, boolean) from public, anon;
grant execute on function public.decide_staff_request(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Player logins a parent creates (for a daughter without an email address)
-- -----------------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Placeholder sign-in address for a username: never receives mail (.invalid).
-- Keep in step with PLAYER_LOGIN_DOMAIN in src/lib/player-logins.ts.
create function private.player_login_email(p_username text) returns text
language sql immutable set search_path = '' as $$
  select lower(trim(p_username)) || '@player.gggcafe.invalid'
$$;

-- An approved parent of this player (coach-matched).
create function private.is_parent_of(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.parent_links l
                  where l.parent_id = (select auth.uid()) and l.player_id = p_player_id and l.status = 'approved')
$$;
revoke all on function private.is_parent_of(uuid) from public;
grant execute on function private.is_parent_of(uuid) to authenticated;

create table public.player_logins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  player_id  uuid not null unique references public.players (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  created_by uuid references auth.users (id) on delete set null,   -- the parent
  created_at timestamptz not null default now()
);
comment on table public.player_logins is
  'Username logins parents made for their daughters. Written only by create_player_login().';
-- RLS exception: her approved parents, the player herself and staff read it; nobody writes directly.
alter table public.player_logins enable row level security;
create policy "her parents, herself and staff read it" on public.player_logins for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()) or (select private.is_parent_of(player_id)));

-- Validation shared by create and reset.
create function private.check_player_password(p_password text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if char_length(coalesce(p_password, '')) < 8 or octet_length(p_password) > 72 then
    raise exception 'use a password of 8 to 72 characters' using errcode = '22023';
  end if;
end;
$$;

-- A parent creates her daughter's login. She must be on the official roster
-- (the team's current season, active) that the head coach built, and the
-- coach must have approved this parent for her. The login is confirmed and
-- her profile claim approved right away (the coach already matched the parent).
create function private.create_player_login(p_player_id uuid, p_username text, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_parent uuid := (select auth.uid());
  v_team   uuid;
  v_entry  public.roster_entries;
  v_player public.players;
  v_name   text := lower(trim(coalesce(p_username, '')));
  v_email  text;
  v_user   uuid := gen_random_uuid();
begin
  if v_parent is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select l.team_id into v_team
    from public.parent_links l
   where l.parent_id = v_parent and l.player_id = p_player_id and l.status = 'approved'
   order by l.decided_at desc nulls last
   limit 1;
  if v_team is null then
    raise exception 'only her approved parent can create her login' using errcode = '42501';
  end if;
  select r.* into v_entry
    from public.roster_entries r
   where r.team_id = v_team and r.player_id = p_player_id and r.active
     and r.season_id = private.team_current_season(v_team);
  if v_entry.id is null then
    raise exception 'she isn''t on the team''s current roster' using errcode = 'P0006';
  end if;
  if exists (select 1 from public.player_logins where player_id = p_player_id) then
    raise exception 'she already has a login' using errcode = '23505';
  end if;
  if exists (select 1 from public.player_claims c where c.roster_entry_id = v_entry.id and c.status = 'approved') then
    raise exception 'she already has her own account' using errcode = 'P0007';
  end if;
  if v_name !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'usernames are 3 to 30 letters, numbers, dots, dashes or underscores' using errcode = '22023';
  end if;
  perform private.check_player_password(p_password);
  v_email := private.player_login_email(v_name);
  if exists (select 1 from public.player_logins where username = v_name)
     or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'that username is taken' using errcode = '23505';
  end if;
  select * into v_player from public.players where id = p_player_id;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
          '', '', '', '',
          '{"provider": "email", "providers": ["email"]}'::jsonb,
          jsonb_build_object('display_name', coalesce(v_player.preferred_name, v_player.first_name) || ' ' || v_player.last_name,
                             'role', 'player', 'username', v_name),
          now(), now());
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_user::text, v_user,
          jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());
  insert into public.player_logins (user_id, player_id, username, created_by)
  values (v_user, p_player_id, v_name, v_parent);
  insert into public.player_claims (user_id, team_id, season_id, roster_entry_id, typed_name, typed_jersey, status, decided_by, decided_at)
  values (v_user, v_team, v_entry.season_id, v_entry.id,
          coalesce(v_player.preferred_name, v_player.first_name) || ' ' || v_player.last_name,
          case when v_entry.jersey_number ~ '^\d{1,2}$' then v_entry.jersey_number end,
          'approved', v_parent, now());
  return v_name;
end;
$$;
revoke all on function private.create_player_login(uuid, text, text) from public;
grant execute on function private.create_player_login(uuid, text, text) to authenticated;
create function public.create_player_login(p_player_id uuid, p_username text, p_password text) returns text
language sql security invoker set search_path = '' as $$ select private.create_player_login(p_player_id, p_username, p_password) $$;
revoke all on function public.create_player_login(uuid, text, text) from public, anon;
grant execute on function public.create_player_login(uuid, text, text) to authenticated;

-- Her parent (or a head coach/admin) sets a new password for a parent-made login.
create function private.reset_player_password(p_player_id uuid, p_password text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.player_logins where player_id = p_player_id;
  if v_user is null then
    raise exception 'she has no username login' using errcode = 'P0002';
  end if;
  if not ((select private.is_parent_of(p_player_id)) or (select private.is_head_coach())) then
    raise exception 'only her parent or a head coach can reset it' using errcode = '42501';
  end if;
  perform private.check_player_password(p_password);
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now()
   where id = v_user;
end;
$$;
revoke all on function private.reset_player_password(uuid, text) from public;
grant execute on function private.reset_player_password(uuid, text) to authenticated;
create function public.reset_player_password(p_player_id uuid, p_password text) returns void
language sql security invoker set search_path = '' as $$ select private.reset_player_password(p_player_id, p_password) $$;
revoke all on function public.reset_player_password(uuid, text) from public, anon;
grant execute on function public.reset_player_password(uuid, text) to authenticated;

-- The signed-in parent's daughters (approved links) and their sign-in status.
create function private.parent_player_logins()
returns table (player_id uuid, player_name text, team_name text, on_roster boolean, username text, has_account boolean)
language sql stable security definer set search_path = '' as $$
  select distinct on (l.player_id)
         l.player_id,
         coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name,
         t.name,
         exists (select 1 from public.roster_entries r
                  where r.team_id = l.team_id and r.player_id = l.player_id and r.active
                    and r.season_id = private.team_current_season(l.team_id)),
         pl.username,
         pl.user_id is not null
           or exists (select 1 from public.player_claims c join public.roster_entries r on r.id = c.roster_entry_id
                       where r.player_id = l.player_id and c.status = 'approved')
    from public.parent_links l
    join public.players p on p.id = l.player_id
    join public.teams t on t.id = l.team_id
    left join public.player_logins pl on pl.player_id = l.player_id
   where l.parent_id = (select auth.uid()) and l.status = 'approved'
   order by l.player_id, l.decided_at desc nulls last
$$;
revoke all on function private.parent_player_logins() from public;
grant execute on function private.parent_player_logins() to authenticated;
create function public.parent_player_logins()
returns table (player_id uuid, player_name text, team_name text, on_roster boolean, username text, has_account boolean)
language sql stable security invoker set search_path = '' as $$ select * from private.parent_player_logins() $$;
revoke all on function public.parent_player_logins() from public, anon;
grant execute on function public.parent_player_logins() to authenticated;
