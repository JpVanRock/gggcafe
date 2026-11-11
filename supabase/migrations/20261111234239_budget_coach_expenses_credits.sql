-- =============================================================================
-- GGG.Cafe — Team Budget: coaches' out-of-pocket ledger and tournament credits
-- (user, 2026-11-11)
--
-- Coaches' out-of-pocket ledger (budget_coach_expenses): what a coach paid with her own
-- money for the team, kept apart from team money. The team owes it back until it's
-- repaid. Repaying marks it repaid and can record the repayment in the team ledger as a
-- "Coach reimbursement" expense (reimburse_coach_expenses, one transaction). Removing
-- that ledger expense later makes the item owed again.
--
-- Tournament credits need no new table: credit won is income in the team ledger
-- (category "Tournament credit") and credit used is an expense ("Tournament credit
-- used"). The app keeps their running balance across seasons (src/lib/budget.ts).
--
-- Same access as the rest of the budget: staff read, head coaches and admins write
-- (apply_staff_rls + apply_head_coach_writes, as in 20261109100000_budget_head_coach).
-- =============================================================================

create table public.budget_coach_expenses (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams (id) on delete cascade,
  season_id        uuid not null references public.seasons (id) on delete cascade,
  entry_date       date not null,
  -- who paid: a coach's name as typed (a volunteer parent works too)
  paid_by          text not null check (char_length(paid_by) between 1 and 80),
  category         text check (char_length(category) <= 60),
  description      text check (char_length(description) <= 300),
  amount           numeric(10, 2) not null check (amount > 0 and amount <= 1000000),
  reimbursed_on    date,
  -- the team-ledger expense that paid it back, when it was recorded there
  reimbursement_id uuid references public.budget_entries (id) on delete set null,
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (reimbursement_id is null or reimbursed_on is not null)
);
create index budget_coach_expenses_team_idx on public.budget_coach_expenses (team_id, entry_date);
create index budget_coach_expenses_season_idx on public.budget_coach_expenses (season_id);
create index budget_coach_expenses_reimbursement_idx on public.budget_coach_expenses (reimbursement_id);
create index budget_coach_expenses_created_by_idx on public.budget_coach_expenses (created_by);
create trigger set_updated_at before update on public.budget_coach_expenses
  for each row execute function private.set_updated_at();
comment on table public.budget_coach_expenses is
  'Coaches'' out-of-pocket spending for a team, owed back until repaid (reimbursed_on; reimbursement_id = the team-ledger expense).';
select private.apply_staff_rls('public.budget_coach_expenses');
select private.apply_head_coach_writes('public.budget_coach_expenses');

-- Removing the team-ledger repayment makes the coach's item owed again.
create function private.unmark_coach_reimbursement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.budget_coach_expenses
     set reimbursed_on = null, reimbursement_id = null
   where reimbursement_id = old.id;
  return old;
end $$;
revoke all on function private.unmark_coach_reimbursement() from public;
create trigger unmark_coach_reimbursement before delete on public.budget_entries
  for each row execute function private.unmark_coach_reimbursement();

-- Repays coach items: marks them repaid on p_paid_on and, when p_from_team_funds, records
-- one "Coach reimbursement" expense for their total in the team ledger (in the season of
-- the first item). Security invoker: the budget's own row security applies.
create function public.reimburse_coach_expenses(p_ids uuid[], p_paid_on date, p_from_team_funds boolean) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_team   uuid;
  v_season uuid;
  v_count  int;
  v_total  numeric;
  v_entry  uuid;
begin
  if not (select private.is_head_coach()) then
    raise exception 'only head coaches and admins can change the budget' using errcode = '42501';
  end if;
  if p_paid_on is null then
    raise exception 'pick the date it was repaid' using errcode = '22023';
  end if;
  select count(*), sum(amount), min(team_id::text)::uuid
    into v_count, v_total, v_team
    from public.budget_coach_expenses
   where id = any (coalesce(p_ids, '{}')) and reimbursed_on is null;
  if v_count = 0 or v_count <> coalesce(array_length(p_ids, 1), 0) then
    raise exception 'choose items that are still owed' using errcode = '22023';
  end if;
  if (select count(distinct team_id) from public.budget_coach_expenses where id = any (p_ids)) > 1 then
    raise exception 'repay one team''s items at a time' using errcode = '22023';
  end if;
  select season_id into v_season from public.budget_coach_expenses
   where id = any (p_ids) order by entry_date, created_at limit 1;
  if p_from_team_funds then
    insert into public.budget_entries (team_id, season_id, kind, entry_date, amount, category, description)
    values (v_team, v_season, 'expense', p_paid_on, v_total, 'Coach reimbursement',
            'Coach reimbursement (' || v_count || ' item' || case when v_count = 1 then '' else 's' end || ')')
    returning id into v_entry;
  end if;
  update public.budget_coach_expenses
     set reimbursed_on = p_paid_on, reimbursement_id = v_entry
   where id = any (p_ids);
end;
$$;
revoke all on function public.reimburse_coach_expenses(uuid[], date, boolean) from public, anon;
grant execute on function public.reimburse_coach_expenses(uuid[], date, boolean) to authenticated;
