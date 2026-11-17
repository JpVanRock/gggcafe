-- =============================================================================
-- GGG.Cafe — Parent codes: parents get in without waiting for the head coach (user, 2026-11-16)
--   * Each team gets a second code just for parents (team_parent_codes). Players use the team code
--     and never see this one: staff read it, only head coaches change it. A code is never both.
--   * request_parent_link: with the parent code, a parent whose daughter's name matches exactly one
--     player on the team's current roster is approved at once, and the head coaches and admins get
--     a notification. Everything else waits for the head coach as before: a name that matches no one
--     (or two players), the team code, or a parent the head coach declined on that team.
--   * Player accounts (her own login, or a claim on a roster spot) can't join as a parent.
--   * rematch_parent_link: a parent corrects the daughter's name on a request that's waiting.
--   * set_daughter_birth_date: an approved parent fills in a missing birth date, so they can make
--     her login without waiting for the coach.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The parent code
-- -----------------------------------------------------------------------------
create table public.team_parent_codes (
  team_id    uuid primary key references public.teams (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  updated_at timestamptz not null default now()
);
comment on table public.team_parent_codes is
  'Each team''s parent sign-up code (no row: parents can''t join with a code). Staff read it, head coaches change it; players never see it.';
select private.apply_staff_rls('public.team_parent_codes');
select private.apply_head_coach_writes('public.team_parent_codes');

-- A code means one thing: a parent code is never also a team code, and the other way round.
create function private.guard_signup_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'team_parent_codes' then
    if exists (select 1 from public.teams where team_code = new.code) then
      raise exception 'that code is in use' using errcode = '23505';
    end if;
  elsif new.team_code is not null and exists (select 1 from public.team_parent_codes where code = new.team_code) then
    raise exception 'that code is in use' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function private.guard_signup_code() from public;
create trigger team_parent_codes_unique before insert or update of code on public.team_parent_codes
  for each row execute function private.guard_signup_code();
create trigger teams_team_code_unique before insert or update of team_code on public.teams
  for each row execute function private.guard_signup_code();

-- Teams with sign-up on get a parent code now (same alphabet as the app: no 0/O or 1/I).
do $$
declare
  v_team uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  for v_team in select id from public.teams where is_own_team and team_code is not null loop
    loop
      select string_agg(substr(v_alphabet, 1 + get_byte(x.b, i) % 32, 1), '' order by i)
        into v_code
        from (select extensions.gen_random_bytes(6) as b) x, generate_series(0, 5) as i;
      exit when not exists (select 1 from public.teams where team_code = v_code)
            and not exists (select 1 from public.team_parent_codes where code = v_code);
    end loop;
    insert into public.team_parent_codes (team_id, code) values (v_team, v_code);
  end loop;
end $$;

-- Sign-up: the team a parent code belongs to (nothing for a wrong code). Signed-out visitors call
-- it, so it returns only the team's id and name, like signup_team().
create function private.signup_parent_team(p_code text) returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name
    from public.team_parent_codes c join public.teams t on t.id = c.team_id
   where t.is_own_team and c.code = private.clean_team_code(p_code)
$$;
select private.expose('private.signup_parent_team(text)', array['anon', 'authenticated']);

-- -----------------------------------------------------------------------------
-- Joining with it
-- -----------------------------------------------------------------------------
alter table public.parent_links add column via_parent_code boolean not null default false;
comment on column public.parent_links.via_parent_code is
  'Asked with the parent code: approved at once when the name matches one player on the current roster.';

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('player-of-the-week', 'video-call', 'parent-joined'));

