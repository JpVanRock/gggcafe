-- =============================================================================
-- GGG.Cafe — Pin search_path on the two private helpers that lacked it
-- (Supabase Security Advisor: "Function Search Path Mutable").
-- =============================================================================
alter function private.set_updated_at() set search_path = '';
alter function private.apply_staff_rls(regclass) set search_path = '';
