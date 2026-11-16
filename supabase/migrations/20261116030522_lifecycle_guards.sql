-- Lifecycle guards (docs/architecture/state-machines.md, 2026-11-16). The five approval requests
-- (player claims, parent links, mentor links, coach sign-ups, parental consents) are state machines:
-- a request waits, then is decided once. Three of them were only guarded inside their decide
-- function; claims and parent links are decided by a plain UPDATE from the app, so a page left
-- open could flip a decision another coach had already made. Now the database refuses any status
-- change that isn't one of the table's edges, whoever makes it.
--
-- The edges live in each trigger's arguments, 'from>to'. src/lib/lifecycles.ts declares the same
-- machines for the app (labels, tones, which buttons to show) and tests/unit/lifecycles.test.ts
-- fails when the two lists differ. A new edge: add it to both, in a new migration.

-- Raises P0010 (friendlyDbError: "this changed since the page loaded") for a status change that
-- isn't listed. Argument 0 is the column, the rest are the allowed edges. Same-state updates pass.
create function private.guard_transition() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_from text := to_jsonb(old) ->> tg_argv[0];
  v_to   text := to_jsonb(new) ->> tg_argv[0];
begin
  if v_from is distinct from v_to and not ((v_from || '>' || v_to) = any (tg_argv[1:])) then
    raise exception '% can''t go from % to %', tg_table_name, v_from, v_to
      using errcode = 'P0010', hint = 'allowed: ' || array_to_string(tg_argv[1:], ', ');
  end if;
  return new;
end $$;
revoke all on function private.guard_transition() from public;
comment on function private.guard_transition() is
  'Trigger: a status column moves only along the edges in its arguments (column, ''from>to'', ...). See docs/architecture/state-machines.md.';

-- A player's claim on her roster spot: a coach decides it; she can ask again after a decline;
-- withdrawn parental consent declines an approved claim (withdraw_parental_consent).
create trigger player_claims_lifecycle before update of status on public.player_claims
  for each row when (old.status is distinct from new.status)
  execute function private.guard_transition('status', 'pending>approved', 'pending>declined', 'declined>pending', 'approved>declined');

-- A parent asking to join a team: the head coach decides it once (removing a parent deletes the row).
create trigger parent_links_lifecycle before update of status on public.parent_links
  for each row when (old.status is distinct from new.status)
  execute function private.guard_transition('status', 'pending>approved', 'pending>declined');

-- A mentor asking to work with a team or one player: decided once (decide_mentor_link).
create trigger mentor_links_lifecycle before update of status on public.mentor_links
  for each row when (old.status is distinct from new.status)
  execute function private.guard_transition('status', 'pending>approved', 'pending>declined');

-- A coach sign-up: decided once (decide_staff_request).
create trigger staff_requests_lifecycle before update of status on public.staff_requests
  for each row when (old.status is distinct from new.status)
  execute function private.guard_transition('status', 'pending>approved', 'pending>declined');

-- Parental consent: an admin verifies or declines it; the parent can withdraw it while it waits
-- or after it's verified. A new request is a new row (submit_parental_consent).
create trigger parental_consents_lifecycle before update of status on public.parental_consents
  for each row when (old.status is distinct from new.status)
  execute function private.guard_transition('status', 'pending>verified', 'pending>declined', 'pending>withdrawn', 'verified>withdrawn');
