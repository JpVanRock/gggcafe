-- Chat in a video call (user, 2026-11-23: "should be able to chat with players during video call if you can add a
-- live chat in the video call back that is saved"). A call page has a chat beside the video: the people on the call
-- (the host, the invited players, their parents, invited mentors, head coaches and admins: whoever
-- video_call_role() lets join) write while the call is open (10 minutes before the start until 15 minutes after the
-- end, as for joining) and read it any time after, so it's kept with the call. Nobody else reads it; nobody edits;
-- admins can remove a message. Zoom's own chat isn't saved; this one is. Live through Supabase Realtime.
--
-- Not apply_staff_rls: the call's own people, not the staff, decide who reads it (like the call itself).

create table public.video_call_messages (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid not null references public.video_calls (id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 80),
  author_role text not null default 'guest' check (author_role in ('host', 'mentor', 'coach', 'player', 'parent', 'guest')),
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index video_call_messages_call_idx on public.video_call_messages (call_id, created_at);
comment on table public.video_call_messages is
  'Chat in a video call, kept with the call: the people who may join it write while it''s open and read it afterwards.';

-- May I see this call's chat (any answer from video_call_role, which refuses everyone else)?
create function private.in_video_call(p_call_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.video_call_role(p_call_id) is not null;
exception when insufficient_privilege then
  return false;
end $$;
revoke all on function private.in_video_call(uuid) from public;
grant execute on function private.in_video_call(uuid) to authenticated;

-- May I write in it now: on the call (host or guest, so not cancelled or switched off) while it's open?
create function private.video_call_chat_open(p_call_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.video_calls;
  v_role text;
begin
  select * into v from public.video_calls where id = p_call_id;
  if not found then
    return false;
  end if;
  begin
    v_role := private.video_call_role(p_call_id);
  exception when insufficient_privilege then
    return false;
  end;
  return v_role in ('host', 'guest')
     and now() between v.starts_at - interval '10 minutes' and v.starts_at + make_interval(mins => v.minutes + 15);
end $$;
revoke all on function private.video_call_chat_open(uuid) from public;
grant execute on function private.video_call_chat_open(uuid) to authenticated;

-- Who wrote it, as what, and when: from the database (the host, an invited mentor, the invited player, her parent,
-- then a head coach or admin dropping in).
create function private.video_call_message_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v    public.video_calls;
  v_me uuid := (select auth.uid());
begin
  select * into v from public.video_calls where id = new.call_id;
  new.author_id := v_me;
  new.created_at := now();
  new.author_role := case
    when v.host_id = v_me then 'host'
    when exists (select 1 from public.video_call_mentors m where m.call_id = new.call_id and m.mentor_id = v_me) then 'mentor'
    when exists (select 1 from public.video_call_players x where x.call_id = new.call_id and x.player_id in (select private.my_player_ids())) then 'player'
    when exists (select 1 from public.video_call_players x where x.call_id = new.call_id and x.player_id in (select private.my_child_ids())) then 'parent'
    when exists (select 1 from public.staff s where s.user_id = v_me) then 'coach'
    else 'guest' end;
  new.author_name := left(coalesce(case new.author_role
    when 'host' then v.host_name
    when 'mentor' then (select display_name from public.mentors where user_id = v_me)
    when 'player' then (select coalesce(nullif(btrim(p.preferred_name), ''), p.first_name)
                          from public.video_call_players x join public.players p on p.id = x.player_id
                         where x.call_id = new.call_id and x.player_id in (select private.my_player_ids()) limit 1)
    when 'parent' then (select display_name from public.parent_accounts where user_id = v_me)
    when 'coach' then (select display_name from public.staff where user_id = v_me)
  end, 'Guest'), 80);
  return new;
end $$;
revoke all on function private.video_call_message_defaults() from public;
create trigger video_call_message_defaults before insert on public.video_call_messages
  for each row execute function private.video_call_message_defaults();

-- a busy chat is fine; a flood isn't
create function private.limit_video_call_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('video_call.chat', 120, 3600);
  return new;
end $$;
revoke all on function private.limit_video_call_messages() from public;
create trigger rate_limit before insert on public.video_call_messages
  for each row execute function private.limit_video_call_messages();

alter table public.video_call_messages enable row level security;
create policy "the call's people read its chat" on public.video_call_messages for select to authenticated
  using (private.in_video_call(call_id));
create policy "the call's people write while it's open" on public.video_call_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and private.video_call_chat_open(call_id));
create policy "admins remove chat messages" on public.video_call_messages for delete to authenticated
  using ((select private.is_admin()));
revoke update on public.video_call_messages from authenticated, anon;

-- live (Supabase Realtime; skipped where there's none, as in the test database)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'video_call_messages') then
    alter publication supabase_realtime add table public.video_call_messages;
  end if;
end $$;
