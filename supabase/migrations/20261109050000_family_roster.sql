-- =============================================================================
-- Family & roster (SB Blueprint Phase 6, user 2026-11-08)
--   106 Preseason questionnaire: sizes, top three jersey numbers, positions she wants,
--       experience and goals, per team and season (player_questionnaires). She, her
--       approved parents (through the functions below) and coaches fill it; teammates
--       never see it.
--   7   Parent welcome packet: the coach's letter, key policies and "how to help her"
--       tips on /family (parent_packet_items), each marked read (parent_packet_reads).
--       Head-coach writes (the Parents tab).
--   9   Medical & emergency card (medical_cards): visible ONLY to head coaches/admins
--       and her approved parents (user, 2026-11-08). Not assistants, viewers, mentors,
--       teammates or the player. No documents, just what's needed at a game.
-- Parents read no app tables; they use the security-definer functions here.
-- =============================================================================

-- Teams where the signed-in parent is approved for a daughter
create function private.my_parent_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct team_id from public.parent_links where parent_id = (select auth.uid()) and status = 'approved'
$$;
revoke all on function private.my_parent_team_ids() from public;
grant execute on function private.my_parent_team_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- 106 Preseason questionnaire
-- -----------------------------------------------------------------------------
create table public.player_questionnaires (
  player_id   uuid not null references public.players (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  season_id   uuid not null references public.seasons (id) on delete cascade,
  top_size    text check (top_size in ('YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL', 'A3XL')),
  bottom_size text check (bottom_size in ('YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL', 'A3XL')),
  jacket_size text check (jacket_size in ('YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL', 'A3XL')),
  hat_size    text check (char_length(hat_size) <= 12),
  numbers     text[] not null default '{}' check (cardinality(numbers) <= 3),
  positions   text[] not null default '{}' check (cardinality(positions) <= 4),
  experience  text check (char_length(experience) <= 300),
  goals       text check (char_length(goals) <= 500),
  notes       text check (char_length(notes) <= 300),
  updated_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (player_id, team_id, season_id)
);
select private.apply_staff_rls('public.player_questionnaires');
create policy "player keeps her own questionnaire" on public.player_questionnaires for all to authenticated
  using (player_id in (select private.my_player_ids()))
  with check (player_id in (select private.my_player_ids()) and team_id in (select private.my_current_team_ids()));

-- Her parent: the questionnaire for the team the coach approved them on, current season.
create function private.parent_questionnaire(p_player_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_team uuid;
begin
  if not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent' using errcode = '42501';
  end if;
  select team_id into v_team from public.parent_links
   where parent_id = (select auth.uid()) and player_id = p_player_id and status = 'approved'
   order by decided_at desc nulls last limit 1;
  return (select to_jsonb(q) from public.player_questionnaires q
           where q.player_id = p_player_id and q.team_id = v_team and q.season_id = private.team_current_season(v_team));
end;
$$;

create function private.save_parent_questionnaire(p_player_id uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_team   uuid;
  v_season uuid;
begin
  if not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent' using errcode = '42501';
  end if;
  select team_id into v_team from public.parent_links
   where parent_id = (select auth.uid()) and player_id = p_player_id and status = 'approved'
   order by decided_at desc nulls last limit 1;
  v_season := private.team_current_season(v_team);
  if v_season is null then
    raise exception 'the team has no roster this season yet' using errcode = 'P0006';
  end if;
  insert into public.player_questionnaires
    (player_id, team_id, season_id, top_size, bottom_size, jacket_size, hat_size, numbers, positions, experience, goals, notes, updated_by, updated_at)
  values (p_player_id, v_team, v_season,
          nullif(p_data ->> 'top_size', ''), nullif(p_data ->> 'bottom_size', ''), nullif(p_data ->> 'jacket_size', ''),
          nullif(p_data ->> 'hat_size', ''),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data -> 'numbers', '[]')) x), '{}'),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data -> 'positions', '[]')) x), '{}'),
          nullif(p_data ->> 'experience', ''), nullif(p_data ->> 'goals', ''), nullif(p_data ->> 'notes', ''),
          (select auth.uid()), now())
  on conflict (player_id, team_id, season_id) do update set
    top_size = excluded.top_size, bottom_size = excluded.bottom_size, jacket_size = excluded.jacket_size,
    hat_size = excluded.hat_size, numbers = excluded.numbers, positions = excluded.positions,
    experience = excluded.experience, goals = excluded.goals, notes = excluded.notes,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- 9 Medical & emergency card
-- -----------------------------------------------------------------------------
create table public.medical_cards (
  player_id         uuid primary key references public.players (id) on delete cascade,
  contact1_name     text check (char_length(contact1_name) <= 80),
  contact1_relation text check (char_length(contact1_relation) <= 40),
  contact1_phone    text check (char_length(contact1_phone) <= 30),
  contact2_name     text check (char_length(contact2_name) <= 80),
  contact2_relation text check (char_length(contact2_relation) <= 40),
  contact2_phone    text check (char_length(contact2_phone) <= 30),
  allergies         text check (char_length(allergies) <= 500),
  conditions        text check (char_length(conditions) <= 500),
  medications       text check (char_length(medications) <= 500),
  physician         text check (char_length(physician) <= 120),
  insurance         text check (char_length(insurance) <= 120),
  notes             text check (char_length(notes) <= 500),
  updated_by        uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now()
);
comment on table public.medical_cards is
  'Medical & emergency card: head coaches/admins and her approved parents only (user, 2026-11-08).';
