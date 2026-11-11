-- Team Budget and parent accounts. Own users (coach, viewer, two parents, a
-- stranger), removed at the end. Seed: team b1 has 4 active players in season a1.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function pg_temp.expect(text, anycompatible, anycompatible) to anon, authenticated;
create function pg_temp.err(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return '';
exception when others then
  return sqlstate;
end $$;
grant execute on function pg_temp.err(text) to authenticated;

insert into auth.users (id, email) values
  ('44444444-0000-0000-0000-000000000001', 'budget-coach@example.test'),
  ('44444444-0000-0000-0000-000000000002', 'budget-viewer@example.test'),
  ('44444444-0000-0000-0000-000000000003', 'parent-one@example.test'),
  ('44444444-0000-0000-0000-000000000004', 'parent-two@example.test'),
  ('44444444-0000-0000-0000-000000000005', 'stranger@example.test');
insert into public.staff (user_id, display_name, role) values
  ('44444444-0000-0000-0000-000000000001', 'Budget Coach', 'coach'),
  ('44444444-0000-0000-0000-000000000002', 'Budget Viewer', 'viewer');

-- ---------------------------------------------------------------------------
-- Coach sets fees, records payments, income and expenses
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000001"}', false);
select public.save_budget_fees('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
  '[{"name": "Registration", "amount": 400}, {"name": " ", "amount": 5}, {"name": "Uniform", "amount": 125.50}]'::jsonb);
insert into public.budget_adjustments (team_id, season_id, player_id, amount, note) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', -100, 'Sibling discount');
insert into public.budget_entries (team_id, season_id, kind, entry_date, amount, player_id, method) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'payment', '2026-09-01', 525.50, '00000000-0000-0000-0000-0000000000c1', 'Venmo'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'payment', '2026-09-01', 200, '00000000-0000-0000-0000-0000000000c2', 'Cash'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'payment', '2026-09-03', 100, '00000000-0000-0000-0000-0000000000c3', 'Check');
insert into public.budget_entries (team_id, season_id, kind, entry_date, amount, category, description) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'income', '2026-09-05', 300, 'Sponsor', 'Pizza Place banner'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'expense', '2026-09-10', 650, 'Tournament fees', 'Fall Classic entry');
do $$ begin
  insert into public.budget_entries (team_id, season_id, kind, entry_date, amount, player_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'expense', '2026-09-11', 10, '00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: an expense was tied to a player';
exception when check_violation then null;
end $$;
select pg_temp.expect('fees saved in order, blank skipped',
  (select string_agg(position || ':' || name || ':' || amount, ',' order by position) from public.budget_fees),
  '1:Registration:400.00,2:Uniform:125.50');

-- Coach's totals: 4 players x 525.50 - 100 = 2002; collected 825.50
select pg_temp.expect('summary totals',
  (select (s ->> 'players') || ' ' || (s ->> 'fee_per_player') || ' ' || (s ->> 'expected') || ' ' || (s ->> 'collected')
          || ' ' || (s ->> 'other_income') || ' ' || (s ->> 'expenses')
     from (select public.team_budget_summary('00000000-0000-0000-0000-0000000000b1') as s) q),
  '4 525.50 2002.00 825.50 300.00 650.00');
-- Coach generates the parent code
update public.teams set team_code = 'ABC234' where id = '00000000-0000-0000-0000-0000000000b1';
reset role;

-- ---------------------------------------------------------------------------
-- Parents: sign up, ask to join with the code, wait for approval
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000003"}', false);
do $$ begin
  perform public.request_parent_link('ABC234', 'Avery Lopez');
  raise exception 'FAIL: a link was requested without a parent profile';
exception when sqlstate 'P0005' then null;
end $$;
insert into public.parent_accounts (display_name) values ('Pat Lopez');
do $$ begin
  perform public.request_parent_link('ZZZ999', 'Avery Lopez');
  raise exception 'FAIL: a wrong team code was accepted';
exception when sqlstate 'P0006' then null;
end $$;
select pg_temp.expect('code is forgiving about case and dashes',
  public.request_parent_link('abc-234', 'Avery Lopez'), 'Sample Squad 14U');
select pg_temp.expect('parent sees her pending request',
  (select team_name || ' ' || child_name || ' ' || status || ' ' || coalesce(player_name, '-') from public.parent_home()),
  'Sample Squad 14U Avery Lopez pending -');
select pg_temp.expect('parent reads no team data', (select count(*) from public.teams), 0::bigint),
       pg_temp.expect('parent reads no players', (select count(*) from public.players), 0::bigint),
       pg_temp.expect('parent reads no budget rows', (select count(*) from public.budget_entries), 0::bigint);
do $$ begin
  perform public.team_budget_summary('00000000-0000-0000-0000-0000000000b1');
  raise exception 'FAIL: a pending parent saw the budget';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.parent_links set status = 'approved', player_id = '00000000-0000-0000-0000-0000000000c1';
  if exists (select 1 from public.parent_links where status = 'approved') then
    raise exception 'FAIL: a parent approved herself';
  end if;
end $$;
do $$ begin
  insert into public.parent_links (parent_id, team_id, child_name, status, player_id)
  values ('44444444-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1', 'Sneaky', 'approved', '00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: a parent inserted an approved link';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Second parent asks too; stays pending
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000004"}', false);
insert into public.parent_accounts (display_name) values ('Sam Kim');
select public.request_parent_link('ABC234', 'Jordan Kim');
reset role;

-- Viewer can't approve; coach sees emails and approves parent one
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('viewer gets no parent emails',
  (select count(*) from public.team_parent_links('00000000-0000-0000-0000-0000000000b1')), 0::bigint);
update public.parent_links set status = 'approved', player_id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select pg_temp.expect('viewer approval had no effect',
  (select count(*) from public.parent_links where status = 'approved'), 0::bigint);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000001"}', false);
select pg_temp.expect('coach sees requests with emails',
  (select string_agg(parent_name || '<' || email || '>', ',' order by parent_name)
     from public.team_parent_links('00000000-0000-0000-0000-0000000000b1')),
  'Pat Lopez<parent-one@example.test>,Sam Kim<parent-two@example.test>');
do $$ begin
  update public.parent_links set status = 'approved' where child_name = 'Avery Lopez';
  raise exception 'FAIL: approved without matching a player';
exception when check_violation then null;
end $$;
update public.parent_links
   set status = 'approved', player_id = '00000000-0000-0000-0000-0000000000c1',
       decided_by = '44444444-0000-0000-0000-000000000001', decided_at = now()
 where child_name = 'Avery Lopez';
reset role;

-- Approved parent: team totals only
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000003"}', false);
select pg_temp.expect('approved parent sees her daughter by name',
  (select player_name || ' ' || status from public.parent_home()), 'Avery Lopez approved');
select pg_temp.expect('parent budget: totals',
  (select (s ->> 'expected') || ' ' || (s ->> 'collected') || ' ' || (s ->> 'expenses') || ' ' || jsonb_array_length(s -> 'entries')
     from (select public.team_budget_summary('00000000-0000-0000-0000-0000000000b1') as s) q),
  '2002.00 825.50 650.00 4');
select pg_temp.expect('parent budget: payments grouped by day, no names',
  (select string_agg(e ->> 'date' || ' ' || (e ->> 'description') || ' ' || (e ->> 'amount'), ' | ')
     from jsonb_array_elements(public.team_budget_summary('00000000-0000-0000-0000-0000000000b1') -> 'entries') e
    where e ->> 'kind' = 'payment'),
  '2026-09-01 2 player payments 725.50 | 2026-09-03 1 player payment 100.00');
select pg_temp.expect('parent summary carries no player ids',
  (select public.team_budget_summary('00000000-0000-0000-0000-0000000000b1')::text like '%0000000000c%'), false);
select pg_temp.expect('parent still reads no budget rows', (select count(*) from public.budget_entries), 0::bigint);
do $$ begin
  insert into public.budget_entries (team_id, season_id, kind, entry_date, amount)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'income', '2026-09-20', 1);
  raise exception 'FAIL: a parent wrote to the budget';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Pending parent and a stranger still see nothing
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000004"}', false);
do $$ begin
  perform public.team_budget_summary('00000000-0000-0000-0000-0000000000b1');
  raise exception 'FAIL: a pending parent saw the budget';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect('parent sees only her own requests', (select count(*) from public.parent_links), 1::bigint);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000005"}', false);
do $$ begin
  perform public.team_budget_summary('00000000-0000-0000-0000-0000000000b1');
  raise exception 'FAIL: a stranger saw the budget';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect('stranger sees no parent profiles', (select count(*) from public.parent_accounts), 0::bigint);
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.team_budget_summary(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.request_parent_link(text, text)', 'execute') then
    raise exception 'FAIL: signed-out visitors can call budget/parent functions';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Coaches' out-of-pocket ledger and repayments (user, 2026-11-11)
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000001"}', false);
insert into public.budget_coach_expenses (team_id, season_id, entry_date, paid_by, category, description, amount) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '2026-09-02', 'Budget Coach', 'Equipment', 'Practice balls', 89.99),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '2026-09-04', 'Budget Coach', 'Team events', 'Pizza', 60),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '2026-09-06', 'Volunteer Parent', 'Other', 'Ice', 15);
select public.reimburse_coach_expenses(
  array(select id from public.budget_coach_expenses where description in ('Practice balls', 'Pizza')), '2026-09-20', true);
