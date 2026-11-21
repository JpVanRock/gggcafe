-- =============================================================================
-- Sign-up roles (Supabase best-practice review, 2026-11-21)
-- request_mentor() let an account ask to mentor when its user metadata said role = mentor.
-- Users can change their own metadata at any time (supabase.auth.updateUser), so a player or
-- parent account could relabel itself and send mentor requests (they still needed the parents'
-- or head coach's approval). The role an account signed up as is now kept here, written once by
-- a trigger when the account is created, and request_mentor() reads it from here. The metadata
-- still supplies display text (name, specialty); nothing decides access from it.
-- Accounts made before today get their role as it stands now.
-- =============================================================================

create table private.signup_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role ~ '^[a-z-]{1,20}$'),   -- head-coach, assistant-coach, player, parent, mentor
  created_at timestamptz not null default now()
);
revoke all on private.signup_roles from public, anon, authenticated;

-- Like record_signup_terms(): never blocks a sign-up, skips a missing or odd role.
create function private.record_signup_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'role' ~ '^[a-z-]{1,20}$' then
    insert into private.signup_roles (user_id, role, created_at)
    values (new.id, new.raw_user_meta_data ->> 'role', coalesce(new.created_at, now()))
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.record_signup_role() from public;
create trigger record_signup_role after insert on auth.users
  for each row execute function private.record_signup_role();

insert into private.signup_roles (user_id, role, created_at)
select id, raw_user_meta_data ->> 'role', coalesce(created_at, now())
  from auth.users
 where raw_user_meta_data ->> 'role' ~ '^[a-z-]{1,20}$'
on conflict do nothing;

-- As in migration 20261117013057, except who may ask: an account made as a mentor, or one that
-- already has a mentor profile.
create or replace function private.request_mentor(p_code text, p_player_name text) returns text
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
  if v_uid is null or not (exists (select 1 from private.signup_roles where user_id = v_uid and role = 'mentor')
                            or exists (select 1 from public.mentors where user_id = v_uid)) then
    raise exception 'only mentor accounts can ask' using errcode = '42501';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'that name is too long' using errcode = '22023';
  end if;
  select t.id, t.name into v_team_id, v_team_name
    from public.team_parent_codes c join public.teams t on t.id = c.team_id
   where t.is_own_team and c.code = private.clean_team_code(p_code);
  if v_team_id is null then
    select t.id, t.name into v_team_id, v_team_name
      from public.teams t where t.is_own_team and t.team_code = private.clean_team_code(p_code);
  end if;
  if v_team_id is null then
    raise exception 'that code doesn''t match a team' using errcode = 'P0006';
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
