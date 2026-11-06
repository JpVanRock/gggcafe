-- Checks the stat views against hand-computed values from supabase/seed.sql.
create function pg_temp.expect(label text, actual anycompatible, expected anycompatible) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
end $$;

-- Batting: Avery Lopez, 7 AB, 3 H (2B, HR), 1 BB, 1 SO, 8 PA
select pg_temp.expect('row exists in public.batting_season', (select count(*) from public.batting_season where player_id = '00000000-0000-0000-0000-0000000000c1'), 1::bigint);
select pg_temp.expect('AB',  ab,  7),
       pg_temp.expect('H',   h,   3),
       pg_temp.expect('TB',  tb,  7),
       pg_temp.expect('AVG', avg, 0.429),
       pg_temp.expect('OBP', obp, 0.500),
       pg_temp.expect('SLG', slg, 1.000),
       pg_temp.expect('OPS', ops, 1.500),
       pg_temp.expect('ISO', iso, 0.571),
       -- BABIP = (3-1) / (7-1-1+0) = 0.400
       pg_temp.expect('BABIP', babip, 0.400),
       pg_temp.expect('K%',  k_pct, 12.5)
from public.batting_season where player_id = '00000000-0000-0000-0000-0000000000c1';

-- Pitching: Jordan Kim, 37 outs = 12.1 IP, 4 ER, 10 H, 3 BB, 14 K
select pg_temp.expect('row exists in public.fielding_season', (select count(*) from public.fielding_season where player_id = '00000000-0000-0000-0000-0000000000c3'), 1::bigint);
select pg_temp.expect('IP',      ip, '12.1'),
       pg_temp.expect('ERA',     era, 2.27),       -- 7 * 4 / 12.333
       pg_temp.expect('WHIP',    whip, 1.054),     -- 13 / 12.333
       pg_temp.expect('K/7',     k_per_7, 7.95),   -- 7 * 14 / 12.333
       pg_temp.expect('W-L',     wins || '-' || losses, '1-1'),
       pg_temp.expect('Strike%', strike_pct, 64.0) -- 119 / 186
from public.pitching_season where player_id = '00000000-0000-0000-0000-0000000000c2';

-- Fielding: Riley Chen (C), 14 PO, 3 A, 1 E; 1 CS of 4 attempts
select pg_temp.expect('FPCT', fpct, 0.944),
       pg_temp.expect('CS%',  cs_pct, 25.0)
from public.fielding_season where player_id = '00000000-0000-0000-0000-0000000000c3';

-- Pitch log: 7-pitch walk. Before pitch 7 the count is 3-2 even though there were 3 fouls.
select pg_temp.expect('row exists in public.pitch_log', (select count(*) from public.pitch_log where plate_appearance_id = '00000000-0000-0000-0000-0000000000f4' and pitch_number = 7), 1::bigint);
select pg_temp.expect('count before pitch 7', balls_before || '-' || strikes_before, '3-2')
from public.pitch_log
where plate_appearance_id = '00000000-0000-0000-0000-0000000000f4' and pitch_number = 7;
select pg_temp.expect('row exists in public.pitch_log', (select count(*) from public.pitch_log where plate_appearance_id = '00000000-0000-0000-0000-0000000000f4' and pitch_number = 1), 1::bigint);
select pg_temp.expect('count before pitch 1', balls_before || '-' || strikes_before, '0-0')
from public.pitch_log
where plate_appearance_id = '00000000-0000-0000-0000-0000000000f4' and pitch_number = 1;

-- Pitch mix: Brooks threw drop on 4 of her 5 two-strike pitches to Avery
select pg_temp.expect('row exists in public.pitcher_pitch_mix', (select count(*) from public.pitcher_pitch_mix where pitcher_id = '00000000-0000-0000-0000-0000000000d1'
  and count_situation = 'two_strikes' and pitch_type = 'drop'), 1::bigint);
select pg_temp.expect('Brooks 2-strike drops', pitches, 4),
       pg_temp.expect('Brooks 2-strike drop usage', usage_pct, 80.0)
from public.pitcher_pitch_mix
where pitcher_id = '00000000-0000-0000-0000-0000000000d1'
  and count_situation = 'two_strikes' and pitch_type = 'drop';

-- Splits from play-by-play: Avery 3 PA (2B, BB, K) all vs LHP
select pg_temp.expect('row exists in public.batter_splits', (select count(*) from public.batter_splits where batter_id = '00000000-0000-0000-0000-0000000000c1' and split = 'vs_lhp'), 1::bigint);
select pg_temp.expect('split AVG', avg, 0.500),
       pg_temp.expect('split OBP', obp, 0.667),
       pg_temp.expect('split SLG', slg, 1.000)
from public.batter_splits
where batter_id = '00000000-0000-0000-0000-0000000000c1' and split = 'vs_lhp';
select pg_temp.expect('row exists in public.batter_splits', (select count(*) from public.batter_splits where batter_id = '00000000-0000-0000-0000-0000000000c1' and split = 'two_outs'), 1::bigint);
select pg_temp.expect('two-out PA', pa, 1)
from public.batter_splits
where batter_id = '00000000-0000-0000-0000-0000000000c1' and split = 'two_outs';

-- Strategy: wheel play 1 success in 2 calls
select pg_temp.expect('row exists in public.play_effectiveness', (select count(*) from public.play_effectiveness where play_id = '00000000-0000-0000-0000-0000000000a2'), 1::bigint);
select pg_temp.expect('wheel play success%', success_pct, 50.0)
from public.play_effectiveness where play_id = '00000000-0000-0000-0000-0000000000a2';

-- Development: tee exit velo 58.5 -> 61.0 (best) -> 60.2 (latest)
select pg_temp.expect('row exists in public.player_metric_progress', (select count(*) from public.player_metric_progress where player_id = '00000000-0000-0000-0000-0000000000c1' and metric_key = 'exit_velo_tee'), 1::bigint);
select pg_temp.expect('EV best',   best_value, 61.000),
       pg_temp.expect('EV latest', latest_value, 60.200),
       pg_temp.expect('EV improvement', improvement, 1.700)
from public.player_metric_progress
where player_id = '00000000-0000-0000-0000-0000000000c1' and metric_key = 'exit_velo_tee';
-- Lower is better for home-to-first: 3.10 -> 2.95 is +0.15 improvement
select pg_temp.expect('row exists in public.player_metric_progress', (select count(*) from public.player_metric_progress where player_id = '00000000-0000-0000-0000-0000000000c4' and metric_key = 'home_to_first_slap'), 1::bigint);
select pg_temp.expect('H1B improvement', improvement, 0.150),
       pg_temp.expect('H1B best', best_value, 2.950)
from public.player_metric_progress
where player_id = '00000000-0000-0000-0000-0000000000c4' and metric_key = 'home_to_first_slap';

-- Constraints reject impossible box scores
do $$
begin
  insert into public.batting_lines (game_id, team_id, player_id, plate_appearances, at_bats, hits)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-0000000000c2', 3, 3, 4);
  raise exception 'FAIL: hits > at_bats was accepted';
exception when check_violation then null;
end $$;

-- Every view must evaluate RLS as the caller, not the owner
do $$
declare v text;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)
  loop
    raise exception 'FAIL: view public.% is not security_invoker', v;
  end loop;
end $$;

-- Every public table must have RLS enabled
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'FAIL: table public.% has RLS disabled', t;
  end loop;
end $$;

-- Every function in public/private must pin search_path (Supabase Security Advisor)
do $$
declare f text;
begin
  for f in
    select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
  loop
    raise exception 'FAIL: function % has no fixed search_path', f;
  end loop;
end $$;
