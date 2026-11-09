-- =============================================================================
-- GGG.Cafe — Team codes for sign-up, private team logos
--   * One team code per team (it was the parent code): players, parents and assistant
--     coaches enter it on the sign-up page, and a coach still approves every request.
--     The team list signed-out visitors could read (signup_teams) is gone: signup_team()
--     answers only for a code that matches, with that one team.
--   * Team logos move to a private bucket. Only signed-in users can load them (the app
--     signs short-lived links), so teams keep the file path instead of a public URL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Team codes
-- -----------------------------------------------------------------------------
alter table public.teams rename column parent_code to team_code;
alter table public.teams rename constraint teams_parent_code_check to teams_team_code_check;
alter table public.teams rename constraint teams_parent_code_key to teams_team_code_key;

-- "abc-234", "ABC 234" and "ABC234" are the same code.
create function private.clean_team_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;
revoke all on function private.clean_team_code(text) from public;

-- Sign-up: the team a code belongs to (nothing for a wrong code or a team with sign-up off).
-- Signed-out visitors call it, so it returns only the team's id and name.
create function private.signup_team(p_code text) returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name from public.teams t
   where t.is_own_team and t.team_code = private.clean_team_code(p_code)
$$;
select private.expose('private.signup_team(text)', array['anon', 'authenticated']);

drop function public.signup_teams();
drop function private.signup_teams();

-- A parent asks to join a team with its code. Returns the team's name.
create or replace function private.request_parent_link(p_code text, p_child_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_team_id   uuid;
  v_team_name text;
begin
  if not exists (select 1 from public.parent_accounts where user_id = (select auth.uid())) then
    raise exception 'create your parent profile first' using errcode = 'P0005';
  end if;
  if coalesce(trim(p_child_name), '') = '' or char_length(trim(p_child_name)) > 80 then
    raise exception 'enter your daughter''s name' using errcode = '22023';
  end if;
  select id, name into v_team_id, v_team_name
    from public.teams
   where team_code = private.clean_team_code(p_code) and is_own_team;
  if v_team_id is null then
    raise exception 'that team code doesn''t match a team' using errcode = 'P0006';
  end if;
  insert into public.parent_links (parent_id, team_id, child_name)
  values ((select auth.uid()), v_team_id, trim(p_child_name))
  on conflict do nothing;
  return v_team_name;
end;
$$;

-- Only head coaches change the code (the API roles; maintenance as the database owner isn't blocked).
drop trigger guard_parent_code on public.teams;
drop function private.guard_team_parent_code();
create function private.guard_team_code() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.team_code is distinct from old.team_code
     and current_user in ('authenticated', 'anon')
     and not (select private.is_head_coach()) then
    raise exception 'only head coaches change the team code' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_team_code() from public;
create trigger guard_team_code before update of team_code on public.teams
  for each row execute function private.guard_team_code();

-- -----------------------------------------------------------------------------
-- Private team logos
-- -----------------------------------------------------------------------------
-- path inside the team-logos bucket: '<team id>/<timestamp>.png'
alter table public.teams
  add column logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9]+\.(png|jpg|jpeg|webp)$');
update public.teams
   set logo_path = substring(logo_url from '/team-logos/([0-9a-f-]{36}/[0-9]+\.(?:png|jpg|jpeg|webp))$')
 where logo_url is not null;

-- The Yearbook's team block carries the path now.
create or replace function private.team_yearbook(p_team_id uuid, p_season_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_access text := private.yearbook_access(p_team_id);
  v_season uuid := coalesce(p_season_id, private.team_current_season(p_team_id));
begin
  if v_access is null then
    raise exception 'The Yearbook is part of G3 Advanced.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'access', v_access,
    'team', (select jsonb_build_object('id', t.id, 'name', t.name, 'logo_path', t.logo_path) from public.teams t where t.id = p_team_id),
    'season', (select jsonb_build_object('id', s.id, 'name', s.name) from public.seasons s where s.id = v_season),
    'seasons', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'photos', x.n) order by s.start_date desc nulls last), '[]'::jsonb)
        from (select season_id, count(*) as n from public.yearbook_photos where team_id = p_team_id group by season_id) x
        join public.seasons s on s.id = x.season_id
    ),
    'roster', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'player_id', p.id, 'name', coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name, 'jersey', r.jersey_number
             ) order by p.last_name, p.first_name), '[]'::jsonb)
        from (select distinct on (player_id) player_id, jersey_number from public.roster_entries
               where team_id = p_team_id and season_id = v_season order by player_id, active desc) r
        join public.players p on p.id = r.player_id
    ),
    'photos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', ph.id, 'path', ph.path, 'thumb_path', ph.thumb_path, 'width', ph.width, 'height', ph.height,
               'caption', ph.caption, 'taken_on', ph.taken_on, 'created_at', ph.created_at,
               'uploader_name', ph.uploader_name, 'mine', ph.uploaded_by = (select auth.uid()),
               'tags', (
                 select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'name', coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name)
                                           order by p.last_name), '[]'::jsonb)
                   from public.yearbook_photo_tags tg join public.players p on p.id = tg.player_id
                  where tg.photo_id = ph.id)
             ) order by coalesce(ph.taken_on, ph.created_at::date) desc, ph.created_at desc), '[]'::jsonb)
        from public.yearbook_photos ph
       where ph.team_id = p_team_id and ph.season_id = v_season
    )
  );
end $$;

alter table public.teams drop column logo_url;

-- Signed-in users only: the public link stops working, the app hands out signed links.
update storage.buckets set public = false where id = 'team-logos';
create policy "signed-in users view team logos" on storage.objects
  for select to authenticated
  using (bucket_id = 'team-logos');
