-- =============================================================================
-- Ready for growth (refactoring roadmap step 6)
--   * Indexes on the foreign keys the app filters or joins on (Postgres doesn't index
--     foreign keys by itself; deletes that cascade also scan them).
--   * Players of the Week are decided by a daily scheduled job (pg_cron) instead of on
--     every staff page view: the notification bell only counts now. The Leaderboard
--     still decides when it's opened, so it is never behind.
-- =============================================================================

create index if not exists iq_answers_question_idx        on public.iq_answers (question_id);
create index if not exists twis_checks_activity_idx       on public.twis_checks (activity_id);
create index if not exists twis_checks_team_event_idx     on public.twis_checks (team_event_id);
create index if not exists twis_checks_game_idx           on public.twis_checks (game_id);
create index if not exists team_quiz_answers_question_idx on public.team_quiz_answers (question_id);
create index if not exists install_item_plans_plan_idx    on public.install_item_plans (plan_id);
create index if not exists practice_plan_cues_player_idx  on public.practice_plan_cues (player_id);
create index if not exists gameday_lineups_game_idx       on public.gameday_lineups (game_id);
create index if not exists parent_links_team_idx          on public.parent_links (team_id);
create index if not exists pa_grades_player_idx           on public.pa_grades (player_id);
create index if not exists depth_chart_player_idx         on public.depth_chart (player_id);

-- Every team in its offseason: decide the weeks that have finished.
create function private.decide_all_players_of_week() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid;
begin
  for v_team in select team_id from public.team_offseason loop
    perform private.decide_players_of_week(v_team);
  end loop;
end $$;
revoke all on function private.decide_all_players_of_week() from public;

-- The bell only counts (the decisions run on the schedule below and on the Leaderboard).
create or replace function private.unread_notifications() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.notifications where user_id = (select auth.uid()) and read_at is null
$$;

-- Daily at 09:00 UTC (early morning in the US). Only where pg_cron exists (Supabase);
-- the local test database has no pg_cron and skips this.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('decide-players-of-week', '0 9 * * *', 'select private.decide_all_players_of_week()');
  end if;
end $$;
