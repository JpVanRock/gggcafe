-- The Switchboard (user, 2026-11-12): a head coach turns parts of the site off (and on again)
-- for their team, for Players, Parents and Mentors. Everything is on until turned off; a row
-- here means that feature is off for that team. Keys and labels: src/lib/switchboard.ts.
-- Off hides it on the site (and stops new posts); nothing saved is deleted.
-- A player on more than one team loses a feature when any of her teams turns it off.

create table public.team_features_off (
  team_id        uuid not null references public.teams (id) on delete cascade,
  feature        text not null check (feature ~ '^(player|parent|mentor)\.[a-z_]{2,30}$'),
  turned_off_by  uuid default auth.uid() references auth.users (id) on delete set null,
  turned_off_at  timestamptz not null default now(),
  primary key (team_id, feature)
);
comment on table public.team_features_off is
  'The Switchboard: features a head coach turned off for their team (a row = off).';

-- staff read, head coaches and admins write
select private.apply_staff_rls('public.team_features_off');
select private.apply_head_coach_writes('public.team_features_off');
-- the people it applies to read their teams' switches: players (and parents viewing as them),
-- parents for their teams, mentors for the teams they work with
create policy "players read their teams' switches" on public.team_features_off for select to authenticated
  using (team_id in (select private.my_current_team_ids()));
create policy "players read their teams' switches (parent view)" on public.team_features_off for select to authenticated
  using (team_id in (select private.my_child_team_ids()));
create policy "parents read their teams' switches" on public.team_features_off for select to authenticated
  using (team_id in (select private.my_parent_team_ids()));
create policy "mentors read their teams' switches" on public.team_features_off for select to authenticated
  using (team_id in (select private.my_mentee_team_ids()));

-- Off for a player: off on any of her current teams.
create function private.feature_off_for_player(p_player_id uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_features_off f
      join public.roster_entries r on r.team_id = f.team_id
     where r.player_id = p_player_id and f.feature = p_feature
       and r.active and r.season_id = private.team_current_season(r.team_id))
$$;
revoke all on function private.feature_off_for_player(uuid, text) from public;
grant execute on function private.feature_off_for_player(uuid, text) to authenticated;

-- The switches off for one player (her pages, her parents' view, her mentors' page).
create function private.player_features_off(p_player_id uuid) returns setof text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select private.is_staff())
          or p_player_id in (select private.my_player_ids())
          or p_player_id in (select private.my_child_ids())
          or p_player_id in (select private.my_mentee_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select distinct f.feature from public.team_features_off f
      join public.roster_entries r on r.team_id = f.team_id
     where r.player_id = p_player_id and r.active and r.season_id = private.team_current_season(r.team_id);
end $$;
select private.expose('private.player_features_off(uuid)');

-- With Message players or Add training off, mentors can't post them (on top of the app).
create policy "switchboard: mentor messages" on public.mentor_messages as restrictive for insert to authenticated
  with check (not private.feature_off_for_player(player_id, 'mentor.messages'));
create policy "switchboard: mentor training" on public.player_activities as restrictive for insert to authenticated
  with check (source is distinct from 'mentor' or not private.feature_off_for_player(player_id, 'mentor.training'));
