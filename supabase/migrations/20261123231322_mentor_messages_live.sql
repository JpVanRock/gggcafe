-- Mentor messages as a live chat, and what happened to each one (user, 2026-11-23): "can you allow the admin role to
-- actually see what happens when a message is sent", "The messaging center should be like a streaming platform or
-- inbox", "players do not have email so is there a way to have a ongoing dialogue like a chat".
-- 1. Players hear about a mentor's message in their notifications bell (they have no email; before, only the alert at
--    the top of her menu).
-- 2. Each notice names its message (notifications.message_id; taking a message back removes its notices).
-- 3. admin_message_trail(ids), admins only: for each message, who was notified and whether they opened the notice,
--    the email (sent, skipped and why, failing, waiting; only the parents' conversation is emailed), and when it was
--    read (read_at is on the message).
-- 4. Live: mentor_messages joins Supabase Realtime, so an open conversation shows new messages and "Seen" as they
--    happen. Realtime checks each subscriber's read rules, so nobody gets a row they couldn't read.

-- -----------------------------------------------------------------------------
-- 1 and 2. Notices name their message; players get one too
-- -----------------------------------------------------------------------------
alter table public.notifications add column message_id uuid references public.mentor_messages (id) on delete cascade;
create index notifications_message_idx on public.notifications (message_id);
comment on column public.notifications.message_id is
  'The mentor message a notice is about (admin_message_trail shows who was told). Taking the message back removes it.';

-- as in 20261123222349, plus the player's notice and the message id
create or replace function private.notify_mentor_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name    text;
  v_preview text := case
                      when new.body is not null then case when char_length(new.body) > 200 then left(new.body, 199) || '…' else new.body end
                      when new.drill_name is not null then 'Drill to try: ' || new.drill_name
                      when new.photo_path is not null then 'A photo'
                    end;
begin
  select coalesce(nullif(btrim(p.preferred_name), ''), p.first_name) into v_name from public.players p where p.id = new.player_id;
  if new.author_role = 'mentor' and new.audience = 'player' then
    -- her own login (players have no email): the bell, on top of the alert on her menu
    insert into public.notifications (user_id, kind, title, body, href, player_id, message_id)
    select distinct c.user_id, 'message', left(new.sender_name || ' sent you a message', 200), v_preview,
           '/players/' || new.player_id || '/messages?mentor=' || new.mentor_id, new.player_id, new.id
      from public.player_claims c
      join public.roster_entries r on r.id = c.roster_entry_id
     where r.player_id = new.player_id and c.status = 'approved' and c.user_id is distinct from new.sender_id;
  elsif new.author_role = 'mentor' and new.audience = 'parents' then
    -- each of her approved parents (not the mentor, if she's a parent too)
    insert into public.notifications (user_id, kind, title, body, href, player_id, message_id)
    select l.parent_id, 'message', left(new.sender_name || ' (mentor) wrote to you about ' || v_name, 200), v_preview,
           '/family/mentors?player=' || new.player_id, new.player_id, new.id
      from public.parent_links l
     where l.player_id = new.player_id and l.status = 'approved' and l.parent_id is distinct from new.sender_id;
    if found then
      perform private.enqueue_job('email.mentor_message', 'email.mentor_message:' || new.id, jsonb_build_object('message_id', new.id));
    end if;
  elsif new.author_role <> 'mentor' and new.mentor_id is distinct from new.sender_id then
    insert into public.notifications (user_id, kind, title, body, href, player_id, message_id)
    values (new.mentor_id, 'message',
            left(case when new.author_role = 'player' then v_name || ' answered you'
                      else new.sender_name || ' (' || v_name || '''s parent) wrote to you' end, 200),
            v_preview, '/mentor/messages?player=' || new.player_id || '&with=' || new.audience, new.player_id, new.id);
    if new.audience = 'parents' then
      perform private.enqueue_job('email.mentor_message', 'email.mentor_message:' || new.id, jsonb_build_object('message_id', new.id));
    end if;
  end if;
  return null;
end $$;

-- -----------------------------------------------------------------------------
-- 3. What happened to each message, for admins
-- -----------------------------------------------------------------------------
-- notified: [{name, read_at}] (read_at: when they opened the notice). email: none (a player's conversation isn't
-- emailed), not_sent (no approved parent to email), waiting, retrying (with the last error), done, skipped (with why),
-- dead (gave up, with the last error).
create function private.admin_message_trail(p_message_ids uuid[])
returns table (message_id uuid, notified jsonb, email text, email_note text, email_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_message_ids), 0) > 500 then
    raise exception 'at most 500 messages at a time' using errcode = '22023';
  end if;
  return query
    select m.id,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'name', coalesce(st.display_name, mt.display_name, pa.display_name,
                                                coalesce(nullif(btrim(p.preferred_name), ''), p.first_name), 'Someone'),
                               'read_at', n.read_at)
                             order by n.created_at, n.id)
                       from public.notifications n
                       left join public.staff st on st.user_id = n.user_id
                       left join public.mentors mt on mt.user_id = n.user_id
                       left join public.parent_accounts pa on pa.user_id = n.user_id
                      where n.message_id = m.id), '[]'::jsonb),
           case when m.audience <> 'parents' then 'none'
                when j.id is null then 'not_sent'
                when j.done_at is null and j.attempts = 0 then 'waiting'
                when j.done_at is null then 'retrying'
                else j.outcome end,
           j.last_error,
           coalesce(j.done_at, j.run_at)
      from unnest(p_message_ids) as ids (id)
      join public.mentor_messages m on m.id = ids.id
      join public.players p on p.id = m.player_id
      left join private.jobs j on j.dedupe_key = 'email.mentor_message:' || m.id::text;
end $$;
select private.expose('private.admin_message_trail(uuid[])');

-- -----------------------------------------------------------------------------
-- 4. Live conversations (Supabase Realtime; skipped where there's no Realtime, as in the test database)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentor_messages') then
    alter publication supabase_realtime add table public.mentor_messages;
  end if;
end $$;
