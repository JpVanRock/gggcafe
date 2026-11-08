-- =============================================================================
-- GGG.Cafe — Mentors (user, 2026-11-08)
--
-- A mentor (a mentor, a pitching or hitting coach...) signs up as "Mentor" and an
-- admin approves her (public.mentors). Coaches and admins assign her players
-- (public.mentor_players); she sees ONLY those players, read-only: profile, Goals
-- (Harada + SMART), Pop Report (Movement Preferences only with G3 Advanced) and
-- Mental GP. She can:
--   * message a player, optionally with a photo (private bucket message-photos)
--     or a suggested drill from the Drill Library (practice_drills, which she can
--     also add to); messages show as alerts on the player's dashboard;
--   * add dates to the player's TWIS, only if an admin turned on can_schedule.
-- Mentors are NOT staff: they read nothing else. Coaches, admins and view-only
-- staff can read every message (oversight); coaches/admins can remove one.
-- =============================================================================

create table public.mentors (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  specialty    text check (specialty is null or char_length(specialty) <= 60),
  can_schedule boolean not null default false,
  approved_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
comment on table public.mentors is
  'Approved mentors (not staff). Admins add, change and remove them; a mentor reads her own row; staff read all.';
alter table public.mentors enable row level security;
create policy "staff read mentors" on public.mentors for select to authenticated using ((select private.is_staff()));
create policy "mentor reads herself" on public.mentors for select to authenticated using (user_id = (select auth.uid()));
create policy "admins add mentors" on public.mentors for insert to authenticated with check ((select private.is_admin()));
create policy "admins change mentors" on public.mentors for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins remove mentors" on public.mentors for delete to authenticated using ((select private.is_admin()));

-- The players each mentor works with (coaches and admins assign them).
create table public.mentor_players (
  mentor_id   uuid not null references public.mentors (user_id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  assigned_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (mentor_id, player_id)
);
comment on table public.mentor_players is 'Which players a mentor works with. Coaches/admins assign; the mentor sees her own.';
select private.apply_staff_rls('public.mentor_players');
create policy "mentor sees her players" on public.mentor_players for select to authenticated using (mentor_id = (select auth.uid()));

create function private.is_mentor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mentors where user_id = (select auth.uid()))
$$;
create function private.my_mentee_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select mp.player_id from public.mentor_players mp where mp.mentor_id = (select auth.uid())
$$;
create function private.my_mentee_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct r.team_id from public.roster_entries r
   where r.player_id in (select mp.player_id from public.mentor_players mp where mp.mentor_id = (select auth.uid()))
$$;
create function private.mentor_can_schedule() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mentors where user_id = (select auth.uid()) and can_schedule)
$$;
revoke all on function private.is_mentor(), private.my_mentee_ids(), private.my_mentee_team_ids(), private.mentor_can_schedule() from public;
grant execute on function private.is_mentor(), private.my_mentee_ids(), private.my_mentee_team_ids(), private.mentor_can_schedule() to authenticated;

-- What a mentor reads about her players (read-only)
create policy "mentor reads her players" on public.players for select to authenticated
  using (id in (select private.my_mentee_ids()));
create policy "mentor reads her players' rosters" on public.roster_entries for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor reads her players' teams" on public.teams for select to authenticated
  using (id in (select private.my_mentee_team_ids()));
create policy "mentors read seasons" on public.seasons for select to authenticated using ((select private.is_mentor()));
create policy "mentors read the metric list" on public.metrics for select to authenticated using ((select private.is_mentor()));
create policy "mentor reads her players' measurements" on public.measurements for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor reads her players' evaluations" on public.skill_evaluations for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor reads her players' hitting styles" on public.hitting_styles for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor reads her players' movement (G3 Advanced)" on public.movement_preferences for select to authenticated
  using (player_id in (select private.my_mentee_ids()) and (select private.has_advanced(player_id)));
create policy "mentor reads her players' Harada charts" on public.harada_plans for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor reads her players' Harada pillars" on public.harada_pillars for select to authenticated
  using (plan_id in (select h.id from public.harada_plans h where h.player_id in (select private.my_mentee_ids())));
create policy "mentor reads her players' Harada actions" on public.harada_actions for select to authenticated
  using (pillar_id in (select p.id from public.harada_pillars p join public.harada_plans h on h.id = p.plan_id
                        where h.player_id in (select private.my_mentee_ids())));
create policy "mentor reads her players' SMART goals" on public.development_goals for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor reads her players' Mental GP" on public.mental_game_plans for select to authenticated
  using (player_id in (select private.my_mentee_ids()));
create policy "mentor views her players' photos" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos'
         and name in (select p.photo_path from public.players p where p.id in (select private.my_mentee_ids())));

-- The Drill Library: mentors read it and add to it
create policy "mentors read the drill library" on public.practice_drills for select to authenticated
  using ((select private.is_mentor()));
create policy "mentors add drills" on public.practice_drills for insert to authenticated
  with check ((select private.is_mentor()));

