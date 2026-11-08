-- =============================================================================
-- GGG.Cafe — positions a coach has confirmed for a player
--
-- G3 Advanced position chapters (first: Pitching) show only to players their
-- coach has confirmed at that position. Coaches and admins confirm or remove;
-- the player can see her own confirmations but can't change them.
-- =============================================================================

create table public.player_confirmed_positions (
  player_id    uuid not null references public.players (id) on delete cascade,
  position     public.field_position not null,
  confirmed_by uuid default auth.uid() references auth.users (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  primary key (player_id, position)
);
comment on table public.player_confirmed_positions is
  'Positions a coach has confirmed for a player (e.g. P opens the G3 Advanced Pitching chapter).';
select private.apply_staff_rls('public.player_confirmed_positions');
create policy "player sees her confirmed positions" on public.player_confirmed_positions for select to authenticated
  using (player_id in (select private.my_player_ids()));
