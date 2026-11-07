-- =============================================================================
-- GGG.Cafe — Movement Preferences, Preferred Hitting Style, GameDay Prep
--
-- Movement Preferences (Pop Report): how a player naturally moves, set by
--   coaches after testing (the tests themselves stay off the site). Every save
--   is a new row, so the latest row is current and older rows are history.
--   Players read their own.
-- Preferred Hitting Style (Pop Report): her natural hitting setup. The player
--   herself or a coach can change it; every change is a new row (history).
-- GameDay Prep (Coaches Dugout): per team + season player cards (hitting type,
--   base running, optional AVG/OBP/K% when there are no box scores), and game
--   lineups (batting order, defensive rotations, pitching plan) that print to
--   PDF and are shared with the coaching staff. Staff only.
-- Values are stored as short codes; labels live in src/lib/movement.ts and
-- src/lib/gameday.ts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Movement Preferences
-- -----------------------------------------------------------------------------
create table public.movement_preferences (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players (id) on delete cascade,
  move_style     text check (move_style in ('aerial', 'terrestrial')),
  power_side     text check (power_side in ('right', 'left')),                 -- extension side
  dial_one       text check (dial_one in ('left_front', 'right_front', 'left_heel', 'right_heel')),
  breathing      text check (breathing in ('in', 'out')),
  twist          text check (twist in ('associated', 'disassociated')),
  flex           text check (flex in ('double_flexion', 'flexion', 'extension', 'double_extension')),
  space          text check (space in ('axial', 'large')),
  focus_line     text check (focus_line in ('vertical', 'horizontal')),
  motor_shoulder text check (motor_shoulder in ('left', 'right')),
  motor_eye      text check (motor_eye in ('left', 'right')),
  recorded_by    uuid default auth.uid() references auth.users (id) on delete set null,
  recorded_at    timestamptz not null default now()
);
create index movement_preferences_player_idx on public.movement_preferences (player_id, recorded_at desc);
select private.apply_staff_rls('public.movement_preferences');
create policy "player reads her movement preferences" on public.movement_preferences for select to authenticated
  using (player_id in (select private.my_player_ids()));

-- -----------------------------------------------------------------------------
-- Preferred Hitting Style (natural mechanics, no coaching direction)
-- -----------------------------------------------------------------------------
create table public.hitting_styles (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players (id) on delete cascade,
  hands_height text check (hands_height in ('high', 'low')),
  hands_depth  text check (hands_depth in ('forward', 'back')),
  hands_reach  text check (hands_reach in ('proximal', 'distal')),
  feet_width   text check (feet_width in ('wide', 'narrow')),
  feet_angle   text check (feet_angle in ('open', 'closed', 'neutral')),
  weight       text check (weight in ('forward', 'centered', 'back')),
  load_stride  text check (load_stride in ('leg_lift', 'toe_tap', 'no_stride', 'open_to_close')),
  weight_shift text check (weight_shift in ('shift', 'no_shift')),
  foot_down    text check (foot_down in ('toe_to_heel', 'heel_to_toe', 'simultaneous')),
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  recorded_at  timestamptz not null default now()
);
create index hitting_styles_player_idx on public.hitting_styles (player_id, recorded_at desc);
select private.apply_staff_rls('public.hitting_styles');
-- The player adds new versions; history rows are never changed or removed by her.
create policy "player reads her hitting style" on public.hitting_styles for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player updates her hitting style" on public.hitting_styles for insert to authenticated
  with check (player_id in (select private.my_player_ids()) and recorded_by = (select auth.uid()));

-- Who made each change, for the history lists (staff names, or "Player").
create function private.change_authors(p_user_ids uuid[]) returns table (user_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(s.display_name, 'Player')
    from unnest(p_user_ids) as u(id)
    left join public.staff s on s.user_id = u.id
   where (select private.is_staff()) or (select private.has_player_access())
$$;
revoke all on function private.change_authors(uuid[]) from public;
grant execute on function private.change_authors(uuid[]) to authenticated;
create function public.change_authors(p_user_ids uuid[]) returns table (user_id uuid, name text)
language sql stable security invoker set search_path = '' as $$ select * from private.change_authors(p_user_ids) $$;
revoke all on function public.change_authors(uuid[]) from public, anon;
grant execute on function public.change_authors(uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- GameDay Prep
-- -----------------------------------------------------------------------------
create table public.gameday_profiles (
  team_id      uuid not null references public.teams (id) on delete cascade,
  season_id    uuid not null references public.seasons (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  hitting_type text check (hitting_type in ('power', 'contact', 'gap')),
  base_running text check (base_running in ('pure', 'intelligent', 'average')),
  -- typed in when there are no box scores yet; box-score stats win when they exist
  avg          numeric(4, 3) check (avg between 0 and 1),
  obp          numeric(4, 3) check (obp between 0 and 1),
  k_pct        numeric(4, 1) check (k_pct between 0 and 100),
  updated_by   uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (team_id, season_id, player_id)
);
create trigger set_updated_at before update on public.gameday_profiles
  for each row execute function private.set_updated_at();
select private.apply_staff_rls('public.gameday_profiles');

create type public.gameday_status as enum ('draft', 'final');

create table public.gameday_lineups (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  season_id     uuid references public.seasons (id) on delete set null,
  game_id       uuid references public.games (id) on delete set null,
  game_date     date not null,
  opponent      text check (char_length(opponent) <= 120),
  title         text check (char_length(title) <= 120),
  rotations     smallint not null default 5 check (rotations between 1 and 7),
  batting_order uuid[] not null default '{}',                                   -- player ids, leadoff first
  -- {"1": {"<player_id>": "SS", ...}, "2": {...}}: position (C..RF, P or Sub) per rotation
  defense       jsonb not null default '{}'::jsonb check (jsonb_typeof(defense) = 'object'),
  -- {"1": {"primary": "Fastball", "secondary": "Changeup", "chase": ["Rise Ball"]}, ...}
  pitching      jsonb not null default '{}'::jsonb check (jsonb_typeof(pitching) = 'object'),
  notes         text check (char_length(notes) <= 1000),
  status        public.gameday_status not null default 'draft',
  finalized_at  timestamptz,
  shared_at     timestamptz,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((status = 'final') = (finalized_at is not null))
);
create index gameday_lineups_team_date_idx on public.gameday_lineups (team_id, game_date desc);
create trigger set_updated_at before update on public.gameday_lineups
  for each row execute function private.set_updated_at();
select private.apply_staff_rls('public.gameday_lineups');
