-- =============================================================================
-- GGG.Cafe — Tournament credits kept totally apart from the team budget, and shown to
-- parents on their own (user, 2026-11-12)
--
-- 1. Credit lines saved in the team ledger by the old form in the minutes between the
--    last migration (20261112001755) and the new code going live move to budget_credits.
--    One of them re-entered a credit that had already moved (same team, kind, date,
--    amount and tournament): that duplicate is dropped, not moved.
-- 2. The team ledger refuses tournament-credit lines from now on, so a credit can never
--    count as income or an expense of the team.
-- 3. team_budget_summary() also returns the team's tournament credits (all seasons) as
--    "credits", which parents see as their own running balance, apart from the budget.
-- =============================================================================

insert into public.budget_credits (id, team_id, season_id, entry_date, kind, amount, description, created_by, created_at)
select e.id, e.team_id, e.season_id, e.entry_date,
       case when e.kind = 'income' then 'won' else 'used' end, e.amount,
       coalesce(nullif(trim(e.description), ''), 'Tournament credit'), e.created_by, e.created_at
  from public.budget_entries e
 where ((e.kind = 'income' and e.category = 'Tournament credit') or (e.kind = 'expense' and e.category = 'Tournament credit used'))
   and not exists (
     select 1 from public.budget_credits c
      where c.team_id = e.team_id and c.entry_date = e.entry_date and c.amount = e.amount
        and c.kind = case when e.kind = 'income' then 'won' else 'used' end
        and c.description = coalesce(nullif(trim(e.description), ''), 'Tournament credit'));
delete from public.budget_entries
 where (kind = 'income' and category = 'Tournament credit') or (kind = 'expense' and category = 'Tournament credit used');

alter table public.budget_entries
  add constraint budget_entries_no_tournament_credit_check
  check (category is null or category not in ('Tournament credit', 'Tournament credit used'));

-- The summary (as in 20261112001755_budget_last_updated) plus the team's credits
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
    -- tournament credits, all seasons: shown apart from the budget, never in its totals
    'credits', coalesce((select jsonb_agg(jsonb_build_object('date', c.entry_date, 'kind', c.kind, 'amount', c.amount,
                                                              'description', c.description) order by c.entry_date, c.created_at)
                           from public.budget_credits c where c.team_id = p_team_id), '[]'::jsonb),
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