-- RLS exception (no apply_staff_rls): only head coaches and admins, never other staff;
-- parents use the functions below.
alter table public.medical_cards enable row level security;
create policy "head coaches only" on public.medical_cards for all to authenticated
  using ((select private.is_head_coach())) with check ((select private.is_head_coach()));

create function private.parent_medical_card(p_player_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent' using errcode = '42501';
  end if;
  return (select to_jsonb(m) - 'updated_by' from public.medical_cards m where m.player_id = p_player_id);
end;
$$;

create function private.save_parent_medical_card(p_player_id uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_parent_of(p_player_id)) then
    raise exception 'only her approved parent' using errcode = '42501';
  end if;
  insert into public.medical_cards (player_id, contact1_name, contact1_relation, contact1_phone, contact2_name, contact2_relation,
                                    contact2_phone, allergies, conditions, medications, physician, insurance, notes, updated_by, updated_at)
  values (p_player_id, nullif(p_data ->> 'contact1_name', ''), nullif(p_data ->> 'contact1_relation', ''), nullif(p_data ->> 'contact1_phone', ''),
          nullif(p_data ->> 'contact2_name', ''), nullif(p_data ->> 'contact2_relation', ''), nullif(p_data ->> 'contact2_phone', ''),
          nullif(p_data ->> 'allergies', ''), nullif(p_data ->> 'conditions', ''), nullif(p_data ->> 'medications', ''),
          nullif(p_data ->> 'physician', ''), nullif(p_data ->> 'insurance', ''), nullif(p_data ->> 'notes', ''),
          (select auth.uid()), now())
  on conflict (player_id) do update set
    contact1_name = excluded.contact1_name, contact1_relation = excluded.contact1_relation, contact1_phone = excluded.contact1_phone,
    contact2_name = excluded.contact2_name, contact2_relation = excluded.contact2_relation, contact2_phone = excluded.contact2_phone,
    allergies = excluded.allergies, conditions = excluded.conditions, medications = excluded.medications,
    physician = excluded.physician, insurance = excluded.insurance, notes = excluded.notes,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- 7 Parent welcome packet
-- -----------------------------------------------------------------------------
create table public.parent_packet_items (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  kind       text not null default 'tip' check (kind in ('letter', 'policy', 'tip')),
  title      text not null check (char_length(title) between 1 and 100),
  body       text not null check (char_length(body) between 1 and 3000),
  position   smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index parent_packet_items_team_idx on public.parent_packet_items (team_id, position);
select private.apply_staff_rls('public.parent_packet_items');
select private.apply_head_coach_writes('public.parent_packet_items');
create policy "parents read their team's packet" on public.parent_packet_items for select to authenticated
  using (team_id in (select private.my_parent_team_ids()));

create table public.parent_packet_reads (
  parent_id uuid not null references public.parent_accounts (user_id) on delete cascade,
  item_id   uuid not null references public.parent_packet_items (id) on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (parent_id, item_id)
);
-- RLS exception: each parent marks their own reads; staff read them.
alter table public.parent_packet_reads enable row level security;
create policy "parents mark their own reads" on public.parent_packet_reads for all to authenticated
  using (parent_id = (select auth.uid()))
  with check (parent_id = (select auth.uid())
              and item_id in (select i.id from public.parent_packet_items i where i.team_id in (select private.my_parent_team_ids())));
create policy "staff read packet reads" on public.parent_packet_reads for select to authenticated
  using ((select private.is_staff()));

-- Public wrappers for the parent functions
revoke all on function private.parent_questionnaire(uuid), private.save_parent_questionnaire(uuid, jsonb),
  private.parent_medical_card(uuid), private.save_parent_medical_card(uuid, jsonb) from public;
grant execute on function private.parent_questionnaire(uuid), private.save_parent_questionnaire(uuid, jsonb),
  private.parent_medical_card(uuid), private.save_parent_medical_card(uuid, jsonb) to authenticated;
create function public.parent_questionnaire(p_player_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.parent_questionnaire(p_player_id) $$;
create function public.save_parent_questionnaire(p_player_id uuid, p_data jsonb) returns void
language sql security invoker set search_path = '' as $$ select private.save_parent_questionnaire(p_player_id, p_data) $$;
create function public.parent_medical_card(p_player_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.parent_medical_card(p_player_id) $$;
create function public.save_parent_medical_card(p_player_id uuid, p_data jsonb) returns void
language sql security invoker set search_path = '' as $$ select private.save_parent_medical_card(p_player_id, p_data) $$;
revoke all on function public.parent_questionnaire(uuid), public.save_parent_questionnaire(uuid, jsonb),
  public.parent_medical_card(uuid), public.save_parent_medical_card(uuid, jsonb) from public, anon;
grant execute on function public.parent_questionnaire(uuid), public.save_parent_questionnaire(uuid, jsonb),
  public.parent_medical_card(uuid), public.save_parent_medical_card(uuid, jsonb) to authenticated;