-- A name as people type it: lower case, accents and apostrophes dropped, anything else between
-- words one space. "Zoë O'Neil-Smith" and "zoe oneil smith" are the same.
create function private.name_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(
           translate(replace(replace(lower(coalesce(p_name, '')), '''', ''), '’', ''),
                     'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūñçýÿ', 'aaaaaaaeeeeeiiiiiooooooouuuuuncyy'),
           '[^a-z0-9]+', ' ', 'g'))
$$;
revoke all on function private.name_key(text) from public;

-- Approves a waiting request asked with the parent code when its name matches exactly one player
-- on the team's current roster (first or preferred name, and last name), and tells the head coaches
-- and admins. A parent the head coach declined on this team keeps waiting for the head coach.
-- Returns the request's status (approved also when they were already her parent on the team).
create function private.match_parent_link(p_link_id uuid) returns public.parent_link_status
language plpgsql security definer set search_path = '' as $$
declare
  v_link    public.parent_links;
  v_players uuid[];
  v_parent  text;
  v_team    text;
  v_player  text;
begin
  select * into v_link from public.parent_links where id = p_link_id;
  if v_link.id is null or v_link.status <> 'pending' or not v_link.via_parent_code then
    return v_link.status;
  end if;
  if exists (select 1 from public.parent_links
              where parent_id = v_link.parent_id and team_id = v_link.team_id and status = 'declined') then
    return 'pending';
  end if;
  select array_agg(distinct r.player_id) into v_players
    from public.roster_entries r
    join public.players p on p.id = r.player_id
   where r.team_id = v_link.team_id and r.active
     and r.season_id = private.team_current_season(v_link.team_id)
     and private.name_key(v_link.child_name) in (private.name_key(p.first_name || ' ' || p.last_name),
                                                 private.name_key(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name));
  if coalesce(cardinality(v_players), 0) <> 1 then
    return 'pending';
  end if;
  -- already her approved parent on this team (asked with another spelling): keep the one link
  if exists (select 1 from public.parent_links
              where parent_id = v_link.parent_id and team_id = v_link.team_id
                and player_id = v_players[1] and status = 'approved') then
    delete from public.parent_links where id = p_link_id;
    return 'approved';
  end if;
  update public.parent_links
     set status = 'approved', player_id = v_players[1], decided_by = null, decided_at = now()
   where id = p_link_id;

  select display_name into v_parent from public.parent_accounts where user_id = v_link.parent_id;
  select name into v_team from public.teams where id = v_link.team_id;
  select coalesce(preferred_name, first_name) || ' ' || last_name into v_player from public.players where id = v_players[1];
  insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
  select s.user_id, 'parent-joined',
         left(v_parent || ' joined as ' || v_player || '''s parent', 200),
         left(v_parent || ' joined ' || v_team || ' with the parent code. Not right? Remove their access on the Parents tab and make a new parent code.', 500),
         '/dugout/parents?team=' || v_link.team_id, v_link.team_id, v_players[1]
    from public.staff s
   where s.role in ('coach', 'admin');
  return 'approved';
end $$;
revoke all on function private.match_parent_link(uuid) from public;

-- A parent asks to join a team with the parent code (approved at once when her name matches the
-- roster) or the team code (the head coach approves). Returns the team's name.
create or replace function private.request_parent_link(p_code text, p_child_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_me        uuid := (select auth.uid());
  v_code      text := private.clean_team_code(p_code);
  v_team_id   uuid;
  v_team_name text;
  v_via       boolean := false;
  v_link      uuid;
begin
  if not exists (select 1 from public.parent_accounts where user_id = v_me) then
    raise exception 'create your parent profile first' using errcode = 'P0005';
  end if;
  -- a player's own account (her login, or a claim on her roster spot) stays a player account
  if exists (select 1 from public.player_logins where user_id = v_me)
     or exists (select 1 from public.player_claims where user_id = v_me and status <> 'declined') then
    raise exception 'player accounts can''t join as a parent' using errcode = 'P0011';
  end if;
  if coalesce(trim(p_child_name), '') = '' or char_length(trim(p_child_name)) > 80 then
    raise exception 'enter your daughter''s name' using errcode = '22023';
  end if;
  select t.id, t.name into v_team_id, v_team_name
    from public.team_parent_codes c join public.teams t on t.id = c.team_id
   where c.code = v_code and t.is_own_team;
  if v_team_id is not null then
    v_via := true;
  else
    select id, name into v_team_id, v_team_name from public.teams where team_code = v_code and is_own_team;
  end if;
  if v_team_id is null then
    raise exception 'that team code doesn''t match a team' using errcode = 'P0006';
  end if;
  -- a few daughters, not a way to try names against the roster
  if (select count(*) from public.parent_links where parent_id = v_me and team_id = v_team_id) >= 6 then
    raise exception 'too many requests for this team' using errcode = '54000';
  end if;

  insert into public.parent_links (parent_id, team_id, child_name, via_parent_code)
  values (v_me, v_team_id, trim(p_child_name), v_via)
  on conflict do nothing
  returning id into v_link;
  if v_link is null and v_via then
    -- asked before with the team code: the parent code now counts for that request
    update public.parent_links set via_parent_code = true
     where parent_id = v_me and team_id = v_team_id and lower(child_name) = lower(trim(p_child_name)) and status = 'pending'
    returning id into v_link;
  end if;
  if v_link is not null then
    perform private.match_parent_link(v_link);
  end if;
  return v_team_name;
end;
$$;

-- A parent corrects the daughter's name on a request that's waiting (and with the parent code,
-- it's matched again). Returns the request's status.
create function private.rematch_parent_link(p_link_id uuid, p_child_name text) returns public.parent_link_status
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(trim(p_child_name), '') = '' or char_length(trim(p_child_name)) > 80 then
    raise exception 'enter your daughter''s name' using errcode = '22023';
  end if;
  update public.parent_links set child_name = trim(p_child_name)
   where id = p_link_id and parent_id = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'that request isn''t waiting' using errcode = 'P0002';
  end if;
  return private.match_parent_link(p_link_id);
end $$;
select private.expose('private.rematch_parent_link(uuid, text)');

-- -----------------------------------------------------------------------------
-- Her birth date, from her parent
-- -----------------------------------------------------------------------------
-- An approved parent fills in a missing birth date (her login needs it, and under 13 her parent's
-- verified consent). Only when it's missing: a date on her profile stays the coach's to change.
create function private.set_daughter_birth_date(p_player_id uuid, p_birth_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.parent_links
                  where parent_id = (select auth.uid()) and player_id = p_player_id and status = 'approved') then
    raise exception 'only her approved parent can do that' using errcode = '42501';
  end if;
  if p_birth_date is null or p_birth_date > (current_date - interval '4 years')::date
     or p_birth_date < (current_date - interval '25 years')::date then
    raise exception 'check her birth date' using errcode = '22023';
  end if;
  update public.players set birth_date = p_birth_date where id = p_player_id and birth_date is null;
  if not found then
    raise exception 'her birth date is already on her profile' using errcode = 'P0002';
  end if;
end $$;
select private.expose('private.set_daughter_birth_date(uuid, date)');
