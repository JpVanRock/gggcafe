-- =============================================================================
-- GGG.Cafe — Player intake
--
-- The intake form asks for date of birth, and optionally a profile picture and
-- walk-up songs. Profile pictures are photos of minors, so their bucket is
-- PRIVATE: only signed-in staff can read them (the app shows them through
-- short-lived signed URLs); coaches and admins add, replace or remove them.
-- =============================================================================

alter table public.players
  add column birth_date date check (birth_date is null or birth_date >= '1990-01-01'),
  -- path inside the player-photos bucket: '<folder uuid>/<timestamp>.jpg'
  add column photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[0-9]+\.(jpg|png|webp)$'),
  -- up to three songs: [{"title", "artist", "link"}]
  add column walk_up_songs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(walk_up_songs) = 'array' and jsonb_array_length(walk_up_songs) <= 3);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "staff view player photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'player-photos' and (select private.is_staff()));

create policy "coaches upload player photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'player-photos' and (select private.can_edit()));

create policy "coaches replace player photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'player-photos' and (select private.can_edit()))
  with check (bucket_id = 'player-photos' and (select private.can_edit()));

create policy "coaches remove player photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'player-photos' and (select private.can_edit()));
