import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/softball";
import { Badge, Card, EmptyState, tableClass, tdClass, thClass, TableScroll } from "@/components/ui";
import { MenuHeader, MenuItem, MenuPanel } from "@/components/menu-board";
import { ComingUpCard } from "@/components/coming-up";
import { PillNav } from "@/components/pill-nav";
import { comingUp } from "@/lib/family";
import type { MentorView } from "@/lib/view-as";
import { loadComingUp } from "@/app/family/team-data";
import { asComingUp, loadMentorCalendar } from "@/app/mentor/calendar-data";
import { MENTOR_SECTIONS, loadTraining } from "@/app/mentor/parts";
import { trainingDates } from "@/lib/mentors";
import { AccountFacts, ViewBanner, ViewToggle, requireAdminPage } from "../../parts";

export const metadata: Metadata = { title: "Mentor view · GGG.Cafe" };

const STATUS: Record<string, string> = { approved: "Approved", pending: "Waiting", declined: "Declined" };

/**
 * Admins: a mentor's home as the mentor sees it, read only (user, 2026-11-12), drawn like the mentor
 * menu (user, 2026-11-14: "Mentor View, to see what their pages look like"): the header, their requests,
 * Coming up and the numbered boards, with the account and troubleshooting facts under it. `?team=` comes
 * from the Dugout's Mentors tab: the Coach view toggle goes back there, and the picker lists that team's mentors.
 */
