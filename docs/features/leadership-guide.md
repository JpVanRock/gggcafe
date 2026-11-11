# G3 Leadership Guide (`/players/[id]/advanced/leadership`)
- Part of G3 Advanced, AND a coach/admin picks the player to train as a leader (user, 2026-11-08):
  `player_leadership_access`; `private.has_leadership()` = both. Coaches pick on her book page
  ("Train {name} as a leader"). Without both, players get 404s; staff see why it's closed.
- User's rules (2026-11-08): no quotes, simple, voice of a strong female athlete (never name or
  quote the athletes the user mentioned for the voice). No reference to any outside course, program
  or author anywhere on the site, in the code, comments or docs. Real people named in lesson
  examples are fine (user's choice). No trust falls in team-building (injury risk). Tailored to
  fastpitch (user, 2026-11-08): innings, at-bats, the dugout, the circle, bullpens and tee work, never
  halves, courts, shots or locker-room-only settings; examples from other sports get a softball version.
- Plan check-in dates become one-day TWIS activities (`player_activities.source = 'leadership-checkin'`,
  tag "Leadership"), kept in step whenever she saves or commits her plan (`syncCheckIns`: adds new dates,
  removes dropped ones, keeps the rest so check-offs stay). Left out of Manage activities; no points.
  Coaches/admins see the next two weeks of check-ins on their dashboard.
- Content in `src/lib/leadership-guide.ts` (paid content: server only, no imports, unit-tested):
  25 core lessons in parts (`CORE_PARTS`), 22 Extra Reps on shelves (`BONUS_SHELVES`, optional, any
  order, own progress, "X01"...), tools (`roles` 7 kinds of leaders, `engagement` five levels, `starters`,
  `habits` 44 grouped, `scenarios` 32 grouped with "A leader's move", `rubric` 13 areas rated 1-5 by
  her and her coach), My Leadership Plan (`/plan`), coach notes. Her work is keyed by lesson slug
  (`player_leadership_lessons`; slugs must never be "plan" or "certificate", which are pages).
- Two programs (user, 2026-11-10): when a coach picks a player they choose the Full Leadership Program
  (everything above) or Leadership Light (`player_leadership_access.program` = `full` | `light`; picks made
  before default to `full`). Both are part of G3 Advanced (`has_leadership()` unchanged).
  Leadership Light, for players 11 and under: `LIGHT_LESSONS` (8 lessons, slugs `light-...`, parts
  `LIGHT_PARTS`: Lead yourself, Lead your team; two questions and two challenges each, no tools), `LIGHT_INTRO`
  (then `GUIDE_CLOSER`, "Player-led teams know how to win.", which ends Read this first in both programs),
  `LIGHT_KEYS` (what she'll build, on the first page and the certificate's edge), "My Leader Plan" (the same plan
  record, showing `LIGHT_PLAN_SHOW`: her why, one habit, one goal with two steps, two check-ins; the rest of
  the plan is kept untouched), `LIGHT_COMMITMENT`. No Extra Reps, no rubric. Same voice in simpler words for
  younger players: still sleek and athletic, never babyish, no emoji.
  Pages follow her program (`lead.program`); a lesson of the other program is a 404. Coaches pick, switch
  and remove on her book page and the guide's first page (`LeaderToggle`). Switching keeps every lesson and
  the plan text, puts the plan back to draft and clears the sign-off (each program is signed off on its
  own); the certificate stays until she earns the next one.
  Finishing Light earns its own certificate (`CERTIFICATE_LIGHT`, "has completed G3 Leadership Light") and
  the same Leader Badge (`player_leadership_certificates.program`). Finishing Full later upgrades it; a Full
  certificate is never traded down (`certificateProgram`). Sample data: Lila is in Light (smoke-tested pages).
- Completion (user, 2026-11-08): every core lesson complete + plan committed, then the coach signs
  off on the plan page, which awards the Certificate of Leadership and the Leader Badge
  (`player_leadership_certificates`: team at the time for the logo, coach's printed name).
  Taking the sign-off back removes both. Certificate page `/advanced/leadership/certificate`
  (`components/leadership-certificate.tsx`, printable: globals.css `.certificate-print` prints only the
  sheet, letter landscape). Team logo in the seal, GGG logo when the team has none. A blank line
  is left for the head coach to sign by hand (user, 2026-11-08), with the printed name under it.
- Leader Badge (`components/leader-badge.tsx`, hexagon, pink edge, neon chevrons) shows next to her name
  on her dashboard and next to her name on the Dugout roster. Visible ONLY to coaches/admins ("head
  coach") and the player herself: the certificates table is an RLS exception (no view-only staff).
- DB tests: `tests/db/leadership.test.sql`.
