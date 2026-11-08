-- Team Budget: head coaches and admins change it; assistant coaches and viewers read it
-- (user, 2026-11-08). Parents still see team totals only, through team_budget_summary().
select private.apply_head_coach_writes('public.budget_fees');
select private.apply_head_coach_writes('public.budget_adjustments');
select private.apply_head_coach_writes('public.budget_entries');

create or replace function public.save_budget_fees(p_team_id uuid, p_season_id uuid, p_fees jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_fee jsonb;
  v_pos smallint := 0;
begin
  if not (select private.is_head_coach()) then
    raise exception 'only head coaches and admins can change the budget' using errcode = '42501';
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
