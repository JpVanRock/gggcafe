-- =============================================================================
-- GGG.Cafe — sample data for local development and tests.
-- All names are fictional. This file is NOT applied to the live database by
-- `npm run db:push`; only `npm run db:test` (and `supabase db reset` locally) load it.
-- Fixed ids so tests can check exact stat values.
-- =============================================================================

insert into public.seasons (id, name, start_date, end_date) values
  ('00000000-0000-0000-0000-0000000000a1', 'Fall 2026', '2026-08-15', '2026-11-15');

insert into public.teams (id, name, short_name, age_group, format, is_own_team) values
  ('00000000-0000-0000-0000-0000000000b1', 'Sample Squad 14U',     'Sample', '14U', 'fastpitch', true),
  ('00000000-0000-0000-0000-0000000000b2', 'River City Blaze 14U', 'Blaze',  '14U', 'fastpitch', false);

insert into public.players (id, first_name, last_name, bats, throws, grad_year, primary_position, is_slapper) values
  ('00000000-0000-0000-0000-0000000000c1', 'Avery',  'Lopez', 'R', 'R', 2030, 'SS', false),
  ('00000000-0000-0000-0000-0000000000c2', 'Jordan', 'Kim',   'L', 'R', 2030, 'P',  false),
  ('00000000-0000-0000-0000-0000000000c3', 'Riley',  'Chen',  'R', 'R', 2031, 'C',  false),
  ('00000000-0000-0000-0000-0000000000c4', 'Morgan', 'Diaz',  'L', 'L', 2030, 'CF', true),
  ('00000000-0000-0000-0000-0000000000d1', 'Taylor', 'Brooks','R', 'L', 2030, 'P',  false),
  ('00000000-0000-0000-0000-0000000000d2', 'Casey',  'Ward',  'R', 'R', 2030, 'SS', false);

insert into public.roster_entries (team_id, season_id, player_id, jersey_number) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '7'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', '21'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', '00'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c4', '3'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '12'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d2', '5');

-- Game 1: we're home, won 5-2. Game 2: we're away, lost 3-6.
insert into public.games (id, season_id, game_date, home_team_id, away_team_id, venue, event_name, game_type, home_score, away_score, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', '2026-09-12',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 'Field 2', 'Fall Classic', 'tournament_pool', 5, 2, 'final'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', '2026-09-19',
   '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1', 'Blaze Park', null, 'league', 6, 3, 'final');

-- Box scores -------------------------------------------------------------------
-- Avery: G1 4 PA, 3 AB, 2 H (1 2B), 1 BB.  G2 4 PA, 4 AB, 1 H (HR), 1 SO.
-- Season: 7 AB, 3 H, TB 7 -> .429 / .500 / 1.000
insert into public.batting_lines
  (game_id, team_id, player_id, plate_appearances, at_bats, runs, hits, doubles, home_runs, rbi, walks, strikeouts) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 4, 3, 1, 2, 1, 0, 1, 1, 0),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 4, 4, 1, 1, 0, 1, 2, 0, 1),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c4', 4, 3, 2, 2, 0, 0, 0, 0, 0),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c4', 3, 3, 0, 1, 0, 0, 0, 0, 1);
update public.batting_lines set sac_bunts = 1, stolen_bases = 2
 where game_id = '00000000-0000-0000-0000-0000000000e1' and player_id = '00000000-0000-0000-0000-0000000000c4';

-- Jordan: G1 7.0 IP (21 outs), 1 ER.  G2 5.1 IP (16 outs), 3 ER.
-- Season: 12.1 IP, 4 ER -> ERA 2.27, WHIP (10 H + 3 BB) / 12.333 = 1.054
insert into public.pitching_lines
  (game_id, team_id, player_id, is_starter, outs_recorded, batters_faced, hits_allowed, runs_allowed, earned_runs, walks, strikeouts, pitches, strikes, decision) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', true, 21, 28, 4, 2, 1, 2, 9, 98, 64, 'W'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', true, 16, 25, 6, 4, 3, 1, 5, 88, 55, 'L');

insert into public.fielding_lines
  (game_id, team_id, player_id, primary_position, putouts, assists, errors, passed_balls, stolen_bases_allowed, runners_caught_stealing) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c3', 'C', 9, 1, 0, 0, 1, 1),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c3', 'C', 5, 2, 1, 1, 2, 0);

-- Play-by-play for game 1 (partial chart) --------------------------------------
insert into public.plate_appearances
  (id, game_id, seq, inning, half, batting_team_id, batter_id, pitcher_id, outs_before,
   runner_on_first, runner_on_second, runner_on_third, result, batted_ball, fielded_by, spray_x, spray_y, rbi, outs_on_play) values
  -- top 1: Casey Ward vs Jordan, groundout to SS
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 1, 1, 'top',
   '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2',
   0, false, false, false, 'groundout', 'ground_ball', 'SS', 0.380, 0.350, 0, 1),
  -- bottom 1: Avery doubles to LF off the lefty
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', 2, 1, 'bottom',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
   0, false, false, false, 'double', 'line_drive', 'LF', 0.150, 0.800, 0, 0),
  -- bottom 1: Morgan slaps a single with Avery on 2nd
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e1', 3, 1, 'bottom',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000d1',
   0, false, true, false, 'single', 'slap', '3B', 0.300, 0.250, 0, 0),
  -- bottom 3: Avery walks with 2 outs, runner on 3rd (7-pitch walk with fouls at 2 strikes)
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000e1', 4, 3, 'bottom',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
   2, false, false, true, 'walk', null, null, null, null, 0, 0),
  -- bottom 5: Avery strikes out swinging
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000e1', 5, 5, 'bottom',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
   1, false, false, false, 'strikeout_swinging', null, null, null, null, 0, 1);

