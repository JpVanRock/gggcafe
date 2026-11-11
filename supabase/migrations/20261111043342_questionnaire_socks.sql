-- =============================================================================
-- GGG.Cafe — Preseason questionnaire: socks instead of jacket and hat (user, 2026-11-10)
-- The questionnaire moves to the parents' page only (/family); coaches still see the
-- team table on the Roster tab. Sizes asked: jersey/top, pants and socks. No questionnaire
-- had a jacket or hat size when this ran, so dropping those columns lost nothing.
-- =============================================================================

alter table public.player_questionnaires
  add column sock_size text check (sock_size in ('YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL', 'A3XL'));
alter table public.player_questionnaires drop column jacket_size, drop column hat_size;

-- Parents save it through this function (same checks and grants as before; only the sizes change).
create or replace function private.save_parent_questionnaire(p_player_id uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_team   uuid;
  v_season uuid;
begin
  if not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent' using errcode = '42501';
  end if;
  select team_id into v_team from public.parent_links
   where parent_id = (select auth.uid()) and player_id = p_player_id and status = 'approved'
   order by decided_at desc nulls last limit 1;
  v_season := private.team_current_season(v_team);
  if v_season is null then
    raise exception 'the team has no roster this season yet' using errcode = 'P0006';
  end if;
  insert into public.player_questionnaires
    (player_id, team_id, season_id, top_size, bottom_size, sock_size, numbers, positions, experience, goals, notes, updated_by, updated_at)
  values (p_player_id, v_team, v_season,
          nullif(p_data ->> 'top_size', ''), nullif(p_data ->> 'bottom_size', ''), nullif(p_data ->> 'sock_size', ''),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data -> 'numbers', '[]')) x), '{}'),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data -> 'positions', '[]')) x), '{}'),
          nullif(p_data ->> 'experience', ''), nullif(p_data ->> 'goals', ''), nullif(p_data ->> 'notes', ''),
          (select auth.uid()), now())
  on conflict (player_id, team_id, season_id) do update set
    top_size = excluded.top_size, bottom_size = excluded.bottom_size, sock_size = excluded.sock_size,
    numbers = excluded.numbers, positions = excluded.positions,
    experience = excluded.experience, goals = excluded.goals, notes = excluded.notes,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;
