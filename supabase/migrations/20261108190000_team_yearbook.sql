-- =============================================================================
-- GGG.Cafe — Team Yearbook (user, 2026-11-08): a G3 Advanced feature
--
-- Season photos per team, uploaded by coaches/admins and by parents, tagged with
-- players' names (search by player). Who sees a team's yearbook:
--   coaches/admins: manage (add, tag, caption, remove any)   view-only staff: view
--   a parent whose approved daughter on that team has G3 Advanced: add (and
--     tag/caption/remove her own uploads)
--   a player on the team with G3 Advanced: view
-- Photos live in the private bucket yearbook-photos at
-- <team>/<season>/<timestamp>-<random>.jpg (+ a small _t.jpg thumbnail), both
-- shrunk in the browser. Players and parents can't read other players' rows, so
-- teammates' names come only through public.team_yearbook().
-- =============================================================================

create table public.yearbook_photos (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  season_id     uuid not null references public.seasons (id) on delete cascade,
  path          text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]{10,16}-[a-z0-9]{4,12}\.jpg$'),
  thumb_path    text not null unique check (thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]{10,16}-[a-z0-9]{4,12}_t\.jpg$'),
  width         integer check (width is null or width between 1 and 10000),
  height        integer check (height is null or height between 1 and 10000),
  caption       text check (caption is null or char_length(caption) <= 300),
  taken_on      date,
  uploaded_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  uploader_name text not null default '' check (char_length(uploader_name) <= 80),
  created_at    timestamptz not null default now(),
  check (split_part(path, '/', 1) = team_id::text and split_part(path, '/', 2) = season_id::text)
);
create index yearbook_photos_team_idx on public.yearbook_photos (team_id, season_id, created_at desc);
comment on table public.yearbook_photos is
  'Team Yearbook photos (G3 Advanced). Coaches/admins and parents of G3 Advanced players add them; see private.yearbook_access().';

create table public.yearbook_photo_tags (
  photo_id  uuid not null references public.yearbook_photos (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  primary key (photo_id, player_id)
);
create index yearbook_photo_tags_player_idx on public.yearbook_photo_tags (player_id);
comment on table public.yearbook_photo_tags is 'Players tagged in a yearbook photo (search by player).';

-- 'manage' | 'add' | 'view' | null for the signed-in user and a team.
create function private.yearbook_access(p_team_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when (select private.can_edit()) then 'manage'
    when (select private.is_staff()) then 'view'
    when exists (
      select 1 from public.parent_links l
       where l.parent_id = (select auth.uid()) and l.team_id = p_team_id and l.status = 'approved'
         and l.player_id is not null and private.has_advanced(l.player_id)
    ) then 'add'
    when exists (
      select 1 from public.roster_entries r
       where r.team_id = p_team_id and r.player_id in (select private.my_player_ids()) and private.has_advanced(r.player_id)
    ) then 'view'
  end
$$;
create function private.uuid_or_null(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;
-- Is the player on the team's roster (any season)? Parents can't read rosters, so tags check through this.
create function private.on_team(p_team_id uuid, p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.roster_entries where team_id = p_team_id and player_id = p_player_id)
$$;
revoke all on function private.yearbook_access(uuid), private.uuid_or_null(text), private.on_team(uuid, uuid) from public;
grant execute on function private.yearbook_access(uuid), private.uuid_or_null(text), private.on_team(uuid, uuid) to authenticated;
create function public.yearbook_access(p_team_id uuid) returns text
language sql stable security invoker set search_path = '' as $$ select private.yearbook_access(p_team_id) $$;
revoke all on function public.yearbook_access(uuid) from public, anon;
grant execute on function public.yearbook_access(uuid) to authenticated;

-- Uploader's name comes from her record, never the browser.
create function private.yearbook_photo_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.uploaded_by := (select auth.uid());
  new.uploader_name := coalesce(
    (select display_name from public.staff where user_id = (select auth.uid())),
    (select display_name from public.parent_accounts where user_id = (select auth.uid())),
    'A parent');
  new.created_at := now();
  return new;
end $$;
revoke all on function private.yearbook_photo_defaults() from public;
create trigger yearbook_photo_defaults before insert on public.yearbook_photos
  for each row execute function private.yearbook_photo_defaults();

alter table public.yearbook_photos enable row level security;
create policy "yearbook viewers see photos" on public.yearbook_photos for select to authenticated
  using ((select private.yearbook_access(team_id)) is not null);
create policy "coaches and parents add photos" on public.yearbook_photos for insert to authenticated
  with check ((select private.yearbook_access(team_id)) in ('manage', 'add'));
create policy "uploader or coach edits a photo" on public.yearbook_photos for update to authenticated
  using (uploaded_by = (select auth.uid()) or (select private.can_edit()))
  with check (uploaded_by = (select auth.uid()) or (select private.can_edit()));
create policy "uploader or coach removes a photo" on public.yearbook_photos for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select private.can_edit()));
revoke update on public.yearbook_photos from authenticated, anon;
grant update (caption, taken_on) on public.yearbook_photos to authenticated;

alter table public.yearbook_photo_tags enable row level security;
create policy "yearbook viewers see tags" on public.yearbook_photo_tags for select to authenticated
  using (photo_id in (select p.id from public.yearbook_photos p where (select private.yearbook_access(p.team_id)) is not null));
create policy "uploader or coach tags team players" on public.yearbook_photo_tags for insert to authenticated
  with check (exists (
    select 1 from public.yearbook_photos p
     where p.id = photo_id
       and (p.uploaded_by = (select auth.uid()) or (select private.can_edit()))
       and (select private.on_team(p.team_id, yearbook_photo_tags.player_id))
  ));
create policy "uploader or coach untags" on public.yearbook_photo_tags for delete to authenticated
  using (exists (
    select 1 from public.yearbook_photos p
     where p.id = photo_id and (p.uploaded_by = (select auth.uid()) or (select private.can_edit()))
  ));

-- The photos themselves: private bucket, folder = team.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('yearbook-photos', 'yearbook-photos', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;
create policy "coaches and parents upload yearbook photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'yearbook-photos'
              and (select private.yearbook_access(private.uuid_or_null(split_part(name, '/', 1)))) in ('manage', 'add'));
create policy "yearbook viewers see yearbook photos" on storage.objects for select to authenticated
  using (bucket_id = 'yearbook-photos'
         and (select private.yearbook_access(private.uuid_or_null(split_part(name, '/', 1)))) is not null);
create policy "uploader or coach removes yearbook photos" on storage.objects for delete to authenticated
  using (bucket_id = 'yearbook-photos' and (owner = (select auth.uid()) or (select private.can_edit())));

-- Everything a Yearbook page shows: the team, its seasons with photos, the
-- season's roster (names for tagging and search) and its photos with tags.
create function private.team_yearbook(p_team_id uuid, p_season_id uuid) returns jsonb
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
    'team', (select jsonb_build_object('id', t.id, 'name', t.name, 'logo_url', t.logo_url) from public.teams t where t.id = p_team_id),
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
revoke all on function private.team_yearbook(uuid, uuid) from public;
grant execute on function private.team_yearbook(uuid, uuid) to authenticated;
create function public.team_yearbook(p_team_id uuid, p_season_id uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.team_yearbook(p_team_id, p_season_id) $$;
revoke all on function public.team_yearbook(uuid, uuid) from public, anon;
grant execute on function public.team_yearbook(uuid, uuid) to authenticated;
