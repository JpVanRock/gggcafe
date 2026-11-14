import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAdminTeamIds } from "@/lib/auth";
import type { BudgetSummaryData } from "@/components/budget-summary";
import { Card, secondaryButtonClass } from "@/components/ui";
import { MenuHeader, MenuItem, MenuPanel, NeedsYou, type BoardVariant, type NeedsItem } from "@/components/menu-board";
import { MyTeamLogo } from "@/components/team-logo";
import { isStaffParent } from "@/components/role-switch";
import { VIDEO_CALL_COLUMNS, VideoCallList, type VideoCallRow } from "@/components/video-calls";
import { yearbookTeams } from "@/lib/yearbook-data";
import { medicalOnFile } from "@/lib/family";
import { consentStep } from "@/lib/consent";
import { comingSinceISO, isComing } from "@/lib/video-calls";
import { formatDay } from "@/lib/dates";
import { money, toCents } from "@/lib/budget";
import { GOAL_METHOD_LABEL } from "@/lib/softball";
import { hasCulture } from "@/components/team-standards";
import { JoinForm } from "./join-form";
import { loadFamilyMentors } from "./mentors";
import { firstOf, loadFamily } from "./family-data";
import { loadComingUp, loadDaughterGoals, loadTeamCulture } from "./team-data";
import { GoalsBoardSummary, hasTeamCulture } from "./team-sections";
import { ComingUpCard } from "@/components/coming-up";
import { FamilyShell } from "./shell";
import { PageMenu, type PageMenuItem } from "@/components/page-menu";

export const metadata: Metadata = { title: "Family · GGG.Cafe" };

// The family menu (user, 2026-11-13: cleaner and organized like the player dashboard's menu): the
// media-day header, the Yearbook at the top, "Needs you" (what's waiting on the parent, with where to do
// it), video calls, Coming up, then numbered menu boards, each with a short summary and its own page
// (Team Standards & Culture, Team Budget, Mentors, Welcome packet). Season forms and Logins & teams are in
// the page's hamburger menu, top left (user, 2026-11-13).
export default function FamilyPage({ searchParams }: PageProps<"/family">) {
  return (
    <FamilyShell>
      <Family searchParams={searchParams} />
    </FamilyShell>
  );
}

type Board = { key: string; title: string; subtitle?: string; variant: BoardVariant; wide?: boolean; cta?: { href: string; label: string } | null; body: React.ReactNode };

const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

