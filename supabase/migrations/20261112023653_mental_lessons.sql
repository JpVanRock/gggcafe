-- Mental GP lessons and the coaches' Mental Game course (user, 2026-11-12).
-- The lessons themselves are in the code (src/lib/mental-lessons.ts and
-- src/lib/coach-training.ts); these tables keep who finished what and their answers.

-- A player's lessons on her Mental GP: her answer to each lesson's question and when
-- she finished it. Staff read, coaches write (as everywhere); she keeps her own; her
-- approved parent reads it (view as player). Mentors don't: like her journal, it's hers.
create table public.player_mental_lessons (
  player_id    uuid not null references public.players (id) on delete cascade,
  lesson       text not null check (lesson ~ '^[a-z0-9-]{1,40}$'),
  answer       text check (char_length(answer) <= 1500),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (player_id, lesson)
);
comment on table public.player_mental_lessons is
  'Mental GP lessons (slug from src/lib/mental-lessons.ts): her answer to the lesson''s question and when she finished it.';

select private.apply_staff_rls('public.player_mental_lessons');
create policy "player keeps her own mental lessons" on public.player_mental_lessons for all to authenticated
  using (player_id in (select private.my_player_ids()))
  with check (player_id in (select private.my_player_ids()));
create policy "player keeps her own mental lessons (parent view)" on public.player_mental_lessons for select to authenticated
  using (player_id in (select private.my_child_ids()));

-- A coach's own progress through the coaches' course, with their notes.
-- Exception to apply_staff_rls (reason: these are each coach's own notes, not team
-- data): every staff member keeps their own rows, viewers included; admins read
-- everyone's progress. Nobody else reads them.
create table public.coach_mental_lessons (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson       text not null check (lesson ~ '^[a-z0-9-]{1,40}$'),
  notes        text check (char_length(notes) <= 2000),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, lesson)
);
comment on table public.coach_mental_lessons is
  'Coaches'' Mental Game course (slug from src/lib/coach-training.ts): each coach''s notes and when they finished each module.';

alter table public.coach_mental_lessons enable row level security;
grant select, insert, update, delete on public.coach_mental_lessons to authenticated;
create policy "staff keep their own coach training" on public.coach_mental_lessons for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_staff()))
  with check (user_id = (select auth.uid()) and (select private.is_staff()));
create policy "admins read coach training" on public.coach_mental_lessons for select to authenticated
  using ((select private.is_admin()));
