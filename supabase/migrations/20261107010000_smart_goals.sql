-- =============================================================================
-- GGG.Cafe — SMART goals as a lighter alternative to the Harada chart
--
-- Each player picks which goal method their dashboard shows. Switching never
-- deletes the other method's goals.
-- SMART goals reuse public.development_goals (title = the goal; metric_key /
-- target_value make it measurable against recorded measurements; target_date
-- is the "time-bound" part) and gain the written S/M/A/R answers.
-- =============================================================================

create type public.goal_method as enum ('harada', 'smart');

alter table public.players
  add column goal_method public.goal_method not null default 'harada';
comment on column public.players.goal_method is
  'Which goal method the player dashboard shows: the full Harada chart or lighter SMART goals.';

alter table public.development_goals
  add column specific   text,   -- S: exactly what will be accomplished
  add column measurable text,   -- M: how progress is measured
  add column achievable text,   -- A: why it is realistic / what support is needed
  add column relevant   text;   -- R: why it matters to the player
-- T (time-bound) is target_date.

alter table public.development_goals
  add constraint development_goals_achieved_on_check
  check (achieved_on is null or status = 'achieved');
