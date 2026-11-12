-- Coaches who are parents (user, 2026-11-12): a coach claims their daughter from the
-- team's roster and gets the parent side too, with one login (Coach page / Parent page).
-- The claim is an ordinary parent link (parent_links), so everything parents get follows
-- from it. A head coach's (or admin's) claim is approved at once, since they approve
-- parents anyway; an assistant's waits for the head coach like any parent's.

create function private.claim_my_daughter(p_player_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_name   text;
  v_child  text;
  v_status public.parent_link_status;
  v_team   record;
  v_any    boolean := false;
begin
  if not (select private.can_edit()) then
    raise exception 'only coaches claim a daughter here' using errcode = '42501';
  end if;
  select coalesce(nullif(p.preferred_name, ''), p.first_name) || ' ' || p.last_name into v_child
    from public.players p where p.id = p_player_id;
  if v_child is null then
    raise exception 'no such player' using errcode = 'P0006';
  end if;
  -- the parent profile parents have, named like their staff record
  select s.display_name into v_name from public.staff s where s.user_id = v_uid;
  insert into public.parent_accounts (user_id, display_name) values (v_uid, left(v_name, 80))
  on conflict (user_id) do nothing;
  v_status := case when (select private.is_head_coach()) then 'approved' else 'pending' end;
  -- one link per team she's on now (our teams, current season)
  for v_team in
    select distinct r.team_id
      from public.roster_entries r
      join public.teams t on t.id = r.team_id and t.is_own_team
     where r.player_id = p_player_id and r.active and r.season_id = private.team_current_season(r.team_id)
  loop
    v_any := true;
    if not exists (select 1 from public.parent_links l
                    where l.parent_id = v_uid and l.team_id = v_team.team_id
                      and (l.player_id = p_player_id or lower(l.child_name) = lower(v_child))) then
      insert into public.parent_links (parent_id, team_id, child_name, player_id, status, decided_by, decided_at)
      values (v_uid, v_team.team_id, left(v_child, 80), p_player_id, v_status,
              case when v_status = 'approved' then v_uid end, case when v_status = 'approved' then now() end);
    end if;
  end loop;
  if not v_any then
    raise exception 'she isn''t on one of our current rosters' using errcode = 'P0006';
  end if;
  return (select case when bool_or(l.status = 'approved') then 'approved' else 'pending' end
            from public.parent_links l where l.parent_id = v_uid and l.player_id = p_player_id);
end $$;
select private.expose('private.claim_my_daughter(uuid)');
