-- =============================================================================
-- GGG.Cafe — G3 Leadership Guide (part of G3 Advanced)
--
-- A player sees the Leadership Guide when she has G3 Advanced AND a coach or
-- admin has picked her to train as a leader (player_leadership_access). Lessons
-- live in src/lib/leadership-guide.ts; here we keep her work: answers and steps
-- per lesson, her Leadership Plan, and her coach's ratings and sign-off.
-- =============================================================================

-- Players a coach or admin is training as leaders.
create table public.player_leadership_access (
  player_id  uuid primary key references public.players (id) on delete cascade,
  granted_by uuid default auth.uid() references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);
comment on table public.player_leadership_access is
  'G3 Leadership Guide: players a coach or admin picked to train as leaders (also needs G3 Advanced).';
select private.apply_staff_rls('public.player_leadership_access');
create policy "player sees she's a leader" on public.player_leadership_access for select to authenticated
  using (player_id in (select private.my_player_ids()));

create function private.has_leadership(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.player_advanced_access where player_id = p_player_id)
     and exists (select 1 from public.player_leadership_access where player_id = p_player_id)
$$;
revoke all on function private.has_leadership(uuid) from public;
grant execute on function private.has_leadership(uuid) to authenticated;

-- Her work on each lesson (slug from src/lib/leadership-guide.ts).
create table public.player_leadership_lessons (
  player_id    uuid not null references public.players (id) on delete cascade,
  lesson       text not null check (lesson ~ '^[a-z0-9-]{1,40}$'),
  answers      jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  steps        text[] not null default '{}' check (cardinality(steps) <= 10),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (player_id, lesson)
);
comment on table public.player_leadership_lessons is
  'G3 Leadership Guide: her answers (questions, habits, self-ratings), the steps she did, and when she finished each lesson.';

-- Her Leadership Plan, and when she committed to it.
create table public.player_leadership_plans (
  player_id    uuid primary key references public.players (id) on delete cascade,
  plan         jsonb not null default '{}'::jsonb check (jsonb_typeof(plan) = 'object'),
  committed_at timestamptz,
  updated_at   timestamptz not null default now()
);
comment on table public.player_leadership_plans is 'G3 Leadership Guide: her Leadership Plan.';

-- Her coach's side: ratings (same rubric she rates herself on) and the plan sign-off.
create table public.player_leadership_reviews (
  player_id  uuid primary key references public.players (id) on delete cascade,
  ratings    jsonb not null default '{}'::jsonb check (jsonb_typeof(ratings) = 'object'),
  signed_at  timestamptz,
  signed_by  uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table public.player_leadership_reviews is 'G3 Leadership Guide: the coach''s ratings and plan sign-off (coaches write, she reads).';

select private.apply_staff_rls('public.player_leadership_lessons');
select private.apply_staff_rls('public.player_leadership_plans');
select private.apply_staff_rls('public.player_leadership_reviews');
create policy "player keeps her own lessons" on public.player_leadership_lessons for all to authenticated
  using (player_id in (select private.my_player_ids()) and (select private.has_leadership(player_id)))
  with check (player_id in (select private.my_player_ids()) and (select private.has_leadership(player_id)));
create policy "player keeps her own plan" on public.player_leadership_plans for all to authenticated
  using (player_id in (select private.my_player_ids()) and (select private.has_leadership(player_id)))
  with check (player_id in (select private.my_player_ids()) and (select private.has_leadership(player_id)));
create policy "player reads her coach's review" on public.player_leadership_reviews for select to authenticated
  using (player_id in (select private.my_player_ids()) and (select private.has_leadership(player_id)));

-- Her Certificate of Leadership (and the Leader Badge): awarded when her coach signs
-- off a finished course (every core lesson done, plan committed). team_id is her team
-- at the time, for the logo on the certificate.
-- Exception to apply_staff_rls (user's rule): only coaches/admins and the player herself
-- see it. View-only staff don't.
create table public.player_leadership_certificates (
  player_id  uuid primary key references public.players (id) on delete cascade,
  team_id    uuid references public.teams (id) on delete set null,
  awarded_at timestamptz not null default now(),
  awarded_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- the coach's name as signed on the certificate (players can't read the staff list)
  coach_name text check (coach_name is null or char_length(coach_name) <= 120)
);
comment on table public.player_leadership_certificates is
  'G3 Leadership Guide: Certificate of Leadership and Leader Badge. Coaches/admins and the player herself only.';
alter table public.player_leadership_certificates enable row level security;
create policy "coaches read certificates" on public.player_leadership_certificates for select to authenticated
  using ((select private.can_edit()));
create policy "coaches award certificates" on public.player_leadership_certificates for insert to authenticated
  with check ((select private.can_edit()));
create policy "coaches change certificates" on public.player_leadership_certificates for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "coaches take back certificates" on public.player_leadership_certificates for delete to authenticated
  using ((select private.can_edit()));
create policy "player sees her certificate" on public.player_leadership_certificates for select to authenticated
  using (player_id in (select private.my_player_ids()));