select pg_temp.expect('repaid items are marked and linked',
  (select count(*) from public.budget_coach_expenses where reimbursed_on = '2026-09-20' and reimbursement_id is not null), 2::bigint);
select pg_temp.expect('one team expense for their total',
  (select amount::text || '/' || kind::text || '/' || description from public.budget_entries where category = 'Coach reimbursement'),
  '149.99/expense/Coach reimbursement (2 items)');
select pg_temp.expect('can''t repay an item twice',
  pg_temp.err($$select public.reimburse_coach_expenses(array(select id from public.budget_coach_expenses where description = 'Pizza'), '2026-09-21', true)$$), '22023');
select pg_temp.expect('a repaid date is needed',
  pg_temp.err($$select public.reimburse_coach_expenses(array(select id from public.budget_coach_expenses where description = 'Ice'), null, true)$$), '22023');
select public.reimburse_coach_expenses(array(select id from public.budget_coach_expenses where description = 'Ice'), '2026-09-21', false);
select pg_temp.expect('repaid outside team money: no ledger expense',
  (select reimbursed_on::text || '/' || coalesce(reimbursement_id::text, 'none') from public.budget_coach_expenses where description = 'Ice'), '2026-09-21/none');
select pg_temp.expect('still one Coach reimbursement expense', (select count(*) from public.budget_entries where category = 'Coach reimbursement'), 1::bigint);
delete from public.budget_entries where category = 'Coach reimbursement';
select pg_temp.expect('removing the repayment makes its items owed again',
  (select count(*) from public.budget_coach_expenses where reimbursed_on is null and reimbursement_id is null), 2::bigint);
