-- =============================================================================
-- GGG.Cafe — Coaches Dugout
--
-- Team Standards + Team Culture: written by coaches for each team, shown to
--   players on their dashboard (above TWIS).
-- Practice plans: a shared, tagged drill library, and plans built from it.
--   A plan has a setup (date, indoor/outdoor, total time), drills in order
--   (minutes, coaches, equipment) and a field with players at positions (more
--   than one player per position is fine). Finalized plans print to PDF or are
--   emailed to the coaching staff.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Team Standards and Team Culture
-- -----------------------------------------------------------------------------
create table public.team_culture (
  team_id    uuid primary key references public.teams (id) on delete cascade,
  headline   text check (char_length(headline) <= 120),     -- optional one-liner
  statement  text check (char_length(statement) <= 4000),   -- the description
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.team_standards (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  position   smallint not null check (position between 1 and 25),
  title      text not null check (char_length(title) between 1 and 140),
  detail     text check (char_length(detail) <= 800),
  created_at timestamptz not null default now(),
  unique (team_id, position)
);

select private.apply_staff_rls('public.team_culture');
select private.apply_staff_rls('public.team_standards');

-- Saves a team's culture and replaces its standards list in one transaction.
-- p_standards: [{"title", "detail"}] in display order; blank titles are skipped.
create function public.save_team_dugout(p_team_id uuid, p_headline text, p_statement text, p_standards jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_item jsonb;
  v_pos  smallint := 0;
begin
  if not (select private.can_edit()) then
    raise exception 'only coaches and admins can change team standards' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_standards, '[]'::jsonb)) <> 'array' then
    raise exception 'standards must be a list' using errcode = '22023';
  end if;

  insert into public.team_culture (team_id, headline, statement, updated_by, updated_at)
  values (p_team_id, nullif(trim(p_headline), ''), nullif(trim(p_statement), ''), auth.uid(), now())
  on conflict (team_id) do update
    set headline = excluded.headline, statement = excluded.statement,
        updated_by = excluded.updated_by, updated_at = now();

  delete from public.team_standards where team_id = p_team_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_standards, '[]'::jsonb)) loop
    continue when coalesce(trim(v_item ->> 'title'), '') = '';
    v_pos := v_pos + 1;
    insert into public.team_standards (team_id, position, title, detail)
    values (p_team_id, v_pos, trim(v_item ->> 'title'), nullif(trim(v_item ->> 'detail'), ''));
  end loop;
