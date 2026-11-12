-- =============================================================================
-- GGG.Cafe — Team Budget: when it last changed, and tournament credits apart from
-- the team balance (user, 2026-11-12)
--
-- 1. budget_changes: one row per team and season with the time anything in its budget
--    last changed (a registration cost, a discount, a payment, income or an expense was
--    added, changed or removed), kept by a trigger on those tables. Removals count too,
--    which row timestamps can't show. team_budget_summary() returns it as updated_at, and
--    the parents' budget view shows it at the top. Existing budgets start from their
--    latest ledger entry.
-- 2. Tournament credits move out of the team ledger into budget_credits (won / used, with
--    their own running balance across seasons in the app), so they no longer change the
--    team's balance, income or expenses. Credit lines already in the ledger move over.
--    The coaches' out-of-pocket ledger was already apart; only a repayment made from team
--    money is a team expense, because that money leaves the team.
-- Same access as the rest of the budget: staff read, head coaches and admins write.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Last updated
-- -----------------------------------------------------------------------------
create table public.budget_changes (
  team_id    uuid not null references public.teams (id) on delete cascade,
  season_id  uuid not null references public.seasons (id) on delete cascade,
  changed_at timestamptz not null default now(),
  primary key (team_id, season_id)
);
create index budget_changes_season_idx on public.budget_changes (season_id);
comment on table public.budget_changes is
  'When each team''s budget for a season last changed (fees, adjustments, ledger). Written by a trigger.';
-- RLS exception (not apply_staff_rls): only the trigger below writes it, so staff can read it
-- and nobody can set a date by hand; parents get it through team_budget_summary().
alter table public.budget_changes enable row level security;
create policy "staff read budget changes" on public.budget_changes for select to authenticated
  using ((select private.is_staff()));

create function private.note_budget_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_team   uuid;
  v_season uuid;
begin
  if tg_op = 'DELETE' then
    v_team := old.team_id; v_season := old.season_id;
  else
    v_team := new.team_id; v_season := new.season_id;
  end if;
  -- skip rows going away with their team or season (a cascade): nothing is left to date
  if exists (select 1 from public.teams where id = v_team) and exists (select 1 from public.seasons where id = v_season) then
    insert into public.budget_changes (team_id, season_id, changed_at) values (v_team, v_season, now())
    on conflict (team_id, season_id) do update set changed_at = excluded.changed_at;
  end if;
  return null;
end $$;
revoke all on function private.note_budget_change() from public;
create trigger note_budget_change after insert or update or delete on public.budget_fees
  for each row execute function private.note_budget_change();
create trigger note_budget_change after insert or update or delete on public.budget_adjustments
  for each row execute function private.note_budget_change();
create trigger note_budget_change after insert or update or delete on public.budget_entries
  for each row execute function private.note_budget_change();

insert into public.budget_changes (team_id, season_id, changed_at)
select team_id, season_id, max(greatest(created_at, updated_at))
  from public.budget_entries
 group by team_id, season_id
on conflict (team_id, season_id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Tournament credits, apart from the team ledger
-- -----------------------------------------------------------------------------
create table public.budget_credits (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  -- the season it was recorded in (the balance runs across seasons)
  season_id   uuid not null references public.seasons (id) on delete cascade,
  entry_date  date not null,
  kind        text not null check (kind in ('won', 'used')),
  amount      numeric(10, 2) not null check (amount > 0 and amount <= 1000000),
  -- the tournament it was won at, or the entry fee it paid
  description text not null check (char_length(description) between 1 and 300),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index budget_credits_team_idx on public.budget_credits (team_id, entry_date);
create index budget_credits_season_idx on public.budget_credits (season_id);
create index budget_credits_created_by_idx on public.budget_credits (created_by);
comment on table public.budget_credits is
  'Tournament credit a team won toward future entry fees, and credit it used. Kept apart from the team ledger and balance.';
select private.apply_staff_rls('public.budget_credits');
select private.apply_head_coach_writes('public.budget_credits');

insert into public.budget_credits (id, team_id, season_id, entry_date, kind, amount, description, created_by, created_at)
select id, team_id, season_id, entry_date, case when kind = 'income' then 'won' else 'used' end, amount,
       coalesce(nullif(trim(description), ''), 'Tournament credit'), created_by, created_at
  from public.budget_entries
 where (kind = 'income' and category = 'Tournament credit') or (kind = 'expense' and category = 'Tournament credit used');
delete from public.budget_entries
 where (kind = 'income' and category = 'Tournament credit') or (kind = 'expense' and category = 'Tournament credit used');

-- -----------------------------------------------------------------------------
-- The summary (as in 20261112001052_budget_payment_categories) plus updated_at
-- -----------------------------------------------------------------------------
create or replace function private.team_budget_summary(p_team_id uuid, p_season_id uuid default null) returns jsonb
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
    'updated_at', (select changed_at from public.budget_changes where team_id = p_team_id and season_id = v_season),
    'players', v_players,
    'fees', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'amount', amount) order by position)
                        from public.budget_fees where team_id = p_team_id and season_id = v_season), '[]'::jsonb),
    'fee_per_player', v_fee,
    'expected', v_players * v_fee + v_adjust,
    -- registration payments only: what goes toward the fees players owe
    'collected', (select coalesce(sum(amount), 0) from public.budget_entries
                   where team_id = p_team_id and season_id = v_season and kind = 'payment'
                     and coalesce(category, 'Registration') = 'Registration'),
    -- other income, plus player payments for equipment and other things
    'other_income', (select coalesce(sum(amount), 0) from public.budget_entries
                      where team_id = p_team_id and season_id = v_season
                        and (kind = 'income' or (kind = 'payment' and coalesce(category, 'Registration') <> 'Registration'))),
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
