-- My signals archived (user, 2026-11-23: "archive the green yellow red section", and take it out of the training).
-- The site no longer shows or edits the green / yellow / red signs and their releases; the columns on
-- mental_game_plans keep what players wrote (archived, not deleted), so it can come back. Her zone stays: it moved
-- to the Intensity check section.
--
-- Two guided sessions (drills in the training library) talked in red and green: new names and descriptions. The
-- guide slugs stay (lessons and routines point at them).
update public.drills
   set name = 'Guided: Long Exhale',
       description = 'A long, slow breath out to settle down when the game speeds up. About 2 minutes.'
 where guide = 'red-light-breath';

update public.drills
   set description = 'See your pre-game from arrival to first pitch and walk on the field locked in. About 3 minutes.'
 where guide = 'game-face';

comment on column public.mental_game_plans.green_signs is 'Archived 2026-11-23 (My signals): kept, not shown on the site.';
comment on column public.mental_game_plans.yellow_signs is 'Archived 2026-11-23 (My signals): kept, not shown on the site.';
comment on column public.mental_game_plans.red_signs is 'Archived 2026-11-23 (My signals): kept, not shown on the site.';
comment on column public.mental_game_plans.yellow_release is 'Archived 2026-11-23 (My signals): kept, not shown on the site.';
comment on column public.mental_game_plans.red_release is 'Archived 2026-11-23 (My signals): kept, not shown on the site.';
