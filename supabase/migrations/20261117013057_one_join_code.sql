-- =============================================================================
-- GGG.Cafe — One code to join a team: the parent code (user, 2026-11-16)
--   "Lets go with one code the parents code to join a team. Players will never be given this code."
--   * Parents, assistant coaches and mentors join with the team's parent code (team_parent_codes).
--     Parents are in at once when the daughter's name matches the roster; assistant coaches and
--     mentors still wait for approval. Players never get a code: a parent makes every player login.
--   * Nobody signs up with a code any more: each account enters it after signing in.
--   * The team code is retired. Players were given it, so every team's is cleared and the app no
--     longer makes one. (The column stays, and the functions still read it, for the database tests.)
-- =============================================================================

comment on table public.team_parent_codes is
  'Each team''s one join code (no row: no one can join with a code): parents, assistant coaches and mentors enter it; players never get it. Staff read it, head coaches change it.';

-- A mentor asks with the parent code (a team code still matches, but no team has one now).
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
  if v_uid is null or not (coalesce(v_meta ->> 'role', '') = 'mentor' or exists (select 1 from public.mentors where user_id = v_uid)) then
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

-- The team code is retired: players have it, and it no longer opens anything.
update public.teams set team_code = null where team_code is not null;
comment on column public.teams.team_code is
  'Retired 2026-11-16: no team has one and the app doesn''t make one. Joining uses the parent code (team_parent_codes).';
