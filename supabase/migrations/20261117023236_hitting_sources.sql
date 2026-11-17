-- =============================================================================
-- GGG.Cafe — Hitting Style and My Zone: what coaches see in testing, and the player's choice
-- (user, 2026-11-16): "Create the ability for coaches to enter a players Hitting Style and Zone
-- based upon testing. There should be a Testing Result and a Player Choice for the hitting zone.
-- The Hitting Style should have a toggle switch that defaults to Coach Observation to Player Choice."
--
--   * hitting_styles.source: 'coach' (Coach Observation, from hitting testing; coaches only) or
--     'player' (Player Choice: she or a coach for her). Each source keeps its own versions.
--   * hitting_zones.source: 'testing' (Testing Result; coaches only) or 'player' (Player Choice).
--     One row per player and source.
--   * Existing rows: saved by a coach -> the coach's (Coach Observation / Testing Result); saved by
--     the player -> hers (Player Choice).
--   * A player reads both and writes only her own choice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Hitting Style
-- -----------------------------------------------------------------------------
alter table public.hitting_styles
  add column source text not null default 'player' check (source in ('coach', 'player'));
comment on column public.hitting_styles.source is
  'coach = Coach Observation (from hitting testing, coaches only); player = Player Choice (she, or a coach for her).';
update public.hitting_styles h set source = 'coach'
 where exists (select 1 from public.staff s where s.user_id = h.recorded_by);
drop index public.hitting_styles_player_idx;
create index hitting_styles_player_idx on public.hitting_styles (player_id, source, recorded_at desc);

-- the player adds versions of her own choice only
alter policy "player updates her hitting style" on public.hitting_styles
  with check (player_id in (select private.my_player_ids()) and recorded_by = (select auth.uid()) and source = 'player');

-- -----------------------------------------------------------------------------
-- My Zone
-- -----------------------------------------------------------------------------
alter table public.hitting_zones
  add column source text not null default 'player' check (source in ('testing', 'player'));
comment on column public.hitting_zones.source is
  'testing = Testing Result (coaches only); player = Player Choice (she, or a coach for her).';
update public.hitting_zones z set source = 'testing'
 where exists (select 1 from public.staff s where s.user_id = z.updated_by);
alter table public.hitting_zones drop constraint hitting_zones_pkey;
alter table public.hitting_zones add primary key (player_id, source);
comment on table public.hitting_zones is
  'My Zone: her pitch (hot), zones she handles (strong) and weak zones, 1-9 from the catcher''s view. One row per source: the Testing Result (coaches) and her Player Choice (she or a coach).';

-- she writes only her own choice, and reads both
alter policy "player manages her own" on public.hitting_zones
  using (player_id in (select private.my_player_ids()) and source = 'player')
  with check (player_id in (select private.my_player_ids()) and source = 'player');
create policy "player reads her zones" on public.hitting_zones for select to authenticated
  using (player_id in (select private.my_player_ids()));
-- her approved parents read what she reads (the parent view rule, 2026-11-12)
create policy "player reads her zones (parent view)" on public.hitting_zones for select to authenticated
  using (player_id in (select private.my_child_ids()));
