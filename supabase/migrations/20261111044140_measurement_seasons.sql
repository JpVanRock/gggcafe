-- =============================================================================
-- GGG.Cafe — Measurements by season (user, 2026-11-10)
-- Her POP Report shows measurements in four seasons a year (Fall Season, Winter
-- Offseason, Spring Season, Summer Season, set by the date measured; see
-- src/lib/measurements.ts). Every player gets the default list; pitchers add fastball
-- speed and catchers pop time; coaches add more for their team.
-- =============================================================================

-- The new defaults (home to first, fastball velocity and pop time already exist).
insert into public.metrics (key, name, unit, better, area, description) values
  ('first_to_second',         'First to second',         'sec',   'lower',  'baserunning', 'From a lead off first to the bag at second, timed on the release.'),
  ('first_to_home',           'First to home',           'sec',   'lower',  'baserunning', 'From first base around to home plate.'),
  ('throw_velo_overhand',     'Overhand throwing speed', 'mph',   'higher', 'other',       'Radar on a crow-hop overhand throw. Best of 3.'),
  ('rotational_acceleration', 'Rotational acceleration', 'g',     'higher', 'hitting',     'From a swing sensor: how fast the bat gets into the swing plane.'),
  ('connection_score',        'Connection score',        'score', 'higher', 'hitting',     'From a swing sensor: body and bat working together through the swing.'),
  ('on_plane_score',          'On-plane score',          'score', 'higher', 'hitting',     'From a swing sensor: how long the bat stays on the plane of the pitch.')
on conflict (key) do nothing;

-- The extra measurements a team's coaches add (beyond the built-in list).
create table public.team_measurements (
  team_id    uuid not null references public.teams (id) on delete cascade,
  metric_key text not null references public.metrics (key) on update cascade on delete cascade,
  position   smallint not null default 0,
  primary key (team_id, metric_key)
);
comment on table public.team_measurements is
  'Measurements a team''s coaches add to every player''s POP Report, beyond the built-in list.';
create index team_measurements_metric_idx on public.team_measurements (metric_key);
select private.apply_staff_rls('public.team_measurements');
-- her team's list shows on her own POP Report
create policy "players read their teams' measurements" on public.team_measurements for select to authenticated
  using (team_id in (select private.my_current_team_ids()));