end;
$$;
revoke all on function public.save_team_dugout(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_team_dugout(uuid, text, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Drill library (shared by every team)
-- -----------------------------------------------------------------------------
create type public.drill_tag as enum
  ('infield', 'outfield', 'defense', 'catchers', 'pitchers', 'catchers_pitchers', 'warm_up', 'throwing');

create table public.practice_drills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  tags        public.drill_tag[] not null default '{}',
  equipment   text check (char_length(equipment) <= 500),   -- usual equipment; copied into plans
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index practice_drills_name_key on public.practice_drills (lower(name));
create trigger set_updated_at before update on public.practice_drills
  for each row execute function private.set_updated_at();
select private.apply_staff_rls('public.practice_drills');

-- -----------------------------------------------------------------------------
-- Practice plans
-- -----------------------------------------------------------------------------
create type public.practice_setting as enum ('outdoor', 'indoor');
create type public.practice_plan_status as enum ('draft', 'final');

create table public.practice_plans (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  practice_date date not null,
  start_time    time,
  setting       public.practice_setting not null default 'outdoor',
  total_minutes smallint not null check (total_minutes between 15 and 480),
  location      text check (char_length(location) <= 120),
  focus         text check (char_length(focus) <= 200),
  status        public.practice_plan_status not null default 'draft',
  finalized_at  timestamptz,
  shared_at     timestamptz,                -- last emailed to the coaching staff
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((status = 'final') = (finalized_at is not null))
);
create index practice_plans_team_date_idx on public.practice_plans (team_id, practice_date desc);
create trigger set_updated_at before update on public.practice_plans
  for each row execute function private.set_updated_at();

-- Drills in a plan. Name, description and tags are copied from the library when
-- added, so a printed plan stays the same if the library changes later. Custom
-- blocks (water break, team talk) have no drill_id.
create table public.practice_plan_drills (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.practice_plans (id) on delete cascade,
  position    smallint not null check (position between 1 and 60),
  drill_id    uuid references public.practice_drills (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  tags        public.drill_tag[] not null default '{}',
  minutes     smallint check (minutes between 1 and 240),  -- required to finalize (checked by the app)
  coaches     text[] not null default '{}',
  equipment   text check (char_length(equipment) <= 500),
  unique (plan_id, position)
);

-- Who is at each position for the practice; several players can share one.
create table public.practice_plan_positions (
  plan_id   uuid not null references public.practice_plans (id) on delete cascade,
  position  public.field_position not null check (position not in ('DP', 'FLEX', 'EH')),
  player_id uuid not null references public.players (id) on delete cascade,
  sort      smallint not null default 0,
  primary key (plan_id, position, player_id)
);
create index practice_plan_positions_player_idx on public.practice_plan_positions (player_id);

select private.apply_staff_rls('public.practice_plans');
select private.apply_staff_rls('public.practice_plan_drills');
select private.apply_staff_rls('public.practice_plan_positions');

-- Saves a draft plan: setup, drills (replaced, in order) and positions
-- (replaced). Returns the plan's new updated_at. Finalized plans must be
-- reopened first (P0004).
-- p_plan: {"practice_date", "start_time", "setting", "total_minutes", "location", "focus",
--          "drills": [{"drill_id", "name", "description", "tags", "minutes", "coaches", "equipment"}],
--          "positions": [{"position", "player_id"}]}
create function public.save_practice_plan(p_plan_id uuid, p_plan jsonb) returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare
  v_status  public.practice_plan_status;
  v_item    jsonb;
  v_pos     smallint := 0;
  v_updated timestamptz;
begin
  if not (select private.can_edit()) then
    raise exception 'only coaches and admins can change practice plans' using errcode = '42501';
  end if;

  select status into v_status from public.practice_plans where id = p_plan_id for update;
  if not found then
    raise exception 'practice plan not found' using errcode = 'P0002';
  end if;
  if v_status = 'final' then
    raise exception 'this plan is final; reopen it to edit' using errcode = 'P0004';
  end if;

  update public.practice_plans
     set practice_date = (p_plan ->> 'practice_date')::date,
         start_time    = nullif(p_plan ->> 'start_time', '')::time,
         setting       = (p_plan ->> 'setting')::public.practice_setting,
         total_minutes = (p_plan ->> 'total_minutes')::smallint,
         location      = nullif(trim(p_plan ->> 'location'), ''),
         focus         = nullif(trim(p_plan ->> 'focus'), '')
   where id = p_plan_id
  returning updated_at into v_updated;

  delete from public.practice_plan_drills where plan_id = p_plan_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_plan -> 'drills', '[]'::jsonb)) loop
    continue when coalesce(trim(v_item ->> 'name'), '') = '';
    v_pos := v_pos + 1;
    insert into public.practice_plan_drills
      (plan_id, position, drill_id, name, description, tags, minutes, coaches, equipment)
    values (
      p_plan_id,
      v_pos,
      -- a drill deleted from the library meanwhile: keep the copy, drop the link
      (select d.id from public.practice_drills d where d.id = nullif(v_item ->> 'drill_id', '')::uuid),
      trim(v_item ->> 'name'),
      nullif(trim(v_item ->> 'description'), ''),
      coalesce((select array_agg(t::public.drill_tag)
                  from jsonb_array_elements_text(coalesce(v_item -> 'tags', '[]'::jsonb)) t), '{}'),
      nullif(v_item ->> 'minutes', '')::smallint,
      coalesce((select array_agg(trim(c))
                  from jsonb_array_elements_text(coalesce(v_item -> 'coaches', '[]'::jsonb)) c
                 where trim(c) <> ''), '{}'),
      nullif(trim(v_item ->> 'equipment'), '')
    );
  end loop;

  delete from public.practice_plan_positions where plan_id = p_plan_id;
  insert into public.practice_plan_positions (plan_id, position, player_id, sort)
  select p_plan_id, (x ->> 'position')::public.field_position, (x ->> 'player_id')::uuid, i::smallint
    from jsonb_array_elements(coalesce(p_plan -> 'positions', '[]'::jsonb)) with ordinality as t(x, i)
   where exists (select 1 from public.players p where p.id = (x ->> 'player_id')::uuid)
  on conflict do nothing;

  return v_updated;
end;
$$;
revoke all on function public.save_practice_plan(uuid, jsonb) from public, anon;
grant execute on function public.save_practice_plan(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Coaching staff with their sign-in emails, for sharing practice plans.
-- Emails live in auth.users, which the API can't read; coaches and admins only.
-- -----------------------------------------------------------------------------
create function private.coaching_staff()
returns table (user_id uuid, display_name text, email text)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.display_name, u.email::text
    from public.staff s
    join auth.users u on u.id = s.user_id
   where s.role in ('coach', 'admin')
     and (select private.can_edit())
   order by s.display_name
$$;
revoke all on function private.coaching_staff() from public;
grant execute on function private.coaching_staff() to authenticated;

create function public.coaching_staff()
returns table (user_id uuid, display_name text, email text)
language sql stable security invoker set search_path = '' as $$
  select * from private.coaching_staff()
$$;
revoke all on function public.coaching_staff() from public, anon;
grant execute on function public.coaching_staff() to authenticated;
