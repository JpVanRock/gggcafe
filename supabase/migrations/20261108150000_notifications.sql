-- =============================================================================
-- GGG.Cafe — Notifications for coaches (user, 2026-11-08)
--
-- First kind: a new Player of the Week. When public.team_leaderboard() decides a
-- finished week, every coach and admin gets a notification. Coaches see a bell
-- with the unread count in the top menu and the list at /notifications; opening
-- the menu also decides any finished weeks for every team in its offseason, so the
-- news arrives even if no player has opened the Leaderboard yet.
--
-- Exception to apply_staff_rls: each person sees and marks read only their own
-- notifications; only the database writes them.
-- =============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('player-of-the-week')),
  title      text not null check (char_length(title) <= 200),
  body       text check (body is null or char_length(body) <= 500),
  href       text check (href is null or href ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  team_id    uuid references public.teams (id) on delete cascade,
  player_id  uuid references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
comment on table public.notifications is
  'In-app notifications (coaches: new Player of the Week). Each user reads and marks read only their own; the database writes them.';
alter table public.notifications enable row level security;
create policy "see your own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark your own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- Player of the Week now also notifies the coaches.
create or replace function private.decide_players_of_week(p_team_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_off    public.team_offseason;
  v_today  date := private.team_today();
  v_week   date;
  v_from   date;
  v_to     date;
  v_round  integer;
  v_roster uuid[];
  v_winner uuid;
  v_points integer;
  v_added  integer;
begin
  select * into v_off from public.team_offseason where team_id = p_team_id;
  if not found then return; end if;
  select coalesce(array_agg(player_id), '{}') into v_roster from private.team_roster(p_team_id);
  v_week := v_off.starts_on - (extract(isodow from v_off.starts_on)::integer - 1);
  while v_week + 8 <= v_today and (v_off.ends_on is null or v_week <= v_off.ends_on) loop
    if not exists (select 1 from public.team_player_of_week where team_id = p_team_id and week_start = v_week) then
      v_from := greatest(v_week, v_off.starts_on);
      v_to := least(v_week + 6, coalesce(v_off.ends_on, v_week + 6));
      v_round := coalesce((select max(round) from public.team_player_of_week where team_id = p_team_id), 1);
      -- a round is over once everyone on the roster has been named in it
      if cardinality(v_roster) > 0 and not exists (
        select 1 from unnest(v_roster) as r(id)
         where not exists (select 1 from public.team_player_of_week w
                            where w.team_id = p_team_id and w.round = v_round and w.player_id = r.id)
      ) then
        v_round := v_round + 1;
      end if;
      v_winner := null;
      v_points := 0;
      select c.player_id, c.points into v_winner, v_points
        from (
          select r.id as player_id, t.points,
                 exists (select 1 from public.team_player_of_week w
                          where w.team_id = p_team_id and w.round = v_round and w.player_id = r.id) as named_this_round,
                 (select count(*) from public.team_player_of_week w where w.team_id = p_team_id and w.player_id = r.id) as times,
                 (select max(w.week_start) from public.team_player_of_week w where w.team_id = p_team_id and w.player_id = r.id) as last_week
            from unnest(v_roster) as r(id)
            cross join lateral private.offseason_tally(r.id, v_from, v_to) t
        ) c
       where c.points >= 10
         and (c.last_week is null or c.last_week <= v_week - 42)
       order by c.named_this_round, c.points desc, c.times, c.last_week nulls first, c.player_id
       limit 1;
      insert into public.team_player_of_week (team_id, week_start, player_id, points, round)
      values (p_team_id, v_week, v_winner, coalesce(v_points, 0), v_round)
      on conflict do nothing;
      get diagnostics v_added = row_count;
      -- a new Player of the Week: tell every coach and admin
      if v_added > 0 and v_winner is not null then
        insert into public.notifications (user_id, kind, title, body, href, team_id, player_id)
        select s.user_id, 'player-of-the-week',
               'Player of the Week: ' || coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name,
               t.name || ' · week of ' || trim(to_char(v_week, 'Mon FMDD')) || ' · ' || coalesce(v_points, 0) || ' points',
               '/players/' || v_winner || '/leaderboard?team=' || p_team_id,
               p_team_id, v_winner
          from public.staff s
          cross join public.players p
          cross join public.teams t
         where s.role in ('coach', 'admin') and p.id = v_winner and t.id = p_team_id;
      end if;
    end if;
    v_week := v_week + 7;
  end loop;
end $$;


-- For the bell: decides finished weeks for every team in its offseason (coaches and
-- admins only), then counts the caller's unread notifications.
create function private.unread_notifications() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid;
begin
  if (select private.can_edit()) then
    for v_team in select team_id from public.team_offseason loop
      perform private.decide_players_of_week(v_team);
    end loop;
  end if;
  return (select count(*)::integer from public.notifications where user_id = (select auth.uid()) and read_at is null);
end $$;
revoke all on function private.unread_notifications() from public;
grant execute on function private.unread_notifications() to authenticated;

create function public.unread_notifications() returns integer
language sql security invoker set search_path = '' as $$
  select private.unread_notifications()
$$;
revoke all on function public.unread_notifications() from public;
grant execute on function public.unread_notifications() to authenticated;