-- Tournament credits are ordinary ledger lines: won is income, used is an expense
insert into public.budget_entries (team_id, season_id, kind, entry_date, amount, category, description) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'income', '2026-09-28', 250, 'Tournament credit', 'Fall Classic champions'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'expense', '2026-10-05', 200, 'Tournament credit used', 'Spring Opener entry');
reset role;

-- Assistants and viewers read the coaches' ledger but can't add to it or repay it
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000002"}', false);
select pg_temp.expect('viewer reads the coaches'' ledger', (select count(*) from public.budget_coach_expenses), 3::bigint);
select pg_temp.expect('viewer can''t add to it',
  pg_temp.err($$insert into public.budget_coach_expenses (team_id, season_id, entry_date, paid_by, amount)
                values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '2026-09-30', 'Viewer', 5)$$), '42501');
select pg_temp.expect('viewer can''t repay',
  pg_temp.err($$select public.reimburse_coach_expenses(array(select id from public.budget_coach_expenses where description = 'Pizza'), '2026-09-30', true)$$), '42501');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000005"}', false);
select pg_temp.expect('a stranger reads none of it', (select count(*) from public.budget_coach_expenses), 0::bigint);
reset role;

-- Clean up
delete from public.budget_coach_expenses;
delete from public.budget_entries; delete from public.budget_adjustments; delete from public.budget_fees;
update public.teams set team_code = null;
delete from public.parent_accounts where user_id::text like '44444444-%';
delete from public.staff where user_id::text like '44444444-%';
delete from auth.users where id::text like '44444444-%';
