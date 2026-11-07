-- =============================================================================
-- GGG.Cafe — Team Budget and parent accounts
--
-- Team Budget (Coaches Dugout), per team and season:
--   budget_fees         registration costs every player owes (e.g. Registration, Uniform)
--   budget_adjustments  a player's discount (negative) or extra charge (positive)
--   budget_entries      the ledger: player payments, other income, expenses
-- Staff read; coaches/admins write (private.apply_staff_rls).
--
-- Parents sign up themselves, then ask to join a team with its parent code and
-- their daughter's name. A coach matches the request to a player and approves
-- it. Parents are not staff, so they can't read any app table directly; they
-- see only what the security-definer functions below return: their own links
-- and, once approved, their team's budget as TEAM TOTALS (no family names or
-- who has paid).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Team Budget
-- -----------------------------------------------------------------------------
create table public.budget_fees (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.teams (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  position  smallint not null check (position between 1 and 20),
  name      text not null check (char_length(name) between 1 and 80),
  amount    numeric(10, 2) not null check (amount >= 0 and amount <= 100000),
  unique (team_id, season_id, position)
);

create table public.budget_adjustments (
  team_id   uuid not null references public.teams (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  amount    numeric(10, 2) not null check (amount between -100000 and 100000 and amount <> 0),
  note      text check (char_length(note) <= 200),
  primary key (team_id, season_id, player_id)
);

create type public.budget_entry_kind as enum ('payment', 'income', 'expense');

create table public.budget_entries (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  season_id   uuid not null references public.seasons (id) on delete cascade,
  kind        public.budget_entry_kind not null,
  entry_date  date not null,
  amount      numeric(10, 2) not null check (amount > 0 and amount <= 1000000),
  -- payments name the player (kept if she's later deleted: the money was still received)
  player_id   uuid references public.players (id) on delete set null,
  category    text check (char_length(category) <= 60),   -- expense category / income source
  method      text check (char_length(method) <= 30),     -- cash, check, Venmo...
  description text check (char_length(description) <= 300),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (kind = 'payment' or player_id is null)
);
create index budget_entries_team_season_idx on public.budget_entries (team_id, season_id, entry_date);
create trigger set_updated_at before update on public.budget_entries
  for each row execute function private.set_updated_at();

select private.apply_staff_rls('public.budget_fees');
select private.apply_staff_rls('public.budget_adjustments');
select private.apply_staff_rls('public.budget_entries');

-- Replaces a season's registration costs in one transaction.
-- p_fees: [{"name", "amount"}] in display order; blank names are skipped.
create function public.save_budget_fees(p_team_id uuid, p_season_id uuid, p_fees jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_fee jsonb;
  v_pos smallint := 0;
begin
  if not (select private.can_edit()) then
    raise exception 'only coaches and admins can change the budget' using errcode = '42501';
  end if;
  delete from public.budget_fees where team_id = p_team_id and season_id = p_season_id;
  for v_fee in select * from jsonb_array_elements(coalesce(p_fees, '[]'::jsonb)) loop
    continue when coalesce(trim(v_fee ->> 'name'), '') = '';
    v_pos := v_pos + 1;
    insert into public.budget_fees (team_id, season_id, position, name, amount)
    values (p_team_id, p_season_id, v_pos, trim(v_fee ->> 'name'), (v_fee ->> 'amount')::numeric);
  end loop;
end;
$$;
revoke all on function public.save_budget_fees(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_budget_fees(uuid, uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Parent accounts
-- -----------------------------------------------------------------------------
-- Six letters/digits a coach hands out; null = parents can't join right now.
alter table public.teams
  add column parent_code text unique check (parent_code is null or parent_code ~ '^[A-Z0-9]{6}$');

create table public.parent_accounts (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at   timestamptz not null default now()
);
alter table public.parent_accounts enable row level security;
create policy "parents see themselves, staff see all" on public.parent_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "parents create their own profile" on public.parent_accounts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "parents edit their own profile" on public.parent_accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "coaches remove parent profiles" on public.parent_accounts for delete to authenticated
  using ((select private.can_edit()));

create type public.parent_link_status as enum ('pending', 'approved', 'declined');

create table public.parent_links (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references public.parent_accounts (user_id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete cascade,
  child_name   text not null check (char_length(child_name) between 1 and 80),  -- as the parent typed it
  player_id    uuid references public.players (id) on delete set null,          -- set by the coach
  status       public.parent_link_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by   uuid references auth.users (id) on delete set null,
  decided_at   timestamptz,
  check (status <> 'approved' or player_id is not null)
);
create unique index parent_links_once on public.parent_links (parent_id, team_id, lower(child_name));
alter table public.parent_links enable row level security;
-- Parents read their own requests; staff read all. Requests are made through
-- request_parent_link() (checks the team code); coaches approve or decline.
create policy "parents see their links, staff see all" on public.parent_links for select to authenticated
  using (parent_id = (select auth.uid()) or (select private.is_staff()));
create policy "coaches decide parent links" on public.parent_links for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "parents withdraw, coaches remove" on public.parent_links for delete to authenticated
  using (parent_id = (select auth.uid()) or (select private.can_edit()));

-- A parent asks to join a team with its code. Returns the team's name.
create function private.request_parent_link(p_code text, p_child_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_team_id   uuid;
  v_team_name text;
begin
  if not exists (select 1 from public.parent_accounts where user_id = (select auth.uid())) then
    raise exception 'create your parent profile first' using errcode = 'P0005';
  end if;
  if coalesce(trim(p_child_name), '') = '' or char_length(trim(p_child_name)) > 80 then
    raise exception 'enter your daughter''s name' using errcode = '22023';
  end if;
  select id, name into v_team_id, v_team_name
    from public.teams
   where parent_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and is_own_team;
  if v_team_id is null then
    raise exception 'that team code doesn''t match a team' using errcode = 'P0006';
  end if;
  insert into public.parent_links (parent_id, team_id, child_name)
  values ((select auth.uid()), v_team_id, trim(p_child_name))
  on conflict do nothing;
  return v_team_name;
end;
$$;
revoke all on function private.request_parent_link(text, text) from public;
grant execute on function private.request_parent_link(text, text) to authenticated;
create function public.request_parent_link(p_code text, p_child_name text) returns text
language sql security invoker set search_path = '' as $$ select private.request_parent_link(p_code, p_child_name) $$;
revoke all on function public.request_parent_link(text, text) from public, anon;
grant execute on function public.request_parent_link(text, text) to authenticated;

-- The signed-in parent's requests with team and player names (parents can't
-- read teams or players themselves).
create function private.parent_home()
returns table (link_id uuid, team_id uuid, team_name text, child_name text, player_name text, status public.parent_link_status)
language sql stable security definer set search_path = '' as $$
  select l.id, l.team_id, t.name, l.child_name,
         case when l.status = 'approved' then coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name end,
         l.status
    from public.parent_links l
    join public.teams t on t.id = l.team_id
    left join public.players p on p.id = l.player_id
   where l.parent_id = (select auth.uid())
   order by l.requested_at
$$;
revoke all on function private.parent_home() from public;
grant execute on function private.parent_home() to authenticated;
create function public.parent_home()
returns table (link_id uuid, team_id uuid, team_name text, child_name text, player_name text, status public.parent_link_status)
language sql stable security invoker set search_path = '' as $$ select * from private.parent_home() $$;
revoke all on function public.parent_home() from public, anon;
grant execute on function public.parent_home() to authenticated;

-- Parent requests for a team, with sign-in emails, for coaches to review.
create function private.team_parent_links(p_team_id uuid)
returns table (link_id uuid, parent_name text, email text, child_name text, player_id uuid, status public.parent_link_status, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, a.display_name, u.email::text, l.child_name, l.player_id, l.status, l.requested_at
    from public.parent_links l
    join public.parent_accounts a on a.user_id = l.parent_id
    join auth.users u on u.id = l.parent_id
   where l.team_id = p_team_id and (select private.can_edit())
   order by l.status, l.requested_at
$$;
revoke all on function private.team_parent_links(uuid) from public;
grant execute on function private.team_parent_links(uuid) to authenticated;
create function public.team_parent_links(p_team_id uuid)
returns table (link_id uuid, parent_name text, email text, child_name text, player_id uuid, status public.parent_link_status, requested_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.team_parent_links(p_team_id) $$;
revoke all on function public.team_parent_links(uuid) from public, anon;
grant execute on function public.team_parent_links(uuid) to authenticated;

-- The view-only Team Budget: team totals, expenses and other income, with
-- player payments only as daily totals (no names). For staff, or a parent
-- approved for this team. Season defaults to the latest one with a roster.
create function private.team_budget_summary(p_team_id uuid, p_season_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_season  uuid := p_season_id;
  v_players int;
  v_fee     numeric;
  v_adjust  numeric;
begin
  if not ((select private.is_staff()) or exists (
    select 1 from public.parent_links
     where parent_id = (select auth.uid()) and team_id = p_team_id and status = 'approved')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if v_season is null then
    select r.season_id into v_season
      from public.roster_entries r join public.seasons s on s.id = r.season_id
     where r.team_id = p_team_id
     order by s.start_date desc nulls last, s.created_at desc
     limit 1;
  end if;
  if v_season is null then
    return null;
  end if;

  select count(distinct player_id) into v_players
    from public.roster_entries where team_id = p_team_id and season_id = v_season and active;
  select coalesce(sum(amount), 0) into v_fee
    from public.budget_fees where team_id = p_team_id and season_id = v_season;
  select coalesce(sum(a.amount), 0) into v_adjust
    from public.budget_adjustments a
   where a.team_id = p_team_id and a.season_id = v_season
     and exists (select 1 from public.roster_entries r
                  where r.team_id = a.team_id and r.season_id = a.season_id and r.player_id = a.player_id and r.active);

  return jsonb_build_object(
    'team', (select name from public.teams where id = p_team_id),
    'season', (select name from public.seasons where id = v_season),
    'season_id', v_season,
    'players', v_players,
    'fees', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'amount', amount) order by position)
                        from public.budget_fees where team_id = p_team_id and season_id = v_season), '[]'::jsonb),
    'fee_per_player', v_fee,
    'expected', v_players * v_fee + v_adjust,
    'collected', (select coalesce(sum(amount), 0) from public.budget_entries
                   where team_id = p_team_id and season_id = v_season and kind = 'payment'),
    'other_income', (select coalesce(sum(amount), 0) from public.budget_entries
                      where team_id = p_team_id and season_id = v_season and kind = 'income'),
    'expenses', (select coalesce(sum(amount), 0) from public.budget_entries
                  where team_id = p_team_id and season_id = v_season and kind = 'expense'),
    'entries', coalesce((
      select jsonb_agg(e order by e ->> 'date', e ->> 'kind')
        from (
          select jsonb_build_object('date', entry_date, 'kind', kind::text, 'category', category,
                                    'description', description, 'amount', amount) as e
            from public.budget_entries
           where team_id = p_team_id and season_id = v_season and kind <> 'payment'
          union all
          select jsonb_build_object('date', entry_date, 'kind', 'payment', 'category', null,
                                    'description', count(*) || ' player payment' || case when count(*) = 1 then '' else 's' end,
                                    'amount', sum(amount))
            from public.budget_entries
           where team_id = p_team_id and season_id = v_season and kind = 'payment'
           group by entry_date
        ) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function private.team_budget_summary(uuid, uuid) from public;
grant execute on function private.team_budget_summary(uuid, uuid) to authenticated;
create function public.team_budget_summary(p_team_id uuid, p_season_id uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.team_budget_summary(p_team_id, p_season_id) $$;
revoke all on function public.team_budget_summary(uuid, uuid) from public, anon;
grant execute on function public.team_budget_summary(uuid, uuid) to authenticated;
