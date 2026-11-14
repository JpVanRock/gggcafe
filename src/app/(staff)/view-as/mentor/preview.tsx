// A mentor's home drawn like their mentor menu, read only, for admins (user, 2026-11-14): one mentor's
// own (View as → a mentor) and the example of a new whole-team mentor when a team has none yet
// (example/page.tsx). Links are left out: labels show where a mentor would tap.
import { Badge } from "@/components/ui";
import { MenuHeader, MenuItem, MenuPanel } from "@/components/menu-board";
import { ComingUpCard } from "@/components/coming-up";
import type { ComingUpItem } from "@/lib/family";
import { MENTOR_SECTIONS } from "@/app/mentor/parts";

export type PreviewPlayer = { id: string; name: string; jersey: string | null; position: string | null; team: string | null };
export type PreviewRequest = { id: string; label: string; waitingOn: "parents" | "coach" | null };
export type PreviewLine = { key: string; name: string; value: string; note?: string };

export function MentorPreview({
  name,
  line,
  requests,
  players,
  upcoming,
  calendarHref,
  sessions,
  messages,
  calls = [],
}: {
  name: string;
  line: string;
  requests: PreviewRequest[];
  players: PreviewPlayer[];
  upcoming: ComingUpItem[];
  calendarHref: string;
  sessions: PreviewLine[];
  messages: PreviewLine[];
  /** the video calls they booked that are ahead (user, 2026-11-14) */
  calls?: PreviewLine[];
}) {
  const [first, ...rest] = name.split(" ");
  const total = players.length;
  const byTeam = [...new Set(players.map((p) => p.team ?? "Team"))];
  const note = "text-sm text-[var(--menu-note)]";
  return (
    <>
      <MenuHeader eyebrow="Mentor menu" first={first} last={rest.join(" ") || undefined} line={line} />
      {requests.length > 0 && (
        <section aria-label="Their requests" className="rounded-2xl border-2 border-pink bg-pink/5 p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
            <span className="grid size-6 place-items-center rounded-full bg-pink font-display text-sm text-on-accent tabular-nums">{requests.length}</span>
            Your requests
          </h2>
          <ul className="divide-y divide-navy-700">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="font-semibold">{r.label}</span>
                <Badge tone={r.waitingOn ? "pink" : "neutral"}>
                  {r.waitingOn === "parents" ? "Waiting for her parents" : r.waitingOn === "coach" ? "Waiting for the head coach" : "Not approved"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
      {total > 0 && <ComingUpCard items={upcoming} calendarHref={calendarHref} subtitle="The next two weeks" />}
      {total > 0 && (
        <section aria-label="Mentor menu" className="grid gap-8 md:grid-cols-2">
          <MenuPanel number={1} title="Mentor Roster" subtitle={`${total} player${total === 1 ? "" : "s"} · goals, Pop Report, Mental GP`} variant="outlineNeon" wide>
            <div className="flex flex-col gap-6">
              {byTeam.map((team) => (
                <div key={team}>
                  {byTeam.length > 1 && <h3 className="mb-3 font-display text-xl font-bold tracking-wide uppercase">{team}</h3>}
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {players
                      .filter((p) => (p.team ?? "Team") === team)
                      .map((p) => (
                        <li key={p.id} className="flex flex-col rounded-2xl border border-navy-600">
                          <div className="flex items-center gap-4 p-4">
                            <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-navy-600 font-display text-xl font-bold text-highlight">
                              {p.jersey ?? p.position ?? "–"}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-display text-xl font-bold tracking-wide uppercase">{p.name}</span>
                              <span className="block truncate font-mono text-xs text-muted">{[p.jersey && `#${p.jersey}`, p.position, p.team].filter(Boolean).join(" · ")}</span>
                            </span>
                          </div>
                          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-navy-700 px-4 py-2.5">
                            {MENTOR_SECTIONS.map((x) => (
                              <span key={x.hash} className="text-sm font-semibold text-link">
                                {x.label}
                              </span>
                            ))}
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </MenuPanel>
          <MenuPanel number={2} title="Video Calls" subtitle="One player, or a group from one team" variant="navy" wide>
            {calls.length === 0 ? (
              <p className={note}>No calls booked. They schedule one here: tick one player, or several from one team for a group call.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {calls.map((c) => (
                  <MenuItem key={c.key} name={c.name} value={c.value} note={c.note} />
                ))}
              </div>
            )}
          </MenuPanel>
          <MenuPanel number={3} title="Training on Their Weeks" subtitle="In their This Week in Softball" variant="pink" cta={{ label: "Add & manage" }}>
            {sessions.length === 0 ? (
              <p className={note}>Nothing coming up. Add a lesson, a bullpen or a hitting session to their weeks.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.map((s) => (
                  <MenuItem key={s.key} name={s.name} value={s.value} note={s.note} />
                ))}
              </div>
            )}
          </MenuPanel>
          <MenuPanel number={4} title="Messages You Sent" subtitle="Seen when she opens them" variant="navy">
            {messages.length === 0 ? (
              <p className={note}>Nothing sent yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m) => (
                  <MenuItem key={m.key} name={m.name} value={m.value} note={m.note} />
                ))}
              </div>
            )}
          </MenuPanel>
          <MenuPanel number={5} title="Work With More Players" subtitle="A player or a whole team" variant="outlinePink" wide>
            <p className={note}>Ask with the team code. Her parents approve you for one player; the head coach approves you for the whole team.</p>
          </MenuPanel>
        </section>
      )}
    </>
  );
}
