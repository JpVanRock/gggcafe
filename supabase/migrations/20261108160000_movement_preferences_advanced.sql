-- =============================================================================
-- GGG.Cafe — Movement Preferences is a G3 Advanced feature (user, 2026-11-08)
--
-- A player reads her Movement Preferences only while she has G3 Advanced
-- (private.has_advanced). Staff keep reading them (apply_staff_rls); the app
-- shows and saves them only for players with G3 Advanced, and her history is
-- kept while it's locked. Preferred Hitting Style stays Standard.
-- =============================================================================

drop policy "player reads her movement preferences" on public.movement_preferences;
create policy "player reads her movement preferences" on public.movement_preferences for select to authenticated
  using (player_id in (select private.my_player_ids()) and (select private.has_advanced(player_id)));
