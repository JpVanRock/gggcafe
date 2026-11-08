-- =============================================================================
-- GGG.Cafe — G3 Advanced (Level 2): the player's advanced book
--
-- Access is per player and only admins grant it (later a paid subscription will
-- grant it the same way: source = 'subscription'). Until a player has access,
-- nothing about G3 Advanced shows for her. With access, she gets her own book
-- (default title "How to Cook", hers to rename) whose chapters live in
-- src/lib/advanced-book.ts; here we keep only her work on each chapter: the
-- foundation habits she owns, the habits she adds, her notes, and whether she's
-- finished it. Chapters are keyed by slug, so new chapters need no migration.
-- =============================================================================

create table public.player_advanced_access (
  player_id  uuid primary key references public.players (id) on delete cascade,
  source     text not null default 'admin' check (source in ('admin', 'subscription')),
  granted_by uuid default auth.uid() references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);
comment on table public.player_advanced_access is
  'G3 Advanced access, one row per player who has it. Admins grant and remove it (later: subscriptions).';
alter table public.player_advanced_access enable row level security;
create policy "staff can read" on public.player_advanced_access for select to authenticated
  using ((select private.is_staff()));
create policy "player sees her own access" on public.player_advanced_access for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "admins can insert" on public.player_advanced_access for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins can update" on public.player_advanced_access for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins can delete" on public.player_advanced_access for delete to authenticated
  using ((select private.is_admin()));

create function private.has_advanced(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.player_advanced_access where player_id = p_player_id)
$$;
revoke all on function private.has_advanced(uuid) from public;
grant execute on function private.has_advanced(uuid) to authenticated;

-- Her copy of the book: the title she gave it.
create table public.player_advanced_books (
  player_id  uuid primary key references public.players (id) on delete cascade,
  title      text not null default 'How to Cook' check (char_length(title) between 1 and 60),
  updated_at timestamptz not null default now()
);
comment on table public.player_advanced_books is 'G3 Advanced: her book''s title (default "How to Cook").';

-- Her work on each chapter (slug from src/lib/advanced-book.ts).
create table public.player_advanced_chapters (
  player_id    uuid not null references public.players (id) on delete cascade,
  chapter      text not null check (chapter ~ '^[a-z0-9-]{1,40}$'),
  owned        text[] not null default '{}' check (cardinality(owned) <= 40),
  mine         text[] not null default '{}' check (cardinality(mine) <= 12),
  notes        text check (char_length(notes) <= 2000),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (player_id, chapter)
);
comment on table public.player_advanced_chapters is
  'G3 Advanced: per chapter, the foundation habits she owns (keys), habits she added, notes, and when she finished it.';

-- Staff read, coaches/admins write (as everywhere); the player keeps her own,
-- but only while she has G3 Advanced.
select private.apply_staff_rls('public.player_advanced_books');
select private.apply_staff_rls('public.player_advanced_chapters');
create policy "player keeps her own book" on public.player_advanced_books for all to authenticated
  using (player_id in (select private.my_player_ids()) and (select private.has_advanced(player_id)))
  with check (player_id in (select private.my_player_ids()) and (select private.has_advanced(player_id)));
create policy "player keeps her own chapters" on public.player_advanced_chapters for all to authenticated
  using (player_id in (select private.my_player_ids()) and (select private.has_advanced(player_id)))
  with check (player_id in (select private.my_player_ids()) and (select private.has_advanced(player_id)));
