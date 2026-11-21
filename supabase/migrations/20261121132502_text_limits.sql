-- =============================================================================
-- Text limits (Supabase best-practice review, 2026-11-21)
-- Players, parents who keep a team (team admins) and mentors write these tables straight
-- through the API, so a form's maxLength is not the limit: without a check, any signed-in
-- account could save text of any size. The other free-text columns these accounts write
-- already had a limit (or a fixed format); these were the ones left. The limits are well above what the forms allow (the longest stored value
-- on 2026-11-21 was 294 characters), so nothing saved today or typed in a form is refused.
--   200   names and titles          2000  a few sentences
--   500   short lines               5000  notes, descriptions, routines
--   1000  links
-- Structured jsonb gets a size cap like player_best_version.answers (pg_column_size).
-- =============================================================================

alter table public.games
  add constraint games_venue_length        check (char_length(venue) <= 200),
  add constraint games_event_name_length   check (char_length(event_name) <= 200),
  add constraint games_conditions_length   check (char_length(conditions) <= 500),
  add constraint games_notes_length        check (char_length(notes) <= 5000),
  add constraint games_external_id_length  check (char_length(external_id) <= 200);

alter table public.measurements
  add constraint measurements_context_length check (char_length(context) <= 200),
  add constraint measurements_notes_length   check (char_length(notes) <= 2000);

alter table public.development_goals
  add constraint development_goals_title_length       check (char_length(title) <= 200),
  add constraint development_goals_description_length check (char_length(description) <= 5000),
  add constraint development_goals_specific_length    check (char_length(specific) <= 2000),
  add constraint development_goals_measurable_length  check (char_length(measurable) <= 2000),
  add constraint development_goals_achievable_length  check (char_length(achievable) <= 2000),
  add constraint development_goals_relevant_length    check (char_length(relevant) <= 2000);

alter table public.drills
  add constraint drills_name_length        check (char_length(name) <= 200),
  add constraint drills_description_length check (char_length(description) <= 5000),
  add constraint drills_equipment_length   check (char_length(equipment) <= 500),
  add constraint drills_video_url_length   check (char_length(video_url) <= 1000);

alter table public.team_events
  add constraint team_events_title_length    check (char_length(title) <= 200),
  add constraint team_events_location_length check (char_length(location) <= 500),
  add constraint team_events_notes_length    check (char_length(notes) <= 5000);

alter table public.harada_plans
  add constraint harada_plans_main_goal_length check (char_length(main_goal) <= 1000),
  add constraint harada_plans_purpose_length   check (char_length(purpose) <= 2000);
alter table public.harada_pillars
  add constraint harada_pillars_title_length check (char_length(title) <= 200);
alter table public.harada_actions
  add constraint harada_actions_title_length check (char_length(title) <= 500);

alter table public.player_activities
  add constraint player_activities_title_length   check (char_length(title) <= 200),
  add constraint player_activities_details_length check (char_length(details) <= 2000);

alter table public.mental_game_plans
  add constraint mental_game_plans_focus_words_length           check (char_length(focus_words) <= 2000),
  add constraint mental_game_plans_pre_game_routine_length      check (char_length(pre_game_routine) <= 5000),
  add constraint mental_game_plans_pre_pitch_routine_length     check (char_length(pre_pitch_routine) <= 5000),
  add constraint mental_game_plans_reset_routine_length         check (char_length(reset_routine) <= 5000),
  add constraint mental_game_plans_confidence_statements_length check (char_length(confidence_statements) <= 5000),
  add constraint mental_game_plans_pressure_plan_length         check (char_length(pressure_plan) <= 5000),
  add constraint mental_game_plans_notes_length                 check (char_length(notes) <= 5000);

-- Format checks that had no upper bound (^...+$ / ^...*$)
alter table public.player_achievements
  add constraint player_achievements_achievement_key_length check (char_length(achievement_key) <= 100);
alter table public.notifications
  add constraint notifications_href_length check (char_length(href) <= 500);
alter table public.practice_drills
  add constraint practice_drills_video_url_length check (char_length(video_url) <= 1000);
alter table public.practice_plan_drills
  add constraint practice_plan_drills_video_url_length check (char_length(video_url) <= 1000);
alter table public.mentor_messages
  add constraint mentor_messages_drill_video_url_length check (char_length(drill_video_url) <= 1000);

-- Structured answers and lineups
alter table public.gameday_lineups
  add constraint gameday_lineups_defense_size  check (pg_column_size(defense) <= 20000),
  add constraint gameday_lineups_pitching_size check (pg_column_size(pitching) <= 20000);
alter table public.player_leadership_lessons
  add constraint player_leadership_lessons_answers_size check (pg_column_size(answers) <= 50000);
alter table public.player_leadership_plans
  add constraint player_leadership_plans_plan_size check (pg_column_size(plan) <= 50000);
alter table public.team_pledges
  add constraint team_pledges_lines_size check (pg_column_size(lines) <= 12000);
