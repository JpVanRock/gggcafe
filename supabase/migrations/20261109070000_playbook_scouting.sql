-- =============================================================================
-- Team playbook & scouting (SB Blueprint Phase 8, user 2026-11-08)
--   23 Depth chart: a ranked list of players per field position (head-coach writes,
--      like GameDay, which suggests a rotation from it). The organization playbook is
--      playbook_plays (team_id null = all our teams); a play can sit on the install
--      checklist (install_items.play_id) so coaches see which systems practices covered.
--   94 Team call sheet: plays a coach puts on the call sheet (call_sheet) are readable
--      by players on that team, who drill them as flashcards; coaches write short team
--      quizzes (team_quizzes / team_quiz_questions), answered through definer functions
--      that grade on the server. How the signs are given is never stored (no column).
--   22 Guided scouting checklist: saved as scouting_reports rows (tags 'checklist' +
--      the prompt key); no schema change.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Depth chart
-- -----------------------------------------------------------------------------
create table public.depth_chart (
  team_id   uuid not null references public.teams (id) on delete cascade,
  position  text not null check (position in ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF')),
  player_id uuid not null references public.players (id) on delete cascade,
  rank      smallint not null check (rank between 1 and 30),
  primary key (team_id, position, player_id)
);
select private.apply_staff_rls('public.depth_chart');
select private.apply_head_coach_writes('public.depth_chart');

-- -----------------------------------------------------------------------------
-- Playbook: the call sheet players see, and links to the install checklist
-- -----------------------------------------------------------------------------
alter table public.playbook_plays
  add column call_sheet boolean not null default false;

create policy "players read their team's call sheet" on public.playbook_plays for select to authenticated
  using (
    call_sheet and active
    and (team_id in (select private.my_current_team_ids())
         or (team_id is null and exists (select 1 from private.my_current_team_ids())))
  );

alter table public.install_items
  add column play_id uuid references public.playbook_plays (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Team quizzes
-- -----------------------------------------------------------------------------
create table public.team_quizzes (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  published_at timestamptz,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index team_quizzes_team_idx on public.team_quizzes (team_id);
select private.apply_staff_rls('public.team_quizzes');
create policy "players read their team's published quizzes" on public.team_quizzes for select to authenticated
  using (published_at is not null and team_id in (select private.my_current_team_ids()));

create table public.team_quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.team_quizzes (id) on delete cascade,
  position      smallint not null default 0,
  play_id       uuid references public.playbook_plays (id) on delete set null,
  question      text not null check (char_length(question) between 1 and 300),
  choices       text[] not null check (array_length(choices, 1) between 2 and 5),
  correct_index smallint not null,
  explanation   text check (char_length(explanation) <= 500),
  check (correct_index >= 0 and correct_index < array_length(choices, 1))
);
create index team_quiz_questions_quiz_idx on public.team_quiz_questions (quiz_id, position);
-- Staff only: players get the questions (without answers) through team_quiz_for().
select private.apply_staff_rls('public.team_quiz_questions');

create table public.team_quiz_answers (
  player_id     uuid not null references public.players (id) on delete cascade,
  question_id   uuid not null references public.team_quiz_questions (id) on delete cascade,
  chosen_index  smallint not null check (chosen_index >= 0),
  is_correct    boolean not null,      -- her latest answer
  first_correct boolean not null,      -- her first answer (the score)
  tries         smallint not null default 1 check (tries >= 1),
  answered_at   timestamptz not null default now(),
  primary key (player_id, question_id)
);
alter table public.team_quiz_answers enable row level security;
create policy "staff can read" on public.team_quiz_answers for select to authenticated using ((select private.is_staff()));
create policy "players read their own" on public.team_quiz_answers for select to authenticated
  using (player_id in (select private.my_player_ids()));
-- No write policies: answers go through answer_team_quiz().

-- Is this published quiz for one of the player's teams (active roster spot)?
create function private.quiz_open_to(p_player_id uuid, p_quiz_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_quizzes q
      join public.roster_entries r on r.team_id = q.team_id and r.player_id = p_player_id and r.active
     where q.id = p_quiz_id and q.published_at is not null
  )
$$;
revoke all on function private.quiz_open_to(uuid, uuid) from public;

-- The quiz's questions for her, without the answer key until she has answered.
create function private.team_quiz_for(p_player_id uuid, p_quiz_id uuid)
returns table (id uuid, sort smallint, question text, choices text[], chosen_index smallint,
               is_correct boolean, first_correct boolean, correct_index smallint, explanation text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.can_act_for(p_player_id)) or not private.quiz_open_to(p_player_id, p_quiz_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select q.id, q.position, q.question, q.choices, a.chosen_index, a.is_correct, a.first_correct,
           case when a.player_id is not null then q.correct_index end,
           case when a.player_id is not null then q.explanation end
      from public.team_quiz_questions q
      left join public.team_quiz_answers a on a.question_id = q.id and a.player_id = p_player_id
     where q.quiz_id = p_quiz_id
     order by q.position, q.id;
end $$;
revoke all on function private.team_quiz_for(uuid, uuid) from public;
grant execute on function private.team_quiz_for(uuid, uuid) to authenticated;
create function public.team_quiz_for(p_player_id uuid, p_quiz_id uuid)
returns table (id uuid, sort smallint, question text, choices text[], chosen_index smallint,
               is_correct boolean, first_correct boolean, correct_index smallint, explanation text)
language sql stable security invoker set search_path = '' as $$ select * from private.team_quiz_for(p_player_id, p_quiz_id) $$;
revoke all on function public.team_quiz_for(uuid, uuid) from public, anon;
grant execute on function public.team_quiz_for(uuid, uuid) to authenticated;

-- Grade and record one answer; her first answer to a question is her score, later
-- tries only update the latest answer.
create function private.answer_team_quiz(p_player_id uuid, p_question_id uuid, p_chosen smallint)
returns table (is_correct boolean, correct_index smallint, explanation text)
language plpgsql security definer set search_path = '' as $$
declare
  v_q public.team_quiz_questions%rowtype;
  v_ok boolean;
begin
  select * into v_q from public.team_quiz_questions where id = p_question_id;
  if not found then
    raise exception 'unknown question' using errcode = 'P0002';
  end if;
  if not (select private.can_act_for(p_player_id)) or not private.quiz_open_to(p_player_id, v_q.quiz_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_chosen is null or p_chosen < 0 or p_chosen >= array_length(v_q.choices, 1) then
    raise exception 'bad choice' using errcode = '22023';
  end if;
  v_ok := p_chosen = v_q.correct_index;
  insert into public.team_quiz_answers as a (player_id, question_id, chosen_index, is_correct, first_correct)
  values (p_player_id, p_question_id, p_chosen, v_ok, v_ok)
  on conflict (player_id, question_id) do update
    set chosen_index = excluded.chosen_index, is_correct = excluded.is_correct, tries = a.tries + 1, answered_at = now();
  return query select v_ok, v_q.correct_index, v_q.explanation;
end $$;
revoke all on function private.answer_team_quiz(uuid, uuid, smallint) from public;
grant execute on function private.answer_team_quiz(uuid, uuid, smallint) to authenticated;
create function public.answer_team_quiz(p_player_id uuid, p_question_id uuid, p_chosen smallint)
returns table (is_correct boolean, correct_index smallint, explanation text)
language sql security invoker set search_path = '' as $$ select * from private.answer_team_quiz(p_player_id, p_question_id, p_chosen) $$;
revoke all on function public.answer_team_quiz(uuid, uuid, smallint) from public, anon;
grant execute on function public.answer_team_quiz(uuid, uuid, smallint) to authenticated;

-- Her team's published quizzes with her progress (players can't read the questions table).
create function private.team_quizzes_for(p_player_id uuid)
returns table (id uuid, title text, team_name text, published_at timestamptz, total int, answered int, first_try int, to_fix int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.can_act_for(p_player_id)) and not (select private.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select q.id, q.title, t.name, q.published_at,
           count(qq.id)::int,
           count(a.player_id)::int,
           count(a.player_id) filter (where a.first_correct)::int,
           count(a.player_id) filter (where not a.is_correct)::int
      from public.team_quizzes q
      join public.teams t on t.id = q.team_id
      left join public.team_quiz_questions qq on qq.quiz_id = q.id
      left join public.team_quiz_answers a on a.question_id = qq.id and a.player_id = p_player_id
     where q.published_at is not null
       and q.team_id in (select r.team_id from public.roster_entries r where r.player_id = p_player_id and r.active)
     group by q.id, q.title, t.name, q.published_at
     order by q.published_at desc;
end $$;
revoke all on function private.team_quizzes_for(uuid) from public;
grant execute on function private.team_quizzes_for(uuid) to authenticated;
create function public.team_quizzes_for(p_player_id uuid)
returns table (id uuid, title text, team_name text, published_at timestamptz, total int, answered int, first_try int, to_fix int)
language sql stable security invoker set search_path = '' as $$ select * from private.team_quizzes_for(p_player_id) $$;
revoke all on function public.team_quizzes_for(uuid) from public, anon;
grant execute on function public.team_quizzes_for(uuid) to authenticated;
