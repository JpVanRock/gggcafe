-- =============================================================================
-- GGG.Cafe — Leadership Light (user, 2026-11-10)
-- When a coach picks a player to train as a leader, they choose the Full Leadership
-- Program (the 25-lesson guide) or Leadership Light (eight short lessons for players 11
-- and under). Both are part of G3 Advanced (private.has_leadership() is unchanged) and
-- both earn the Leader Badge. The lessons live in src/lib/leadership-guide.ts.
-- =============================================================================

-- Which program she's in. Players picked before today stay on the Full program.
alter table public.player_leadership_access
  add column program text not null default 'full' check (program in ('full', 'light'));
comment on column public.player_leadership_access.program is
  'full = the Full Leadership Program (G3 Leadership Guide); light = Leadership Light (11 and under).';

-- Which program her certificate is for. Finishing Full after Light upgrades it; a Full
-- certificate is never traded down (src/lib/leadership-guide.ts certificateProgram).
alter table public.player_leadership_certificates
  add column program text not null default 'full' check (program in ('full', 'light'));
comment on column public.player_leadership_certificates.program is
  'The program her certificate is for: full or light. Both earn the Leader Badge.';