insert into public.pitches (plate_appearance_id, seq, pitch_type, velocity_mph, result, zone) values
  ('00000000-0000-0000-0000-0000000000f1', 1, 'fastball', 58.0, 'called_strike', 5),
  ('00000000-0000-0000-0000-0000000000f1', 2, 'rise',     57.0, 'swinging_strike', 2),
  ('00000000-0000-0000-0000-0000000000f1', 3, 'rise',     57.5, 'in_play', 3),

  ('00000000-0000-0000-0000-0000000000f2', 1, 'fastball', 55.0, 'ball', 11),
  ('00000000-0000-0000-0000-0000000000f2', 2, 'drop',     54.0, 'called_strike', 8),
  ('00000000-0000-0000-0000-0000000000f2', 3, 'changeup', 44.0, 'foul', 7),
  ('00000000-0000-0000-0000-0000000000f2', 4, 'drop',     54.5, 'in_play', 8),

  ('00000000-0000-0000-0000-0000000000f3', 1, 'fastball', 55.5, 'in_play', 6),

  ('00000000-0000-0000-0000-0000000000f4', 1, 'fastball', 55.0, 'ball', 13),
  ('00000000-0000-0000-0000-0000000000f4', 2, 'drop',     54.0, 'ball', 14),
  ('00000000-0000-0000-0000-0000000000f4', 3, 'fastball', 55.0, 'foul', 4),
  ('00000000-0000-0000-0000-0000000000f4', 4, 'changeup', 43.5, 'ball', 13),
  ('00000000-0000-0000-0000-0000000000f4', 5, 'drop',     54.0, 'foul', 8),
  ('00000000-0000-0000-0000-0000000000f4', 6, 'drop',     54.5, 'foul', 9),
  ('00000000-0000-0000-0000-0000000000f4', 7, 'drop',     54.0, 'ball', 14),

  ('00000000-0000-0000-0000-0000000000f5', 1, 'fastball', 55.0, 'called_strike', 5),
  ('00000000-0000-0000-0000-0000000000f5', 2, 'drop',     54.0, 'swinging_strike', 8),
  ('00000000-0000-0000-0000-0000000000f5', 3, 'fastball', 56.0, 'ball', 11),
  ('00000000-0000-0000-0000-0000000000f5', 4, 'drop',     54.5, 'swinging_strike', 14);

-- Strategy ---------------------------------------------------------------------
insert into public.scouting_reports (subject_team_id, subject_player_id, game_id, category, title, body, confidence, tags, observed_on) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
   'pitcher_tendencies', 'Brooks lives on the drop with 2 strikes',
   'Threw drop on 4 of 5 two-strike pitches. Changeup only early in the count. Sit fastball on 0-0.', 4,
   '{drop,two_strikes,lefty}', '2026-09-12');

insert into public.game_plans (game_id, team_id, starting_pitcher_id, pitching_plan, offensive_plan, postgame_review) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2',
   'Rise up and in to Ward; don''t let her extend.', 'Lay off the 2-strike drop below the knees.',
   'Chased the drop again in innings 4-6. Two-strike approach drill this week.');

insert into public.playbook_plays (id, team_id, name, category, situation, description) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'Wheel play', 'bunt_defense',
   'Runners on 1st and 2nd, sure bunt', 'SS covers 3B, 3B and 1B crash, 2B covers 1B.'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', 'Delayed steal', 'first_and_third',
   'Runners on 1st and 3rd, catcher with a lazy return throw', 'R1 breaks on catcher''s return throw; R3 reads the throw to 2B.');

insert into public.play_calls (game_id, play_id, inning, outs, outcome) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a2', 4, 0, 'success'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', 2, 0, 'failure'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a3', 6, 1, 'success');

-- Development ------------------------------------------------------------------
insert into public.measurements (player_id, metric_key, measured_on, value, context) values
  ('00000000-0000-0000-0000-0000000000c1', 'exit_velo_tee', '2026-08-01', 58.5, 'Preseason testing'),
  ('00000000-0000-0000-0000-0000000000c1', 'exit_velo_tee', '2026-09-15', 61.0, 'Mid-season'),
  ('00000000-0000-0000-0000-0000000000c1', 'exit_velo_tee', '2026-10-20', 60.2, 'Late season'),
  ('00000000-0000-0000-0000-0000000000c4', 'home_to_first_slap', '2026-08-01', 3.10, 'Preseason testing'),
  ('00000000-0000-0000-0000-0000000000c4', 'home_to_first_slap', '2026-10-20', 2.95, 'Late season');

insert into public.development_goals (player_id, season_id, area, title, metric_key, baseline_value, target_value, target_date) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'hitting',
   'Tee exit velo to 63 mph', 'exit_velo_tee', 58.5, 63.0, '2026-11-15');

insert into public.skill_evaluations (player_id, area, rating, evaluated_on, comments) values
  ('00000000-0000-0000-0000-0000000000c1', 'infield', 4, '2026-09-01', 'Strong arm; work on backhand footwork.'),
  ('00000000-0000-0000-0000-0000000000c4', 'short_game', 5, '2026-09-01', 'Best slapper on the team.');

insert into public.drills (id, name, area, description, equipment) values
  ('00000000-0000-0000-0000-0000000000a4', 'Two-strike tee', 'hitting',
   'Low tee at the knees; shorten up, drive the ball middle-oppo.', 'Tee, net');

insert into public.drill_assignments (player_id, drill_id, prescription, assigned_on, due_on) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a4', '3x15, 3 days a week', '2026-09-20', '2026-10-04');

insert into public.coach_notes (player_id, game_id, area, note) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e2', 'hitting',
   'Chased two drops below the zone with 2 strikes. Good HR on a hanging changeup.');
