-- =============================================================================
-- Keys (Supabase best-practice review, 2026-11-21)
--   * An index on every foreign key that doesn't point at auth.users. Postgres doesn't index
--     foreign keys by itself, so deleting a team, season, player, game or drill scanned each
--     table that points at it, and joins on these columns had nothing to use. The links to
--     auth.users (created_by, updated_by, decided_by ...) only record who did something and are
--     only scanned when an account is deleted, so they stay as they are.
--     tests/db/zz_keys.test.sql fails on a new one without an index.
--   * A primary key for the password-reset log (every table has one).
-- =============================================================================

-- teams
create index batting_lines_team_idx                  on public.batting_lines (team_id);
create index fielding_lines_team_idx                 on public.fielding_lines (team_id);
create index game_plans_team_idx                     on public.game_plans (team_id);
create index lineup_entries_team_idx                 on public.lineup_entries (team_id);
create index notifications_team_idx                  on public.notifications (team_id);
create index pa_grades_team_idx                      on public.pa_grades (team_id);
create index pitching_lines_team_idx                 on public.pitching_lines (team_id);
create index plate_appearances_batting_team_idx      on public.plate_appearances (batting_team_id);
create index playbook_plays_team_idx                 on public.playbook_plays (team_id);
create index player_leadership_certificates_team_idx on public.player_leadership_certificates (team_id);
create index player_questionnaires_team_idx          on public.player_questionnaires (team_id);
create index staff_requests_team_idx                 on public.staff_requests (team_id);
create index team_pledges_team_idx                   on public.team_pledges (team_id);

-- seasons
create index budget_adjustments_season_idx    on public.budget_adjustments (season_id);
create index budget_entries_season_idx        on public.budget_entries (season_id);
create index budget_fees_season_idx           on public.budget_fees (season_id);
create index development_goals_season_idx     on public.development_goals (season_id);
create index gameday_lineups_season_idx       on public.gameday_lineups (season_id);
create index gameday_profiles_season_idx      on public.gameday_profiles (season_id);
create index player_claims_season_idx         on public.player_claims (season_id);
create index player_questionnaires_season_idx on public.player_questionnaires (season_id);
create index roster_entries_season_idx        on public.roster_entries (season_id);
create index team_pledges_season_idx          on public.team_pledges (season_id);
create index yearbook_photos_season_idx       on public.yearbook_photos (season_id);

-- players
create index budget_adjustments_player_idx      on public.budget_adjustments (player_id);
create index budget_entries_player_idx          on public.budget_entries (player_id);
create index game_plans_starting_pitcher_idx    on public.game_plans (starting_pitcher_id);
create index gameday_lineups_dp_player_idx      on public.gameday_lineups (dp_player_id);
create index gameday_lineups_flex_player_idx    on public.gameday_lineups (flex_player_id);
create index gameday_profiles_player_idx        on public.gameday_profiles (player_id);
create index lineup_entries_player_idx          on public.lineup_entries (player_id);
create index notifications_player_idx           on public.notifications (player_id);
create index offseason_squad_members_player_idx on public.offseason_squad_members (player_id);
create index offseason_squads_captain_idx       on public.offseason_squads (captain_id);
create index parent_links_player_idx            on public.parent_links (player_id);
create index player_spotlights_player_idx       on public.player_spotlights (player_id);
create index team_player_of_week_player_idx     on public.team_player_of_week (player_id);

-- games and plate appearances
create index coach_notes_game_idx                on public.coach_notes (game_id);
create index pitcher_game_plans_game_idx         on public.pitcher_game_plans (game_id);
create index play_calls_game_idx                 on public.play_calls (game_id);
create index scouting_reports_game_idx           on public.scouting_reports (game_id);
create index play_calls_plate_appearance_idx     on public.play_calls (plate_appearance_id);

-- drills, practice drills, bullpen scripts, playbook plays
create index drill_assignments_drill_idx         on public.drill_assignments (drill_id);
create index player_activities_drill_idx         on public.player_activities (drill_id);
create index team_routines_drill_idx             on public.team_routines (drill_id);
create index mentor_messages_drill_idx           on public.mentor_messages (drill_id);
create index practice_plan_drills_drill_idx      on public.practice_plan_drills (drill_id);
create index bullpen_sessions_script_idx         on public.bullpen_sessions (script_id);
create index player_activities_bullpen_script_idx on public.player_activities (bullpen_script_id);
create index team_routines_bullpen_script_idx    on public.team_routines (bullpen_script_id);
create index install_items_play_idx              on public.install_items (play_id);
create index team_quiz_questions_play_idx        on public.team_quiz_questions (play_id);

-- goals, Harada pillars, training phases, metrics
create index drill_assignments_goal_idx          on public.drill_assignments (goal_id);
create index player_activities_pillar_idx        on public.player_activities (pillar_id);
create index team_routines_phase_idx             on public.team_routines (phase_id);
create index development_goals_metric_key_idx    on public.development_goals (metric_key);
create index measurements_metric_key_idx         on public.measurements (metric_key);

-- Softball IQ awards (each points at the level test that earned it)
create index player_golden_gloves_attempt_idx         on public.player_golden_gloves (attempt_id);
create index player_manager_awards_attempt_idx        on public.player_manager_awards (attempt_id);
create index player_mvp_badges_attempt_idx            on public.player_mvp_badges (attempt_id);
create index player_rings_attempt_idx                 on public.player_rings (attempt_id);
create index player_world_series_trophies_attempt_idx on public.player_world_series_trophies (attempt_id);

-- offseason squads, the parent packet
create index offseason_squad_members_squad_team_idx on public.offseason_squad_members (squad_id, team_id);
create index parent_packet_reads_item_idx           on public.parent_packet_reads (item_id);

-- The password-reset log (migration 20261109150000) was the one table without a primary key.
alter table private.password_reset_requests add column id bigint generated always as identity primary key;
