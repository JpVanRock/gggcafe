-- =============================================================================
-- GGG.Cafe — IQ Test
-- A shared bank of multiple-choice game scenarios, tagged General, Hitting IQ,
-- Pitching IQ, or a specific position, and each player's answers.
-- Includes a starter set of fastpitch questions that coaches can edit.
-- =============================================================================

create type public.iq_topic as enum ('general', 'hitting', 'pitching', 'position');

create table public.iq_questions (
  id            uuid primary key default gen_random_uuid(),
  topic         public.iq_topic not null default 'general',
  position      public.field_position,           -- set only for position questions
  scenario      text not null,                   -- the game situation
  question      text not null,
  choices       text[] not null,
  correct_index smallint not null,
  explanation   text,
  difficulty    smallint not null default 1 check (difficulty between 1 and 3),
  active        boolean not null default true,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (array_length(choices, 1) between 2 and 5),
  check (correct_index >= 0 and correct_index < array_length(choices, 1)),
  check ((topic = 'position') = (position is not null))
);
create index iq_questions_topic_idx on public.iq_questions (topic, position) where active;

create table public.iq_answers (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players (id) on delete cascade,
  question_id  uuid not null references public.iq_questions (id) on delete cascade,
  chosen_index smallint not null check (chosen_index >= 0),
  is_correct   boolean not null,        -- kept as answered, even if the question is edited later
  answered_on  date not null default current_date,
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index iq_answers_player_idx on public.iq_answers (player_id, question_id);

create trigger set_updated_at before update on public.iq_questions
  for each row execute function private.set_updated_at();

select private.apply_staff_rls('public.iq_questions');
select private.apply_staff_rls('public.iq_answers');

-- -----------------------------------------------------------------------------
-- Starter questions (fastpitch). Edit or deactivate them from the IQ Test pop-up.
-- -----------------------------------------------------------------------------
insert into public.iq_questions (topic, position, scenario, question, choices, correct_index, explanation, difficulty) values
-- General / baserunning
('general', null,
 'You''re the runner on second base, nobody out. The batter hits a ground ball to the shortstop, in front of you.',
 'What do you do?',
 array['Take off for third right away', 'Hold at second unless the ball gets through', 'Go halfway and decide', 'Tag up and go on the throw to first'],
 1, 'Ball hit in front of you (to the left side), stay. Ball hit behind you (to the right side), go. Running into a fielder''s throw to third is an easy out.', 1),
('general', null,
 'Two outs, you''re the runner on second.',
 'When do you start running on a ground ball?',
 array['As soon as the ball is hit', 'Only if it gets through the infield', 'After the throw goes to first', 'Only on a fly ball'],
 0, 'With two outs, the next out ends the inning, so there is nothing to protect. Run hard on any contact.', 1),
('general', null,
 'Runners on first and second, one out. The batter pops the ball up high over the infield.',
 'What should the runners do?',
 array['Run hard; it might be dropped', 'Stay close to their bases; the batter is out on the infield fly rule', 'Tag up and try to advance before the catch', 'Go halfway between bases'],
 1, 'Infield fly: fewer than two outs, runners on first and second (or bases loaded), fair pop-up an infielder can catch with ordinary effort. The batter is out, and runners advance at their own risk. Stay close and tag if it''s caught.', 2),
('general', null,
 'You''re standing a few steps off first base. The pitcher has the ball in the circle and is looking at you.',
 'What does the look-back rule say you must do?',
 array['You can stay where you are as long as you want', 'Immediately go back to the base or go for the next base', 'Wait for the pitcher to throw over', 'Take one more step to draw a throw'],
 1, 'Once the pitcher has the ball in the circle, a runner who is off the base must immediately return or go for the next base. Stopping, or turning back once you''ve started, gets you called out.', 2),
-- Hitting IQ
('hitting', null,
 'You''re behind 0-2 against a pitcher with a good drop ball.',
 'What''s your approach?',
 array['Swing hard at the first pitch near the zone', 'Shorten up, protect the plate, put the ball in play', 'Take until you get a strike', 'Look for a walk'],
 1, 'With two strikes, choke up and shorten the swing, widen your zone a little, and battle. A ball in play can score runs; a strikeout can''t.', 1),
('hitting', null,
 'Runner on third, one out, the infield is playing back.',
 'What''s your job at the plate?',
 array['Hit a home run', 'Get the run in: a fly ball to the outfield or a ground ball up the middle', 'Bunt for a hit', 'Take a strike to let the runner steal'],
 1, 'With the infield back they''ll trade the out for the run. A fly ball deep enough to tag up, or a grounder to the middle infield, scores the run.', 1),
('hitting', null,
 'Count is 3-1. The pitcher has missed high with her rise ball three times.',
 'What should you do?',
 array['Swing at anything close', 'Sit on a pitch in your zone and lay off the high rise', 'Bunt to surprise the defense', 'Take no matter what'],
 1, 'It''s a hitter''s count: hunt one pitch in one zone. If it''s the high rise again, take it. It''s probably ball four.', 2),
('hitting', null,
 'Runner on first, nobody out. The corners are crashing hard because they expect a bunt.',
 'What''s a smart way to make them pay?',
 array['Bunt anyway, harder', 'Slash: show bunt, pull back, and chop the ball past the charging corners', 'Take the pitch', 'Swing for the fence'],
 1, 'Slash (fake bunt and swing) punishes corners who crash early. A short, downward swing gets it past them before they can recover.', 2),
-- Pitching IQ
('pitching', null,
 'You''re ahead 0-2 on a strong hitter.',
 'What pitch makes the most sense?',
 array['A fastball right down the middle', 'A pitch just off the plate she might chase, like a rise up or a drop below the zone', 'Your slowest changeup over the plate', 'Anything; she''s already down 0-2'],
 1, 'Ahead in the count you can expand the zone. Don''t give in over the middle. Make her chase your best pitch just out of the zone.', 1),
('pitching', null,
 'Runner on first, nobody out. The batter squares to bunt early.',
 'Where do you want your pitch?',
 array['Low and away', 'Up in the zone, like a rise ball', 'Right down the middle so it''s a strike', 'A changeup'],
 1, 'High pitches are the hardest to bunt down. They tend to get popped up.', 2),
('pitching', null,
 'Lead-off batter of the inning, and you''re behind 3-0.',
 'What''s the priority?',
 array['Throw your nastiest pitch for a chase', 'Throw a strike with your most reliable pitch', 'Intentionally walk her', 'Throw over to first'],
 1, 'Lead-off walks score often. Trust your most reliable strike pitch and make her hit it.', 1),
('pitching', null,
 'Runner on third, one out. A ground ball comes right back to you.',
 'What do you do?',
 array['Throw home immediately', 'Look the runner back to third, then throw to first', 'Run at the runner', 'Throw to third'],
 1, 'Check the runner first. If she''s frozen or heading back, get the sure out at first. If she breaks for home, you can throw home.', 2),
-- Position
('position', 'C',
 'High pop-up behind home plate.',
 'Which way will the ball drift, and how do you play it?',
 array['Toward the backstop: chase it hard', 'Back toward the infield: turn your back to the field, mask off, and let it come to you', 'Straight down: stay put', 'Toward first base'],
 1, 'Spin on a foul pop-up behind the plate carries it back toward the infield. Find it, toss the mask away from where you''re going, and keep the infield in front of you.', 2),
('position', 'SS',
 'Runner on first, nobody out. Ground ball to the second baseman.',
 'Where do you go?',
 array['Back up the second baseman', 'Cover second base for the force and the double-play turn', 'Cover third base', 'Stay at shortstop'],
 1, 'Ball to the right side, the shortstop covers second. Get there early, catch, step, and throw to first for two.', 1),
('position', '2B',
 'Runner on first, nobody out. Ground ball to the shortstop.',
 'Where do you go?',
 array['Cover first base', 'Cover second base for the force', 'Back up the shortstop', 'Cover the bag at third'],
 1, 'Ball to the left side, the second baseman covers second for the force and the turn.', 1),
('position', '1B',
 'Runner on first, nobody out. Bunt down the first-base line and you charge to field it.',
 'Who covers first base?',
 array['The pitcher', 'The second baseman', 'The right fielder', 'Nobody, so throw to second'],
 1, 'In standard bunt coverage the second baseman slides over to cover first when the first baseman charges.', 1),
('position', '3B',
 'Runner on second, nobody out. The batter squares to bunt and you charge.',
 'Who covers third?',
 array['The pitcher', 'The shortstop', 'The left fielder', 'The catcher'],
 1, 'When the third baseman crashes, the shortstop rotates over to cover third.', 2),
('position', 'LF',
 'Nobody on base. Line drive single to left field.',
 'Where do you throw?',
 array['Home plate', 'Second base, to keep the batter at first', 'First base', 'Third base'],
 1, 'Throw ahead of the runner to the next base. With nobody on, that''s second, which holds her to a single.', 1),
('position', 'CF',
 'Fly ball in the gap. You and the left fielder both call it.',
 'Who takes it?',
 array['The left fielder, who called it first', 'The center fielder, who has priority', 'Whoever is closer', 'Let it drop'],
 1, 'The center fielder has priority over the corner outfielders. Call it loud and early; the corner backs you up.', 1),
('position', 'RF',
 'Nobody on base. Ground ball to the shortstop.',
 'Where should you go?',
 array['Stay in right field', 'Back up first base in case the throw gets away', 'Cover second base', 'Back up the shortstop'],
 1, 'On any infield throw to first, the right fielder backs up first base.', 1),
('position', 'P',
 'Nobody on base. Ground ball to the first baseman, who has to range to her right to field it.',
 'What do you do?',
 array['Stay in the circle', 'Sprint to cover first base and take the throw', 'Back up the first baseman', 'Cover second base'],
 1, 'Any ball hit to the right side, the pitcher breaks toward first. If the first baseman can''t get back to the bag, you take the throw.', 1);
