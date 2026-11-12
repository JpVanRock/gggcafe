-- My Journal (user, 2026-11-12): a player's notes from her sessions with her mentors,
-- typed and/or a voice memo recorded in the browser. It's hers (user's choice):
--   * she writes, changes and removes her own entries;
--   * her approved parents read them (view as player), read only;
--   * she can share one entry with the mentor it's about; that mentor reads only the
--     entries shared with her, and only while she still works with the player;
--   * coaches and other staff don't read it, so this table is an exception to
--     apply_staff_rls (reason: the user chose to keep it from coaches).
-- Voice memos live in the private bucket journal-audio as <player id>/<entry id>.<ext>.
-- Limits and helpers: src/lib/journal.ts.

create table public.player_journal_entries (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references public.players (id) on delete cascade,
  -- the mentor the session was with (one of hers); a name instead for someone not on the site
  mentor_id          uuid references public.mentors (user_id) on delete set null,
  mentor_name        text check (char_length(mentor_name) <= 80),
  session_date       date not null default current_date,
  topic              text check (char_length(topic) <= 120),
  notes              text check (char_length(notes) <= 5000),
  audio_path         text check (audio_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webm|m4a|ogg)$'),
  audio_seconds      integer check (audio_seconds between 1 and 600),
  shared_with_mentor boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (topic is not null or notes is not null or audio_path is not null),
  check (audio_path is null or split_part(audio_path, '/', 1) = player_id::text),
  check (not shared_with_mentor or mentor_id is not null)
);
comment on table public.player_journal_entries is
  'My Journal: a player''s notes and voice memos from mentor sessions. Hers and her parents''; a mentor reads only what she shares.';
create index player_journal_entries_player_idx on public.player_journal_entries (player_id, session_date desc);
create index player_journal_entries_mentor_idx on public.player_journal_entries (mentor_id) where shared_with_mentor;
create trigger set_updated_at before update on public.player_journal_entries
  for each row execute function private.set_updated_at();

alter table public.player_journal_entries enable row level security;
grant select, insert, update, delete on public.player_journal_entries to authenticated;
create policy "player keeps her own journal" on public.player_journal_entries for all to authenticated
  using (player_id in (select private.my_player_ids()))
  with check (player_id in (select private.my_player_ids()));
create policy "player keeps her own journal (parent view)" on public.player_journal_entries for select to authenticated
  using (player_id in (select private.my_child_ids()));
create policy "mentor reads the entries shared with her" on public.player_journal_entries for select to authenticated
  using (shared_with_mentor and mentor_id = (select auth.uid()) and player_id in (select private.my_mentee_ids()));

-- Her mentors, for the journal's "Who was it with?" list: approved for her alone or for
-- one of her current teams. She and her approved parents may ask.
create function private.player_mentors(p_player_id uuid)
returns table (mentor_id uuid, display_name text, specialty text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (p_player_id in (select private.my_player_ids()) or p_player_id in (select private.my_child_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select distinct m.user_id, m.display_name, m.specialty
      from public.mentors m
      join public.mentor_links l on l.mentor_id = m.user_id and l.status = 'approved'
     where l.player_id = p_player_id
        or (l.player_id is null and l.team_id in (
              select r.team_id from public.roster_entries r
               where r.player_id = p_player_id and r.active and r.season_id = private.team_current_season(r.team_id)))
     order by m.display_name;
end $$;
select private.expose('private.player_mentors(uuid)');

-- Voice memos: private, 10 MB, audio only. She uploads to and removes from her own folder;
-- she and her parents play them; a mentor plays a memo on an entry shared with her.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-audio', 'journal-audio', false, 10485760, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'])
on conflict (id) do nothing;
create policy "players upload journal audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'journal-audio'
              and split_part(name, '/', 1) in (select p::text from private.my_player_ids() p));
create policy "players remove journal audio" on storage.objects for delete to authenticated
  using (bucket_id = 'journal-audio'
         and split_part(name, '/', 1) in (select p::text from private.my_player_ids() p));
create policy "players play journal audio" on storage.objects for select to authenticated
  using (bucket_id = 'journal-audio'
         and split_part(name, '/', 1) in (select p::text from private.my_player_ids() p));
create policy "players play journal audio (parent view)" on storage.objects for select to authenticated
  using (bucket_id = 'journal-audio'
         and split_part(name, '/', 1) in (select p::text from private.my_child_ids() p));
create policy "mentors play shared journal audio" on storage.objects for select to authenticated
  using (bucket_id = 'journal-audio'
         and name in (select j.audio_path from public.player_journal_entries j
                       where j.shared_with_mentor and j.mentor_id = (select auth.uid())));
