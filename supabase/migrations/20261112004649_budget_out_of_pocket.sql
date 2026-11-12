-- =============================================================================
-- GGG.Cafe — Team Budget: out-of-pocket expenses by a coach or a parent (user, 2026-11-12)
--
-- The out-of-pocket ledger (budget_coach_expenses) now says who paid: a coach or a parent
-- (paid_by_role; items saved before this were coaches'). Repaying from team money records an
-- "Out-of-pocket reimbursement" expense (was "Coach reimbursement"), with no names, since
-- parents see the budget's expenses. Any old "Coach reimbursement" lines get the new name.
-- Same function as 20261111234239 otherwise.
-- =============================================================================

alter table public.budget_coach_expenses
  add column paid_by_role text not null default 'coach' check (paid_by_role in ('coach', 'parent'));
comment on column public.budget_coach_expenses.paid_by_role is 'Who paid out of pocket: a coach or a parent.';

update public.budget_entries
   set category = 'Out-of-pocket reimbursement',
       description = regexp_replace(coalesce(description, ''), '^Coach reimbursement', 'Out-of-pocket reimbursement')
 where category = 'Coach reimbursement';

create or replace function public.reimburse_coach_expenses(p_ids uuid[], p_paid_on date, p_from_team_funds boolean) returns void
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
    values (v_team, v_season, 'expense', p_paid_on, v_total, 'Out-of-pocket reimbursement',
            'Out-of-pocket reimbursement (' || v_count || ' item' || case when v_count = 1 then '' else 's' end || ')')
    returning id into v_entry;
  end if;
  update public.budget_coach_expenses
     set reimbursed_on = p_paid_on, reimbursement_id = v_entry
   where id = any (p_ids);
end;
$$;
