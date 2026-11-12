-- Team Hitting Philosophy and the Throwing Program (user, 2026-11-12).
-- The head coach writes both in Coaches Dugout → Training; every coach reads them;
-- players read their own team's on their Team page (and her approved parent, viewing
-- as her). The throwing program is for position players, not pitchers, in three
-- groups: outies (outfielders), innies (infielders) and catchers.
-- Starters and the form's limits live in src/lib/team-programs.ts.

create table public.team_hitting_philosophy (
  team_id    uuid primary key references public.teams (id) on delete cascade,
  statement  text check (char_length(statement) <= 600),
  -- [{title, body}], in order
  sections   jsonb not null default '[]'::jsonb
             check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) <= 12),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table public.team_hitting_philosophy is
  'A team''s hitting philosophy: a statement and titled sections, written by the head coach (src/lib/team-programs.ts).';

create table public.team_throwing_programs (
  team_id    uuid not null references public.teams (id) on delete cascade,
  grp        text not null check (grp in ('outies', 'innies', 'catchers')),
  intro      text check (char_length(intro) <= 800),
  -- [{name, dose, cue}], in order
  steps      jsonb not null default '[]'::jsonb
             check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, grp)
);
comment on table public.team_throwing_programs is
  'A team''s throwing program for position players, one per group (outies, innies, catchers), written by the head coach.';

-- staff read, head coaches and admins write
select private.apply_staff_rls('public.team_hitting_philosophy');
select private.apply_head_coach_writes('public.team_hitting_philosophy');
select private.apply_staff_rls('public.team_throwing_programs');
select private.apply_head_coach_writes('public.team_throwing_programs');

-- players read their current teams' (parents, viewing as her, read the same)
create policy "player reads her team's hitting philosophy" on public.team_hitting_philosophy for select to authenticated
  using (team_id in (select private.my_current_team_ids()));
create policy "player reads her team's hitting philosophy (parent view)" on public.team_hitting_philosophy for select to authenticated
  using (team_id in (select private.my_child_team_ids()));
create policy "player reads her team's throwing program" on public.team_throwing_programs for select to authenticated
  using (team_id in (select private.my_current_team_ids()));
create policy "player reads her team's throwing program (parent view)" on public.team_throwing_programs for select to authenticated
  using (team_id in (select private.my_child_team_ids()));

-- updated_at and who changed it last (the existing trigger functions)
create trigger set_updated_at before update on public.team_hitting_philosophy
  for each row execute function private.set_updated_at();
create trigger set_updated_by before update on public.team_hitting_philosophy
  for each row execute function private.set_updated_by();
create trigger set_updated_at before update on public.team_throwing_programs
  for each row execute function private.set_updated_at();
create trigger set_updated_by before update on public.team_throwing_programs
  for each row execute function private.set_updated_by();
