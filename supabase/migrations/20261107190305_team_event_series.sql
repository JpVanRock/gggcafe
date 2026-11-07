-- =============================================================================
-- GGG.Cafe — Team event series
--
-- Events added with "repeat weekly" share a series_id, so the Coaches Dugout
-- calendar can delete "this and later" in one go. updated_by records who last
-- changed an event. Access is unchanged: staff read; only coaches and admins
-- add, change or remove events (private.apply_staff_rls).
-- =============================================================================

alter table public.team_events
  add column series_id  uuid,
  add column updated_by uuid references auth.users (id) on delete set null;
create index team_events_series_idx on public.team_events (series_id, event_date) where series_id is not null;

-- who last changed it (the existing set_updated_at trigger keeps updated_at)
create function private.set_updated_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function private.set_updated_by() from public;
create trigger set_updated_by before update on public.team_events
  for each row execute function private.set_updated_by();
