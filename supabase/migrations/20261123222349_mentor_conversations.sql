-- Mentor conversations (user, 2026-11-23): "a messaging platform for mentors where they can send message to players as
-- a free form field. Also allow to send summary messages to parents as a separate field", then "Allow parents and girls
-- to submit responses and maintain as a conversation or thread".
--
-- mentor_messages becomes two-way threads, one per mentor and player, of two kinds (`audience`):
--   'player'  the mentor and the player. As before, the mentor sends text, a photo and/or a drill; now the player
--             answers (text). Her approved parents and the admins read all of it; coaches read the mentor's messages
--             she shares with them.
--   'parents' the mentor and the player's approved parents: summaries and replies, text only. The player never reads
--             it (her rule now says audience = 'player'); the admins do; coaches don't (the mentor's notes with the
--             coaches are their channel).
-- `author_role` says who wrote a row (mentor / player / parent) and `mentor_id` whose thread it is. Who wrote it, their
-- name and when always come from the database. Replies go only to a mentor approved for her right now.
-- read_at: the player (her thread) or any of her approved parents (theirs) marks a mentor's message read; the mentor
-- marks the replies read.
-- Notices: a reply notifies the mentor; a mentor's message to the parents notifies each of them. The parents thread is
-- emailed too (job email.mentor_message, docs/architecture/jobs.md): the parents get the mentor's messages, the mentor
-- gets the parents'. The Switchboard: "Message players" (mentor.messages) closes the player thread both ways, and the new
-- "Message parents" (mentor.parent_messages) the parents thread.

-- -----------------------------------------------------------------------------
-- 1. Threads: whose, which kind, who wrote it
-- -----------------------------------------------------------------------------
alter table public.mentor_messages
  add column mentor_id uuid references auth.users (id) on delete cascade,
  add column audience text not null default 'player' check (audience in ('player', 'parents')),
  add column author_role text not null default 'mentor' check (author_role in ('mentor', 'player', 'parent'));
update public.mentor_messages set mentor_id = sender_id;
alter table public.mentor_messages alter column mentor_id set not null;
-- the trigger sets it for a mentor's message; a reply names the mentor it answers
alter table public.mentor_messages alter column mentor_id set default auth.uid();
alter table public.mentor_messages
  add constraint mentor_messages_thread_author check (
    (audience = 'player' and author_role in ('mentor', 'player'))
    or (audience = 'parents' and author_role in ('mentor', 'parent'))),
  -- only the mentor's messages to the player carry a photo or a drill, or are shared with the coaches
  add constraint mentor_messages_extras check (
    (author_role = 'mentor' and audience = 'player')
    or (photo_path is null and drill_id is null and not shared_with_coaches));
create index mentor_messages_thread_idx on public.mentor_messages (mentor_id, player_id, audience, created_at desc);

comment on table public.mentor_messages is
  'Mentor conversations: one thread per mentor and player with the player (audience player: the mentor''s text, photo or drill, and her replies) and one with her approved parents (audience parents: text both ways, never shown to the player). Parents and admins read both; coaches read what the mentor shares.';
comment on column public.mentor_messages.mentor_id is 'Whose thread: the mentor. For a reply, the mentor it answers (approved for her when sent).';
comment on column public.mentor_messages.audience is 'player: the mentor and the player. parents: the mentor and her approved parents (the player never reads it).';
comment on column public.mentor_messages.author_role is 'Who wrote it: mentor, player (her thread) or parent (the parents thread).';
comment on column public.mentor_messages.read_at is
  'A mentor''s message: when the player (her thread) or one of her parents (theirs) read it. A reply: when the mentor read it.';

