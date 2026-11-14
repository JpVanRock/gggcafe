import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess, getPlayerFeaturesOff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Badge, Card, Disclosure, EmptyState, PageHeader, buttonStyles } from "@/components/ui";
import { MenuHeader, MenuItem, MenuPanel } from "@/components/menu-board";
import { ComingUpCard } from "@/components/coming-up";
import { comingUp } from "@/lib/family";
import { trainingDates } from "@/lib/mentors";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import { playerName } from "@/lib/softball";
import { RequestForm } from "./mentor-client";
import { asComingUp, loadMentorCalendar } from "./calendar-data";
import { withdrawMentorLink } from "./actions";
import { PlayerTiles, loadMentees, loadTraining, oneOnOne } from "./parts";

export const metadata: Metadata = { title: "My players · Mentor · GGG.Cafe" };

type MyLink = { id: string; team_id: string | null; team_name: string | null; player_id: string | null; player_name: string | null; status: "pending" | "approved" | "declined"; requested_at: string };

export default async function MentorHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const [mentor, access, { data: linkRows }, { data: claims }] = await Promise.all([
    getMentor(),
    getMentorAccess(),
    supabase.rpc("my_mentor_links"),
    supabase.auth.getClaims(),
  ]);
  const links = (linkRows ?? []) as MyLink[];
  // what she typed on the sign-up page fills in the request form
  const meta = (claims?.claims?.user_metadata ?? {}) as { display_name?: string; team_code?: string; mentor_player?: string };
  const defaults = { code: meta.team_code, scope: meta.team_code && !meta.mentor_player ? ("team" as const) : ("player" as const), player: meta.mentor_player };

  if (!mentor && links.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={meta.display_name ? `Welcome, ${meta.display_name.split(" ")[0]}` : "Welcome, mentor"} description="GGG.Cafe mentor" />
        {user.staff ? (
          <p className="max-w-2xl rounded-2xl border border-pink/50 bg-pink/5 p-5">
            This is the mentor area. Mentors ask with a team code here; a player&apos;s parents approve a mentor for her, and a head coach approves one for the
            whole team (Coaches Dugout → Mentors).
          </p>
        ) : (
          <Card title="Ask to work with a player or a team">
            <p className="mb-4 max-w-2xl text-sm text-muted">
              Enter the team code. For one player, her parents approve you; for the whole team, the head coach does. You see the players you&apos;re approved for once
              they say yes.
            </p>
            <RequestForm defaults={defaults} />
          </Card>
        )}
      </div>
    );
  }

  const today = todayISO();
  const [cards, training, { data: teamRows }, { data: sent }] = await Promise.all([
    loadMentees(supabase, access.menteeIds),
    mentor ? loadTraining(supabase, mentor.userId) : Promise.resolve([]),
    access.teamIds.length ? supabase.from("teams").select("id, name").in("id", access.teamIds).order("name") : Promise.resolve({ data: [] }),
    mentor
      ? supabase
          .from("mentor_messages")
          .select("id, player_id, body, photo_path, drill_name, created_at, read_at, shared_with_coaches")
          .eq("sender_id", mentor.userId)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);
  const teams = (teamRows ?? []) as { id: string; name: string }[];
  const nameOf = (id: string) => {
    const c = cards.get(id);
    return c ? playerName(c.player) : "A player";
  };
  const individual = oneOnOne(access, cards);
  const waiting = links.filter((l) => l.status !== "approved");
  const total = access.menteeIds.length;
  const [off, calendar] = await Promise.all([
    // what each player's head coach turned off for mentors (the roster's Goals / Pop Report / Mental GP links)
    Promise.all(access.menteeIds.map(async (id) => [id, await getPlayerFeaturesOff(id)] as const)).then((rows) => new Map(rows)),
    // the next two weeks of her calendar: her training, her video calls, her players' team schedule
    mentor ? loadMentorCalendar(supabase, mentor.userId, nameOf, today, addDays(today, 13)) : Promise.resolve({ events: [], games: [] }),
  ]);
  const upcoming = comingUp(asComingUp(calendar), 8);
  // the next few training sessions, one line per session (a group's comes once)
  const sessions = [...new Map(training.map((r) => [[r.title, r.starts_on, r.ends_on, r.days.join(",")].join("|"), r])).values()].slice(0, 3);
  const [nameFirst, ...nameRest] = (mentor?.displayName ?? meta.display_name ?? "Mentor").split(" ");
  const menuNote = "text-sm text-[var(--menu-note)]";

  return (
    <div className="flex flex-col gap-10">
      <MenuHeader
        eyebrow="Mentor menu"
        first={nameFirst}
        last={nameRest.join(" ") || undefined}
        line={`${mentor?.specialty ?? "Mentor"} · ${total} player${total === 1 ? "" : "s"}${teams.length ? ` · ${teams.map((t) => t.name).join(" · ")}` : ""}`}
      />

      {waiting.length > 0 && (
        <section aria-label="Your requests" className="rounded-2xl border-2 border-pink bg-pink/5 p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
            <span className="grid size-6 place-items-center rounded-full bg-pink font-display text-sm text-on-accent tabular-nums">{waiting.length}</span>
            Your requests
          </h2>
          <ul className="divide-y divide-navy-700">
            {waiting.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="font-semibold">{l.player_id ? l.player_name : `${l.team_name}: the whole team`}</span>
                {l.player_id && l.team_name && <span className="text-muted">{l.team_name}</span>}
                <Badge tone={l.status === "pending" ? "pink" : "neutral"}>
                  {l.status === "pending" ? (l.player_id ? "Waiting for her parents" : "Waiting for the head coach") : "Not approved"}
                </Badge>
                <span className="font-mono text-2xs tracking-wider text-muted uppercase">Asked {formatDay(l.requested_at.slice(0, 10))}</span>
                <ActionForm action={withdrawMentorLink} className="ml-auto flex items-center gap-2">
                  <input type="hidden" name="link_id" value={l.id} />
                  <ConfirmSubmit message="Withdraw this request?" confirmLabel="Withdraw" className={buttonStyles("link", "text-muted")}>
                    {l.status === "pending" ? "Withdraw" : "Clear"}
                  </ConfirmSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      {total === 0 && waiting.length > 0 && <EmptyState>Once you&apos;re approved, your players show up here.</EmptyState>}

      {total > 0 && (
        <ComingUpCard
          items={upcoming}
          calendarHref="/mentor/calendar"
          subtitle="The next two weeks"
          empty="Nothing on your calendar in the next two weeks: no training, calls or team games."
        />
      )}

      {total > 0 && (
        <section aria-label="Mentor menu" className="grid gap-8 md:grid-cols-2">
          {/* every player she mentors, by team, then her one-on-one players (user, 2026-11-13) */}
          <MenuPanel number={1} title="My Roster" subtitle={`${total} player${total === 1 ? "" : "s"} · goals, Pop Report, Mental GP`} variant="outlineNeon" wide>
            <div className="flex flex-col gap-6">
              {teams.map((t) => {
                const roster = access.rosters.find((r) => r.teamId === t.id)?.players ?? [];
                return (
                  <div key={t.id}>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="font-display text-xl font-bold tracking-wide uppercase">
                        {t.name} <span className="font-mono text-xs tracking-wider text-muted normal-case">· whole team · {roster.length} players</span>
                      </h3>
                      <Link href={`/mentor/teams/${t.id}`} className="font-mono text-xs tracking-widest text-highlight uppercase hover:underline">
                        Team focus &amp; notes <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                    {roster.length === 0 ? (
                      <p className="text-sm text-muted">No one on the roster yet.</p>
                    ) : (
                      <PlayerTiles cards={roster.flatMap((p) => (cards.has(p.id) ? [cards.get(p.id)!] : []))} off={off} />
                    )}
                  </div>
                );
              })}
              {individual.length > 0 && (
                <div>
                  {teams.length > 0 && <h3 className="mb-3 font-display text-xl font-bold tracking-wide uppercase">One-on-one</h3>}
                  <PlayerTiles cards={individual.map((id) => cards.get(id)!)} off={off} />
                </div>
              )}
            </div>
          </MenuPanel>

          <MenuPanel number={2} title="Training on Their Weeks" subtitle="In their This Week in Softball" variant="pink" cta={{ href: "/mentor/training", label: "Add & manage" }}>
            {sessions.length === 0 ? (
              <p className={menuNote}>Nothing coming up. Add a lesson, a bullpen or a hitting session to their weeks.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.map((r) => {
                  // the next day it lands on (a weekly session's first day may be past)
                  const next = trainingDates(r, today, addDays(today, 366))[0] ?? r.starts_on;
                  const weekly = r.ends_on && r.ends_on !== r.starts_on;
                  return (
                    <MenuItem
                      key={r.id}
                      name={r.title}
                      value={formatDay(next).replace(/^\w+, /, "")}
                      note={[weekly && `Weekly through ${formatDay(r.ends_on!)}`, nameOf(r.player_id)].filter(Boolean).join(" · ")}
                    />
                  );
                })}
              </div>
            )}
          </MenuPanel>

          <MenuPanel number={3} title="Messages You Sent" subtitle="Seen when she opens them" variant="navy">
            {(sent ?? []).length === 0 ? (
              <p className={menuNote}>Nothing sent yet. Open a player on your roster to message her a note, a photo or a drill.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {((sent ?? []) as { id: string; player_id: string; body: string | null; photo_path: string | null; drill_name: string | null; created_at: string; read_at: string | null; shared_with_coaches: boolean }[]).map((m) => (
                  <MenuItem
                    key={m.id}
                    name={nameOf(m.player_id)}
                    value={m.read_at ? "Seen" : "New"}
                    note={[m.body, m.drill_name && `Drill: ${m.drill_name}`, m.photo_path && "Photo", m.shared_with_coaches && "shared with coaches"].filter(Boolean).join(" · ")}
                  />
                ))}
              </div>
            )}
          </MenuPanel>

          {/* the last of three half-width boards: across the page, not alone in a half row (user, 2026-11-13) */}
          <MenuPanel number={4} title="Work With More Players" subtitle="A player or a whole team" variant="outlinePink" wide>
            <p className={`mb-4 ${menuNote}`}>Ask with the team code. Her parents approve you for one player; the head coach approves you for the whole team.</p>
            <Disclosure summary="Ask to work with another player or team">
              <RequestForm />
            </Disclosure>
          </MenuPanel>
        </section>
      )}

      {total === 0 && (
        <Disclosure summary="Ask to work with another player or team">
          <RequestForm />
        </Disclosure>
      )}
    </div>
  );
}