export default async function ViewAsMentorPage({ params, searchParams }: PageProps<"/view-as/mentor/[userId]">) {
  await requireAdminPage();
  const { userId } = await params;
  const { team: teamParam } = await searchParams;
  if (!isUuid(userId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_view_mentor", { p_user: userId });
  if (error || !data) notFound();
  const v = data as MentorView;
  const name = v.mentor?.display_name ?? v.account.display_name ?? v.account.email ?? "This mentor";
  const playerName = (id: string) => v.players.find((p) => p.id === id)?.name ?? "A player she can't see";
  const approved = v.links.filter((l) => l.status === "approved");
  const waiting = v.links.filter((l) => l.status !== "approved");
  const teams = [...new Map(approved.flatMap((l) => (l.team_id ? [[l.team_id, { id: l.team_id, name: l.team_name ?? "Team" }] as const] : []))).values()];
  const pickerTeam = (typeof teamParam === "string" && isUuid(teamParam) ? teamParam : null) ?? teams[0]?.id ?? null;
  const today = todayISO();

  // the next two weeks of their calendar: their training and video calls, and their players' team schedule
  const [calendar, teamItems, { data: teamMentors }, training] = await Promise.all([
    loadMentorCalendar(supabase, userId, playerName, today, addDays(today, 13), { teamSchedule: false }),
    loadComingUp(supabase, teams, 20),
    pickerTeam ? supabase.from("mentor_links").select("mentor_id").eq("team_id", pickerTeam).eq("status", "approved") : Promise.resolve({ data: [] }),
    // the training they added, as their own Training board reads it
    loadTraining(supabase, userId),
  ]);
  // the next few sessions, one line per session (a group's comes once), at the next day each lands on
  const sessions = [...new Map(training.map((r) => [[r.title, r.starts_on, r.ends_on, r.days.join(",")].join("|"), r])).values()].slice(0, 3);
  const upcoming = comingUp([...asComingUp(calendar), ...teamItems], 8);
  const mentorIds = [...new Set((teamMentors ?? []).map((m) => m.mentor_id))];
  const { data: mentorNames } = mentorIds.length
    ? await supabase.from("mentors").select("user_id, display_name").in("user_id", mentorIds).order("display_name")
    : { data: [] };
  const [nameFirst, ...nameRest] = name.split(" ");
  const total = v.players.length;
  const byTeam = [...new Set(v.players.map((p) => p.team ?? "Team"))];
  const note = "text-sm text-[var(--menu-note)]";
  const sectionLink = "text-sm font-semibold text-link";
  const coachHref = pickerTeam ? `/dugout/mentors?team=${pickerTeam}` : "/view-as";

  return (
    <div className="flex flex-col gap-8">
      <ViewToggle kind="mentor" current="view" coachHref={coachHref} viewHref={`/view-as/mentor/${userId}${pickerTeam ? `?team=${pickerTeam}` : ""}`} />
      {(mentorNames ?? []).length > 1 && (
        <PillNav
          label="Choose a mentor"
          size="sm"
          current={userId}
          items={(mentorNames ?? []).map((m) => ({ key: m.user_id, label: m.display_name, href: `/view-as/mentor/${m.user_id}?team=${pickerTeam}` }))}
        />
      )}
      <ViewBanner who={name} role="mentor" />

      {/* their mentor menu, as they see it, links left out */}
      <section aria-label={`${name}'s mentor page`} className="flex flex-col gap-10 rounded-2xl border-2 border-navy-700 p-4 sm:p-6">
        {!v.mentor ? (
          <EmptyState title="Ask to work with a player or a team">
            No mentor profile yet: they haven&apos;t sent a request with a team code, so their home shows only the request form.
          </EmptyState>
        ) : (
          <>
            <MenuHeader
              eyebrow="Mentor menu"
              first={nameFirst}
              last={nameRest.join(" ") || undefined}
              line={`${v.mentor.specialty ?? "Mentor"} · ${total} player${total === 1 ? "" : "s"}${teams.length ? ` · ${teams.map((t) => t.name).join(" · ")}` : ""}`}
            />
            {waiting.length > 0 && (
              <section aria-label="Their requests" className="rounded-2xl border-2 border-pink bg-pink/5 p-4 sm:p-5">
                <h2 className="mb-3 flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
                  <span className="grid size-6 place-items-center rounded-full bg-pink font-display text-sm text-on-accent tabular-nums">{waiting.length}</span>
                  Your requests
                </h2>
                <ul className="divide-y divide-navy-700">
                  {waiting.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                      <span className="font-semibold">{l.player_id ? l.player_name : `${l.team_name}: the whole team`}</span>
                      <Badge tone={l.status === "pending" ? "pink" : "neutral"}>
                        {l.status === "pending" ? (l.player_id ? "Waiting for her parents" : "Waiting for the head coach") : "Not approved"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {total > 0 && <ComingUpCard items={upcoming} calendarHref={`/dugout/calendar?team=${teams[0]?.id ?? ""}`} subtitle="The next two weeks" />}
            {total > 0 && (
              <section aria-label="Mentor menu" className="grid gap-8 md:grid-cols-2">
                <MenuPanel number={1} title="My Roster" subtitle={`${total} player${total === 1 ? "" : "s"} · goals, Pop Report, Mental GP`} variant="outlineNeon" wide>
                  <div className="flex flex-col gap-6">
                    {byTeam.map((team) => (
                      <div key={team}>
                        {byTeam.length > 1 && <h3 className="mb-3 font-display text-xl font-bold tracking-wide uppercase">{team}</h3>}
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {v.players
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
                                    <span key={x.hash} className={sectionLink}>
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
                <MenuPanel number={2} title="Training on Their Weeks" subtitle="In their This Week in Softball" variant="pink" cta={{ label: "Add & manage" }}>
                  {sessions.length === 0 ? (
                    <p className={note}>Nothing coming up. Add a lesson, a bullpen or a hitting session to their weeks.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {sessions.map((r) => {
                        const next = trainingDates(r, today, addDays(today, 366))[0] ?? r.starts_on;
                        const weekly = r.ends_on && r.ends_on !== r.starts_on;
                        return (
                          <MenuItem
                            key={r.id}
                            name={r.title}
                            value={formatDay(next).replace(/^\w+, /, "")}
                            note={[weekly && `Weekly through ${formatDay(r.ends_on!)}`, playerName(r.player_id)].filter(Boolean).join(" · ")}
                          />
                        );
                      })}
                    </div>
                  )}
                </MenuPanel>
                <MenuPanel number={3} title="Messages You Sent" subtitle="Seen when she opens them" variant="navy">
                  {v.messages.length === 0 ? (
                    <p className={note}>Nothing sent yet.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {v.messages.slice(0, 5).map((m, i) => (
                        <MenuItem
                          key={i}
                          name={playerName(m.player_id)}
                          value={m.read_at ? "Seen" : "New"}
                          note={[m.body, m.drill_name && `Drill: ${m.drill_name}`, m.has_photo && "Photo", m.shared_with_coaches && "shared with coaches"].filter(Boolean).join(" · ")}
                        />
                      ))}
                    </div>
                  )}
                </MenuPanel>
                <MenuPanel number={4} title="Work With More Players" subtitle="A player or a whole team" variant="outlinePink" wide>
                  <p className={note}>Ask with the team code. Her parents approve you for one player; the head coach approves you for the whole team.</p>
                </MenuPanel>
              </section>
            )}
            {total === 0 && <EmptyState>Once they&apos;re approved, their players show up here.</EmptyState>}
          </>
        )}
      </section>

      {/* what they can't see themselves: for troubleshooting */}
      <section aria-labelledby="behind" className="flex flex-col gap-6">
        <h2 id="behind" className="font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
          Behind the page · admins only
        </h2>
        <AccountFacts account={v.account} />
        <p className="text-sm">
          {v.mentor ? (
            <>
              Mentor profile: <span className="font-semibold">{v.mentor.specialty ?? "Mentor"}</span> · {v.players.length} player
              {v.players.length === 1 ? "" : "s"} they can see · {v.notes} note{v.notes === 1 ? "" : "s"} with coaches · {v.focus} focus area
              {v.focus === 1 ? "" : "s"}
            </>
          ) : (
            <span className="text-muted">No mentor profile yet.</span>
          )}
        </p>

        <Card title={`Requests (${v.links.length})`}>
          {v.links.length === 0 ? (
            <EmptyState>No requests.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-800">
              {v.links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {l.player_id ? `${l.player_name ?? "A player"} (one player)` : "The whole team"} · {l.team_name ?? "a team"}
                    <span className="text-muted"> · asked {formatDay(l.requested_at.slice(0, 10))}</span>
                  </span>
                  <Badge tone={l.status === "approved" ? "neon" : l.status === "pending" ? "pink" : "neutral"}>{STATUS[l.status] ?? l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Players they can see (${v.players.length})`}>
          {v.players.length === 0 ? (
            <EmptyState>None. Until a parent or a head coach approves a request, a mentor sees no players.</EmptyState>
          ) : (
            <TableScroll label="Players they can see">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>#</th>
                    <th className={thClass}>Player</th>
                    <th className={thClass}>Pos</th>
                    <th className={thClass}>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {v.players.map((p) => (
                    <tr key={p.id}>
                      <td className={`${tdClass} font-display tabular-nums`}>{p.jersey ?? "–"}</td>
                      <td className={tdClass}>{p.name}</td>
                      <td className={tdClass}>{p.position ?? "–"}</td>
                      <td className={tdClass}>{p.team ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Card>

        <Card title={`Messages they sent (${v.messages.length}${v.messages.length === 20 ? ", latest" : ""})`}>
          {v.messages.length === 0 ? (
            <EmptyState>No messages yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-800">
              {v.messages.map((m, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="w-24 shrink-0 text-muted">{formatDay(m.created_at.slice(0, 10))}</span>
                  <span className="font-semibold">{playerName(m.player_id)}</span>
                  <span className="min-w-0 flex-1 text-ink/90">{[m.body, m.drill_name && `Drill: ${m.drill_name}`, m.has_photo && "Photo"].filter(Boolean).join(" · ")}</span>
                  <span className="text-xs text-muted">
                    {m.shared_with_coaches ? "Shared with coaches" : "Private"} · {m.read_at ? "Seen" : "Not seen yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
