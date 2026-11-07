-- =============================================================================
-- GGG.Cafe — Team logos
-- Coaches upload a team logo on the team page. It is the centerpiece of that
-- team's players' championship rings (the GGG badge is used until then).
-- Files live in a public Storage bucket (logos aren't sensitive and need to
-- load as images); only coaches/admins can add, replace or remove them.
-- =============================================================================

alter table public.teams
  add column logo_url text check (logo_url is null or logo_url ~ '^https://');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-logos', 'team-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "coaches upload team logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-logos' and (select private.can_edit()));

create policy "coaches replace team logos" on storage.objects
  for update to authenticated
  using (bucket_id = 'team-logos' and (select private.can_edit()))
  with check (bucket_id = 'team-logos' and (select private.can_edit()));

create policy "coaches remove team logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'team-logos' and (select private.can_edit()));
