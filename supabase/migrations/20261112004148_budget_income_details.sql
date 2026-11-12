-- =============================================================================
-- GGG.Cafe — Team Budget: the "Fundraisers or other income" details add up (user, 2026-11-12)
--
-- That total includes player payments for equipment and other things, but the summary
-- listed every player payment as one daily total, so the Details pop-up couldn't show
-- them (and showed nothing at all for a team with only equipment payments). Player
-- payments are now daily totals per kind (registration; equipment; other), still with no
-- names: equipment and other carry their category and show in the income details.
-- Same function as 20261112003427_budget_credits_apart otherwise.
-- =============================================================================

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
          -- player payments: daily totals with no names, registration apart from equipment and other
          select jsonb_build_object('date', entry_date, 'kind', 'payment',
                                    'category', case when bucket = 'Registration' then null else bucket end,
                                    'description', count(*) || case bucket when 'Equipment' then ' equipment payment'
                                                                           when 'Other' then ' other player payment'
                                                                           else ' player payment' end
                                                   || case when count(*) = 1 then '' else 's' end,
                                    'amount', sum(amount))
            from (select entry_date, amount, coalesce(category, 'Registration') as bucket
                    from public.budget_entries
                   where team_id = p_team_id and season_id = v_season and kind = 'payment') p
           group by entry_date, bucket
        ) x), '[]'::jsonb)
  );
end;
$$;
