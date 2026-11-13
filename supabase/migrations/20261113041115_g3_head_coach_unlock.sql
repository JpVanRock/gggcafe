-- G3 Advanced: head coaches unlock it too (user, 2026-11-12). Until now only admins granted and
-- removed a player's access (migration 20261108023500). Head coaches and admins (is_head_coach)
-- now do both, from Coaches Dugout -> Roster; assistants and viewers still can't, and a player
-- never can. `source` records who unlocked it: 'admin', 'coach' (a head coach) or, later,
-- 'subscription'.

alter table public.player_advanced_access drop constraint player_advanced_access_source_check;
alter table public.player_advanced_access add constraint player_advanced_access_source_check
  check (source in ('admin', 'coach', 'subscription'));

drop policy "admins can insert" on public.player_advanced_access;
drop policy "admins can update" on public.player_advanced_access;
drop policy "admins can delete" on public.player_advanced_access;
create policy "head coaches can insert" on public.player_advanced_access for insert to authenticated
  with check ((select private.is_head_coach()));
create policy "head coaches can update" on public.player_advanced_access for update to authenticated
  using ((select private.is_head_coach())) with check ((select private.is_head_coach()));
create policy "head coaches can delete" on public.player_advanced_access for delete to authenticated
  using ((select private.is_head_coach()));

comment on table public.player_advanced_access is
  'G3 Advanced access, one row per player who has it. Head coaches and admins grant and remove it (later: subscriptions).';