async function Family({ searchParams }: Pick<PageProps<"/family">, "searchParams">) {
  const { code } = await searchParams;
  const { user, supabase, links, daughters, teams, offOn, offForDaughter, teamsOf, teamsWith } = await loadFamily();

  const calendarTeams = teamsWith("parent.calendar");
  // her goals: off when her team turned them off for parents, or turned Goals off for players
  const goalDaughters = daughters.filter((d) => d.on_roster && !offForDaughter(d, "parent.goals") && !offForDaughter(d, "player.goals"));
  const [
    { data: account },
    { data: claims },
    { data: consentRows },
    forms,
    { data: packetRows },
    { data: readRows },
    familyMentors,
    adminTeamIds,
    comingUpItems,
    teamCulture,
    daughterGoals,
    budgets,
    yearbooks,
    { data: callRows },
  ] = await Promise.all([
    supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.auth.getClaims(),
    supabase.rpc("parent_consent_status"),
    Promise.all(
      daughters.map(async (d) => ({
        id: d.player_id,
        questionnaire: Boolean((await supabase.rpc("parent_questionnaire", { p_player_id: d.player_id })).data),
        medical: medicalOnFile(((await supabase.rpc("parent_medical_card", { p_player_id: d.player_id })).data ?? null) as Record<string, string | null> | null),
      })),
    ),
    supabase.from("parent_packet_items").select("id, team_id, title, position").order("position"),
    supabase.from("parent_packet_reads").select("item_id").eq("parent_id", user.id),
    loadFamilyMentors(supabase),
    getAdminTeamIds(),
    loadComingUp(supabase, calendarTeams),
    loadTeamCulture(supabase, teamsWith("parent.team")),
    Promise.all(goalDaughters.map(async (d) => ({ daughter: d, goals: await loadDaughterGoals(supabase, d.player_id, teamsOf(d)) }))),
    Promise.all(
      teamsWith("parent.budget").map(async (team) => ({
        team,
        summary: (await supabase.rpc("team_budget_summary", { p_team_id: team.id })).data as BudgetSummaryData | null,
      })),
    ),
    yearbookTeams(supabase, teamsWith("parent.yearbook").map((t) => t.id)),
    // video calls booked with their daughters (user, 2026-11-12): parents are invited to every one
    daughters.length
      ? supabase
          .from("video_calls")
          .select(VIDEO_CALL_COLUMNS)
          .in("player_id", daughters.map((d) => d.player_id))
          .is("cancelled_at", null)
          .gte("starts_at", comingSinceISO())
          .order("starts_at")
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const meta = (claims?.claims?.user_metadata ?? {}) as { display_name?: string; team_code?: string; child?: string };
  const metaName = (meta.display_name ?? "").trim();
  // their name (a coach who is also a parent here may have no parent profile name)
  const fullName = (account?.display_name || metaName || user.staff?.displayName || "").trim();
  const [nameFirst, ...nameRest] = fullName.split(" ");
  const consents = new Map((consentRows ?? []).map((c) => [c.player_id, c]));
  const formOf = (id: string) => forms.find((f) => f.id === id);
  const readIds = new Set((readRows ?? []).map((r) => r.item_id));
  const packet = (packetRows ?? []).filter((i) => !offOn(i.team_id, "parent.packet"));
  const unread = packet.filter((i) => !readIds.has(i.id));
  const calls = ((callRows ?? []) as VideoCallRow[]).filter((c) => isComing(c));
  const adminTeams = teams.filter((t) => adminTeamIds.includes(t.id));
  const mentorName = (id: string) => familyMentors.mentors.find((m) => m.user_id === id)?.display_name ?? "A mentor";
  const mentorsOf = (playerId: string, teamIds: string[]) => ({
    pending: familyMentors.links.filter((l) => l.player_id === playerId && l.status === "pending"),
    approved: familyMentors.links.filter(
      (l) => l.status === "approved" && (l.player_id === playerId || (!l.player_id && l.team_id !== null && teamIds.includes(l.team_id))),
    ),
  });

  // what's waiting on the parent, each with where to do it
  const needs: NeedsItem[] = daughters.flatMap((d) => {
    const first = firstOf(d.player_name);
    const f = formOf(d.player_id);
    const step = consentStep(consents.get(d.player_id));
    const items: NeedsItem[] = [];
    if (d.on_roster && !d.username && !d.has_account && step === "needed") {
      items.push({ key: `consent-${d.player_id}`, text: `${first} is under 13: her login needs your consent first.`, href: `/family/logins#login-${d.player_id}`, action: "Start" });
    }
    if (f && !f.medical) items.push({ key: `medical-${d.player_id}`, text: `Add ${possessive(first)} medical & emergency card.`, href: `/family/forms#forms-${d.player_id}`, action: "Add" });
    if (f && !f.questionnaire && !offForDaughter(d, "parent.questionnaire")) {
      items.push({ key: `questionnaire-${d.player_id}`, text: `Fill in ${possessive(first)} preseason questionnaire.`, href: `/family/forms#forms-${d.player_id}`, action: "Fill in" });
    }
    for (const l of mentorsOf(d.player_id, []).pending) {
      items.push({ key: `mentor-${l.id}`, text: `${mentorName(l.mentor_id)} asks to mentor ${first}.`, href: `/family/mentors?player=${d.player_id}`, action: "Review" });
    }
    return items;
  });
  if (unread.length) {
    needs.push({
      key: "packet",
      text: `${unread.length} welcome packet ${unread.length === 1 ? "item" : "items"} to read.`,
      href: "/family/packet",
      action: "Read",
    });
  }

  // the menu boards, in order
  const boards: Board[] = [
    ...daughterGoals.map(({ daughter: d, goals }) => ({
      key: `goals-${d.player_id}`,
      title: `${possessive(firstOf(d.player_name))} Goals`,
      subtitle: GOAL_METHOD_LABEL[goals.method],
      variant: "neon" as const,
      wide: true,
      cta: offForDaughter(d, "parent.view_as") ? null : { href: `/players/${d.player_id}/goals`, label: "All her goals" },
      body: <GoalsBoardSummary first={firstOf(d.player_name)} goals={goals} />,
    })),
  ];
  if (teamsWith("parent.team").length) {
    const posted = teamCulture.filter(hasTeamCulture);
    const lead = posted[0];
    boards.push({
      key: "team",
      title: "Team Standards & Culture",
      subtitle: posted.length > 1 ? posted.map((t) => t.team.name).join(" · ") : lead?.team.name,
      variant: "navy",
      cta: posted.length ? { href: "/family/team", label: "Full details" } : null,
      body: lead ? (
        <div className="flex flex-col gap-4">
          {hasCulture(lead.culture) && (lead.culture.headline || lead.culture.motto) && (
            <p className="text-xl leading-snug font-semibold">“{lead.culture.headline || lead.culture.motto}”</p>
          )}
          {lead.standards.slice(0, 4).map((s, i) => (
            <MenuItem key={s.title} name={s.title} value={String(i + 1).padStart(2, "0")} note={s.detail ?? undefined} />
          ))}
          {lead.standards.length > 4 && <p className="text-sm text-[var(--menu-note)]">+ {lead.standards.length - 4} more</p>}
        </div>
      ) : (
        <p className="text-sm text-[var(--menu-note)]">Your team&apos;s coaches haven&apos;t posted them yet.</p>
      ),
    });
  }
  if (budgets.length) {
    boards.push({
      key: "budget",
      title: "Team Budget",
      subtitle: "View only · team totals",
      variant: "pink",
      cta: { href: "/family/budget", label: "Full details" },
      body: (
        <div className="flex flex-col gap-4">
          {budgets.map(({ team, summary }) =>
            summary ? (
              <div key={team.id} className="flex flex-col gap-4">
                {budgets.length > 1 && <p className="font-mono text-xs font-bold tracking-[0.2em] uppercase">{team.name}</p>}
                <MenuItem
                  name="Balance"
                  value={money(toCents(summary.collected) + toCents(summary.other_income) - toCents(summary.expenses))}
                  note={summary.updated_at ? `${summary.season} · updated ${formatDay(summary.updated_at.slice(0, 10))}` : summary.season}
                />
                <MenuItem
                  name="Registration collected"
                  value={summary.expected ? `${Math.round((summary.collected / summary.expected) * 100)}%` : money(toCents(summary.collected))}
                  note={summary.expected ? `${money(toCents(summary.collected))} of ${money(toCents(summary.expected))}` : undefined}
                />
              </div>
            ) : (
              <p key={team.id} className="text-sm text-[var(--menu-note)]">
                {team.name}: the budget isn&apos;t set up yet.
              </p>
            ),
          )}
        </div>
      ),
    });
  }
  if (daughters.length) {
    boards.push({
      key: "mentors",
      title: "Mentors",
      subtitle: "Who works with her",
      variant: "outlinePink",
      cta: { href: "/family/mentors", label: "Messages, notes & requests" },
      body: (
        <div className="flex flex-col gap-4">
          {daughters.map((d) => {
            const m = mentorsOf(
              d.player_id,
              teamsOf(d).map((t) => t.id),
            );
            return (
              <MenuItem
                key={d.player_id}
                name={`${possessive(firstOf(d.player_name))} mentors`}
                value={m.approved.length}
                note={
                  [m.approved.map((l) => mentorName(l.mentor_id)).join(", ") || "None yet", m.pending.length && `${m.pending.length} asking`]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              />
            );
          })}
        </div>
      ),
    });
  }
  if (packet.length) {
    boards.push({
      key: "packet",
      title: "Welcome Packet",
      subtitle: "Letter · policies · tips",
      variant: "navy",
      cta: { href: "/family/packet", label: unread.length ? "Read it" : "Open it" },
      body: (
        <MenuItem
          name="Read"
          value={`${packet.length - unread.length}/${packet.length}`}
          note={unread.length ? `Next: ${unread[0].title}` : "All read. Thanks!"}
        />
      ),
    });
  }
  if (adminTeams.length) {
    boards.push({
      key: "admin",
      title: "Team Admin",
      subtitle: adminTeams.map((t) => t.name).join(" · "),
      variant: "outlinePink",
      body: (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--menu-note)]">Your head coach made you a team admin: the calendar, GameDay and players&apos; measurements.</p>
          {adminTeams.map((t) => (
            <p key={t.id} className="flex flex-wrap gap-x-5 gap-y-2">
              {adminTeams.length > 1 && <span className="font-semibold">{t.name}</span>}
              {(
                [
                  ["/dugout/calendar", "Calendar"],
                  ["/dugout/gameday", "GameDay"],
                  ["/dugout/measurements", "Measurements"],
                ] as const
              ).map(([href, label]) => (
                <Link key={href} href={`${href}?team=${t.id}`} className="font-mono text-xs tracking-widest text-pink-soft uppercase hover:underline">
                  {label} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </p>
          ))}
        </div>
      ),
    });
  }

  // a board left alone in its row stretches across the page (user, 2026-11-13: the Mentors board on its own).
  // The wide ones (her goals) come first, so the half-width ones pair up after them.
  const halves = boards.filter((b) => !b.wide);
  if (halves.length % 2 === 1) halves[halves.length - 1].wide = true;

  // the page's hamburger menu (user, 2026-11-13): Season forms and Logins & teams, with a badge when they need the parent
  const formsToDo = daughters.filter((d) => {
    const f = formOf(d.player_id);
    return f && (!f.medical || (!f.questionnaire && !offForDaughter(d, "parent.questionnaire")));
  }).length;
  const consentNeeded = daughters.some((d) => d.on_roster && !d.username && !d.has_account && consentStep(consents.get(d.player_id)) === "needed");
  const menuItems: PageMenuItem[] = [
    ...(daughters.length
      ? [{ href: "/family/forms", label: "Season Forms", note: "Preseason questionnaire · medical & emergency card", badge: formsToDo ? `${formsToDo} to do` : null }]
      : []),
    { href: "/family/logins", label: "Logins & Teams", note: "Her login and consent · your teams · join a team", badge: consentNeeded ? "Consent" : null },
  ];
  const waiting = links.filter((l) => l.status !== "approved");
  return (
    <div className="flex flex-col gap-10">
      <MenuHeader
        eyebrow="Family menu"
        first={nameFirst || "Welcome"}
        last={nameRest.join(" ") || undefined}
        line={[teams.map((t) => t.name).join(" · "), user.email].filter(Boolean).join(" · ")}
        start={links.length > 0 && <PageMenu items={menuItems} />}
        aside={
          <Suspense fallback={null}>
            <MyTeamLogo />
          </Suspense>
        }
        actions={
          // a coach who is a parent here has the Coach / Parent switch under the menu instead
          user.staff &&
          !(await isStaffParent()) && (
            <Link href="/dashboard" className={secondaryButtonClass}>
              Coach dashboard →
            </Link>
          )
        }
      />

      {code === "invalid" && (
        <p role="alert" className="rounded-lg border border-pink/60 bg-pink/10 p-4 text-sm">
          Your account is set up, but that team code didn&apos;t match a team. Check it with your coach and enter it below.
        </p>
      )}

      {/* the Yearbook first (user, 2026-11-13) */}
      {yearbooks.length > 0 && (
        <Link
          href="/family/yearbook"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-neon bg-linear-to-r from-neon/10 to-pink/10 p-5 transition hover:from-neon/15 sm:p-6"
        >
          <span>
            <span className="block font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">
              {teams.filter((t) => yearbooks.includes(t.id)).map((t) => t.name).join(" · ")}
            </span>
            <span className="block font-display text-4xl font-black tracking-tight text-highlight uppercase italic sm:text-5xl">Yearbook</span>
            <span className="block text-sm text-muted">The season in photos. Add yours and tag the players in them.</span>
          </span>
          <span className="font-mono text-xs tracking-wider text-ink uppercase">Open →</span>
        </Link>
      )}

      <NeedsYou items={needs} />

      {calls.length > 0 && (
        <Card title="Video calls">
          <p className="text-sm text-muted">
            You&apos;re invited to every call a mentor or head coach books with your daughter. Join from the call page; it opens 10 minutes before the start.
          </p>
          <VideoCallList calls={calls} showPlayer />
        </Card>
      )}

      {calendarTeams.length > 0 && <ComingUpCard items={comingUpItems} teams={calendarTeams} calendarHref="/family/calendar" />}

      {links.length === 0 ? (
        <Card title="Join your daughter's team">
          <p className="mb-4 text-sm text-muted">Enter the team code from your coach. Your coach approves you, then your family menu fills in here.</p>
          <JoinForm askName={!account} defaultName={metaName} defaultCode={meta.team_code} defaultChild={meta.child} />
        </Card>
      ) : (
        <>
          {waiting.length > 0 && teams.length === 0 && (
            <Card title="Your teams">
              <ul className="flex flex-col gap-1 text-sm">
                {waiting.map((l) => (
                  <li key={l.link_id}>
                    <span className="font-semibold">{l.team_name}</span> · parent of {l.player_name ?? l.child_name}:{" "}
                    {l.status === "pending" ? "waiting for your coach to approve you" : "not approved; check the team code and name with your coach"}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {boards.length > 0 && (
            <section aria-label="Family menu" className="grid gap-8 md:grid-cols-2">
              {boards.map((b, i) => (
                <MenuPanel key={b.key} number={i + 1} title={b.title} subtitle={b.subtitle} variant={b.variant} wide={b.wide} cta={b.cta}>
                  {b.body}
                </MenuPanel>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