-- Messages to a player (with an optional photo or suggested drill)
create table public.mentor_messages (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  sender_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_name text not null default '' check (char_length(sender_name) <= 80),
  body        text check (body is null or char_length(body) between 1 and 2000),
  photo_path  text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[0-9]{10,16}\.jpg$'),
  drill_id    uuid references public.practice_drills (id) on delete set null,
  -- the suggested drill as it was when sent (players can't read the Drill Library itself)
  drill_name  text check (drill_name is null or char_length(drill_name) <= 120),
  drill_video_url text check (drill_video_url is null or drill_video_url ~ '^https://\S+$'),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  check (body is not null or photo_path is not null or drill_id is not null)
);
create index mentor_messages_player_idx on public.mentor_messages (player_id, created_at desc);
create index mentor_messages_sender_idx on public.mentor_messages (sender_id, created_at desc);
comment on table public.mentor_messages is
  'Mentor messages to a player (alerts on her dashboard): text, a photo and/or a suggested drill. Staff read all for oversight.';

-- The sender, her name and the suggested drill's name and video always come from the
-- database, never from the browser.
create function private.mentor_message_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.sender_id := (select auth.uid());
  new.sender_name := coalesce(
    (select display_name from public.mentors where user_id = (select auth.uid())),
    (select display_name from public.staff where user_id = (select auth.uid())),
    'Mentor');
  new.read_at := null;
  new.created_at := now();
  new.drill_name := null;
  new.drill_video_url := null;
  if new.drill_id is not null then
    select d.name, d.video_url into new.drill_name, new.drill_video_url from public.practice_drills d where d.id = new.drill_id;
  end if;
  return new;
end $$;
revoke all on function private.mentor_message_defaults() from public;
create trigger mentor_message_defaults before insert on public.mentor_messages
  for each row execute function private.mentor_message_defaults();

alter table public.mentor_messages enable row level security;
create policy "mentor messages her players" on public.mentor_messages for insert to authenticated
  with check ((select private.is_mentor()) and player_id in (select private.my_mentee_ids()));
create policy "sender reads what she sent" on public.mentor_messages for select to authenticated
  using (sender_id = (select auth.uid()));
create policy "player reads her messages" on public.mentor_messages for select to authenticated
  using (player_id in (select private.my_player_ids()));
create policy "player marks her messages read" on public.mentor_messages for update to authenticated
  using (player_id in (select private.my_player_ids())) with check (player_id in (select private.my_player_ids()));
create policy "staff read every message" on public.mentor_messages for select to authenticated
  using ((select private.is_staff()));
create policy "sender removes her messages" on public.mentor_messages for delete to authenticated
  using (sender_id = (select auth.uid()));
create policy "coaches remove messages" on public.mentor_messages for delete to authenticated
  using ((select private.can_edit()));
revoke update on public.mentor_messages from authenticated, anon;
grant update (read_at) on public.mentor_messages to authenticated;

-- Message photos: private; the sender uploads to her own folder; the sender, the player and staff view them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-photos', 'message-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "mentors upload message photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-photos' and (select private.is_mentor())
              and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "message photos: sender, player, staff" on storage.objects for select to authenticated
  using (bucket_id = 'message-photos'
         and (split_part(name, '/', 1) = (select auth.uid())::text
              or (select private.is_staff())
              or name in (select m.photo_path from public.mentor_messages m where m.player_id in (select private.my_player_ids()))));
create policy "senders remove their message photos" on storage.objects for delete to authenticated
  using (bucket_id = 'message-photos' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "coaches remove message photos" on storage.objects for delete to authenticated
  using (bucket_id = 'message-photos' and (select private.can_edit()));

-- Dates on a player's TWIS (only mentors an admin allows: can_schedule)
alter table public.player_activities drop constraint player_activities_source_check;
alter table public.player_activities
  add constraint player_activities_source_check check (source is null or source in ('leadership-checkin', 'mentor'));
create policy "mentor adds dates for her players" on public.player_activities for insert to authenticated
  with check (source = 'mentor' and created_by = (select auth.uid()) and (select private.mentor_can_schedule())
              and player_id in (select private.my_mentee_ids()));
create policy "mentor sees the dates she added" on public.player_activities for select to authenticated
  using (source = 'mentor' and created_by = (select auth.uid()));
create policy "mentor removes the dates she added" on public.player_activities for delete to authenticated
  using (source = 'mentor' and created_by = (select auth.uid()));

-- Mentor sign-ups waiting for an admin (from the sign-up form's role).
create function private.pending_mentors()
returns table (user_id uuid, email text, display_name text, specialty text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'display_name', ''), u.raw_user_meta_data ->> 'specialty', u.created_at
    from auth.users u
   where (select private.is_admin())
     and u.raw_user_meta_data ->> 'role' = 'mentor'
     and not exists (select 1 from public.mentors m where m.user_id = u.id)
     and not exists (select 1 from public.staff s where s.user_id = u.id)
   order by u.created_at
$$;
revoke all on function private.pending_mentors() from public;
grant execute on function private.pending_mentors() to authenticated;
create function public.pending_mentors()
returns table (user_id uuid, email text, display_name text, specialty text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.pending_mentors() $$;
revoke all on function public.pending_mentors() from public, anon;
grant execute on function public.pending_mentors() to authenticated;
