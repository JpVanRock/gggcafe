-- =============================================================================
-- GGG.Cafe — Team Budget: player payments have a category (user, 2026-11-12)
--
-- Not every player payment is for registration: Registration, Equipment or Other
-- (budget_entries.category on kind = 'payment'; payments saved before this have no
-- category and count as Registration). Only registration payments go toward what a
-- player owes in registration fees, so the summary's "collected" counts only those, and
-- equipment and other player payments count as other income. The overall balance
-- (collected + other income - expenses) doesn't change.
--
-- Same function as 20261107192241_team_budget_and_parents, with collected and
-- other_income split by category.
-- =============================================================================

alter table public.budget_entries
  add constraint budget_entries_payment_category_check
  check (kind <> 'payment' or category is null or category in ('Registration', 'Equipment', 'Other'));

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
