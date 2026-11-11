-- =============================================================================
-- GGG.Cafe — The Best Version of You (user, 2026-11-10)
-- The top of every player's Goals page: what she wants (her roadmap), what it will
-- cost her, whether she'll pay the price, whether she'd want to be her own teammate,
-- and her 15 Minutes a Day Personal Challenge. Her answers, one row per player.
-- The prompts live in src/lib/best-version.ts (keys checked there).
-- =============================================================================

create table public.player_best_version (
  player_id  uuid primary key references public.players (id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 12000),
  updated_at timestamptz not null default now()
);
comment on table public.player_best_version is
  'The Best Version of You (Goals page): her answers to the four questions and her 15-minute off-day challenge.';

-- Like her other goals: coaches read and write, view-only staff read, she keeps her own,
-- her mentors read it.
select private.apply_staff_rls('public.player_best_version');
create policy "player keeps her own best version" on public.player_best_version for all to authenticated
  using (player_id in (select private.my_player_ids()))
  with check (player_id in (select private.my_player_ids()));
create policy "mentor reads her players' best version" on public.player_best_version for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