-- Is this mentor approved for this player right now (her own link, or her team's)? For replies.
create function private.is_mentor_of(p_mentor_id uuid, p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mentor_links l
                  where l.mentor_id = p_mentor_id and l.status = 'approved' and l.player_id = p_player_id)
      or exists (select 1 from public.mentor_links l
                   join public.roster_entries r on r.team_id = l.team_id and r.active and r.season_id = private.team_current_season(l.team_id)
                  where l.mentor_id = p_mentor_id and l.status = 'approved' and l.player_id is null and r.player_id = p_player_id)
$$;
revoke all on function private.is_mentor_of(uuid, uuid) from public;
grant execute on function private.is_mentor_of(uuid, uuid) to authenticated;

-- Who wrote it, their name and when: always from the database. A mentor's message is in her own thread.
create or replace function private.mentor_message_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
begin
  new.sender_id := v_me;
  new.read_at := null;
  new.created_at := now();
  new.drill_name := null;
  new.drill_video_url := null;
  if new.author_role = 'mentor' then
    new.mentor_id := v_me;
    new.sender_name := coalesce(
      (select display_name from public.mentors where user_id = v_me),
      (select display_name from public.staff where user_id = v_me),
      'Mentor');
    if new.drill_id is not null then
      select d.name, d.video_url into new.drill_name, new.drill_video_url from public.practice_drills d where d.id = new.drill_id;
    end if;
  elsif new.author_role = 'player' then
    new.sender_name := coalesce(
      (select left(coalesce(nullif(btrim(p.preferred_name), ''), p.first_name), 80) from public.players p where p.id = new.player_id),
      'Player');
  else
    new.sender_name := coalesce((select a.display_name from public.parent_accounts a where a.user_id = v_me), 'Parent');
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Who writes, reads and marks read
-- -----------------------------------------------------------------------------
drop policy "mentor messages her players" on public.mentor_messages;
create policy "mentor messages her players" on public.mentor_messages for insert to authenticated
  with check (author_role = 'mentor' and (select private.is_mentor()) and player_id in (select private.my_mentee_ids()));
create policy "player answers her mentors" on public.mentor_messages for insert to authenticated
  with check (author_role = 'player' and audience = 'player' and player_id in (select private.my_player_ids())
              and private.is_mentor_of(mentor_id, player_id));
create policy "parents write to her mentors" on public.mentor_messages for insert to authenticated
  with check (author_role = 'parent' and audience = 'parents' and (select private.is_parent_of(player_id))
              and private.is_mentor_of(mentor_id, player_id));

-- the player reads her own thread only (and her parent, viewing as her, the same)
drop policy "player reads her messages" on public.mentor_messages;
drop policy if exists "player reads her messages (parent view)" on public.mentor_messages;
create policy "player reads her messages" on public.mentor_messages for select to authenticated
  using (audience = 'player' and player_id in (select private.my_player_ids()));
create policy "player reads her messages (parent view)" on public.mentor_messages for select to authenticated
  using (audience = 'player' and player_id in (select private.my_child_ids()));
-- the mentor reads both her threads, replies included (still after she stops working with her, like what she sent)
create policy "mentor reads her conversations" on public.mentor_messages for select to authenticated
  using (mentor_id = (select auth.uid()));
-- unchanged: "parents read their daughter's messages" (both threads), "admins read every message",
-- "coaches read shared messages" (only a mentor's message to the player can be shared)

drop policy "player marks her messages read" on public.mentor_messages;
create policy "player marks her messages read" on public.mentor_messages for update to authenticated
  using (audience = 'player' and player_id in (select private.my_player_ids()))
  with check (audience = 'player' and player_id in (select private.my_player_ids()));
create policy "parents mark the mentor's messages read" on public.mentor_messages for update to authenticated
  using (audience = 'parents' and (select private.is_parent_of(player_id)))
  with check (audience = 'parents' and (select private.is_parent_of(player_id)));
create policy "mentor marks replies read" on public.mentor_messages for update to authenticated
  using (mentor_id = (select auth.uid())) with check (mentor_id = (select auth.uid()));

-- Only the sender shares; a mentor's message is marked read by the one it was written to, a reply by the mentor.
create or replace function private.guard_mentor_message_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
begin
  if current_user not in ('authenticated', 'anon') then
    return new;  -- maintenance as the database owner
  end if;
  if new.shared_with_coaches is distinct from old.shared_with_coaches and old.sender_id is distinct from v_me then
    raise exception 'only the mentor who sent it can share it' using errcode = '42501';
  end if;
  if new.read_at is distinct from old.read_at and not (
       (old.author_role = 'mentor' and old.audience = 'player' and old.player_id in (select private.my_player_ids()))
    or (old.author_role = 'mentor' and old.audience = 'parents' and private.is_parent_of(old.player_id))
    or (old.author_role <> 'mentor' and old.mentor_id = v_me)) then
    raise exception 'only the one it was written to marks it read' using errcode = '42501';
  end if;
  return new;
end $$;

-- The Switchboard: each thread has its own switch (both ways)
drop policy "switchboard: mentor messages" on public.mentor_messages;
create policy "switchboard: mentor messages" on public.mentor_messages as restrictive for insert to authenticated
  with check (not private.feature_off_for_player(player_id, case when audience = 'parents' then 'mentor.parent_messages' else 'mentor.messages' end));

-- -----------------------------------------------------------------------------
-- 3. Notices and emails
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('player-of-the-week', 'video-call', 'parent-joined', 'message'));

create function private.notify_mentor_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name    text;
  v_preview text := case when new.body is null then null
                         when char_length(new.body) > 200 then left(new.body, 199) || '…' else new.body end;
begin
  select coalesce(nullif(btrim(p.preferred_name), ''), p.first_name) into v_name from public.players p where p.id = new.player_id;
  if new.author_role = 'mentor' and new.audience = 'parents' then
    -- each of her approved parents (not the mentor, if she's a parent too)
    insert into public.notifications (user_id, kind, title, body, href, player_id)
    select l.parent_id, 'message', left(new.sender_name || ' (mentor) wrote to you about ' || v_name, 200), v_preview,
           '/family/mentors?player=' || new.player_id, new.player_id
      from public.parent_links l
     where l.player_id = new.player_id and l.status = 'approved' and l.parent_id is distinct from new.sender_id;
    if found then
      perform private.enqueue_job('email.mentor_message', 'email.mentor_message:' || new.id, jsonb_build_object('message_id', new.id));
    end if;
  elsif new.author_role <> 'mentor' and new.mentor_id is distinct from new.sender_id then
    insert into public.notifications (user_id, kind, title, body, href, player_id)
    values (new.mentor_id, 'message',
            left(case when new.author_role = 'player' then v_name || ' answered you'
                      else new.sender_name || ' (' || v_name || '''s parent) wrote to you' end, 200),
            v_preview, '/mentor/messages?player=' || new.player_id || '&with=' || new.audience, new.player_id);
    if new.audience = 'parents' then
      perform private.enqueue_job('email.mentor_message', 'email.mentor_message:' || new.id, jsonb_build_object('message_id', new.id));
    end if;
  end if;
  return null;
end $$;
revoke all on function private.notify_mentor_message() from public;
create trigger notify_mentor_message after insert on public.mentor_messages
  for each row execute function private.notify_mentor_message();

-- The email for a message in the parents thread, for the job worker only (the jobs secret): the mentor's goes to her
-- approved parents (one row, every address), a parent's to the mentor.
create function private.jobs_mentor_message_email(p_secret text, p_message_id uuid)
returns table (recipients text[], author_role text, author_name text, mentor_name text, player_first text, player_id uuid, body text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.jobs_check(p_secret);
  return query
    select case when m.author_role = 'mentor' then
             coalesce((select array_agg(distinct u.email::text order by u.email::text)
                         from public.parent_links l join auth.users u on u.id = l.parent_id
                        where l.player_id = m.player_id and l.status = 'approved' and u.email is not null
                          and l.parent_id is distinct from m.sender_id), '{}')
           else
             coalesce((select array[u.email::text] from auth.users u where u.id = m.mentor_id and u.email is not null), '{}')
           end,
           m.author_role, m.sender_name,
           coalesce((select x.display_name from public.mentors x where x.user_id = m.mentor_id), 'Mentor'),
           coalesce(nullif(btrim(p.preferred_name), ''), p.first_name),
           m.player_id, m.body
      from public.mentor_messages m
      join public.players p on p.id = m.player_id
     where m.id = p_message_id and m.audience = 'parents';
end $$;
select private.expose('private.jobs_mentor_message_email(text, uuid)', array['anon']);
