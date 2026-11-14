// The family menu's content (user, 2026-11-13): what's waiting on the parent ("Needs you"), the page's
// hamburger menu and the numbered boards, built from plain data. The family page feeds it the parent's
// own data; an admin's Parent View (/view-as/parent/[id], user 2026-11-14) feeds it what
// admin_view_parent() returns, so the preview is built by the same code as the real page. In a preview
// (`preview: true`) nothing links to the admin's own family pages: the labels show, without links.
import Link from "next/link";
import type { ReactNode } from "react";
import type { BudgetSummaryData } from "@/components/budget-summary";
import { MenuItem, MenuPanel, type BoardVariant, type NeedsItem } from "@/components/menu-board";
import type { PageMenuItem } from "@/components/page-menu";
import { hasCulture } from "@/components/team-standards";
import { money, toCents } from "@/lib/budget";
import type { consentStep } from "@/lib/consent";
import { formatDay } from "@/lib/dates";
import { GOAL_METHOD_LABEL } from "@/lib/softball";
import type { SwitchKey } from "@/lib/switchboard";
import type { DaughterGoals, FamilyTeam, FamilyTeamCulture } from "./team-data";
import { GoalsBoardSummary, hasTeamCulture } from "./team-sections";

export type MenuDaughter = { player_id: string; player_name: string; team_name: string; on_roster: boolean; username: string | null; has_account: boolean };
export type ConsentStep = ReturnType<typeof consentStep>;

export type FamilyMenuInput = {
  daughters: MenuDaughter[];
  /** her parent's approved teams */
  teams: FamilyTeam[];
  /** what each team's head coach turned off (the Switchboard) */
  offOn: (teamId: string, feature: SwitchKey) => boolean;
  forms: { id: string; questionnaire: boolean; medical: boolean }[];
  consentStepOf: (playerId: string) => ConsentStep;
  packet: { id: string; team_id: string; title: string }[];
  readIds: Set<string>;
  mentorLinks: { key: string; mentor_id: string; team_id: string | null; player_id: string | null; status: string }[];
  mentors: { user_id: string; display_name: string }[];
  adminTeamIds: string[];
  teamCulture: FamilyTeamCulture[];
  daughterGoals: { daughter: MenuDaughter; goals: DaughterGoals }[];
  budgets: { team: { id: string; name: string }; summary: BudgetSummaryData | null }[];
};

export type Board = {
  key: string;
  title: string;
  subtitle?: string;
  variant: BoardVariant;
  wide?: boolean;
  cta?: { href?: string; label: string } | null;
  body: ReactNode;
};

const firstOf = (name: string) => name.split(" ")[0];
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

export function familyMenu(input: FamilyMenuInput, { preview = false }: { preview?: boolean } = {}) {
  const { daughters, teams, offOn, readIds, mentors } = input;
  const href = (path: string) => (preview ? undefined : path);
  const teamsOf = (d: MenuDaughter) => teams.filter((t) => t.name === d.team_name);
  const offForDaughter = (d: MenuDaughter, feature: SwitchKey) => teamsOf(d).some((t) => offOn(t.id, feature));
  const teamsWith = (feature: SwitchKey) => teams.filter((t) => !offOn(t.id, feature));
  const formOf = (id: string) => input.forms.find((f) => f.id === id);
  const packet = input.packet.filter((i) => !offOn(i.team_id, "parent.packet"));
  const unread = packet.filter((i) => !readIds.has(i.id));
  const adminTeams = teams.filter((t) => input.adminTeamIds.includes(t.id));
  const mentorName = (id: string) => mentors.find((m) => m.user_id === id)?.display_name ?? "A mentor";
  const mentorsOf = (playerId: string, teamIds: string[]) => ({
    pending: input.mentorLinks.filter((l) => l.player_id === playerId && l.status === "pending"),
    approved: input.mentorLinks.filter(
      (l) => l.status === "approved" && (l.player_id === playerId || (!l.player_id && l.team_id !== null && teamIds.includes(l.team_id))),
    ),
  });
  const consentNeededFor = (d: MenuDaughter) => d.on_roster && !d.username && !d.has_account && input.consentStepOf(d.player_id) === "needed";

  // what's waiting on the parent, each with where to do it
  const needs: NeedsItem[] = daughters.flatMap((d) => {
    const first = firstOf(d.player_name);
    const f = formOf(d.player_id);
    const items: NeedsItem[] = [];
    if (consentNeededFor(d)) {
      items.push({ key: `consent-${d.player_id}`, text: `${first} is under 13: her login needs your consent first.`, href: href(`/family/logins#login-${d.player_id}`), action: "Start" });
    }
    if (f && !f.medical) items.push({ key: `medical-${d.player_id}`, text: `Add ${possessive(first)} medical & emergency card.`, href: href(`/family/forms#forms-${d.player_id}`), action: "Add" });
    if (f && !f.questionnaire && !offForDaughter(d, "parent.questionnaire")) {
      items.push({ key: `questionnaire-${d.player_id}`, text: `Fill in ${possessive(first)} preseason questionnaire.`, href: href(`/family/forms#forms-${d.player_id}`), action: "Fill in" });
    }
    for (const l of mentorsOf(d.player_id, []).pending) {
      items.push({ key: `mentor-${l.key}`, text: `${mentorName(l.mentor_id)} asks to mentor ${first}.`, href: href(`/family/mentors?player=${d.player_id}`), action: "Review" });
    }
    return items;
  });
  if (unread.length) {
    needs.push({ key: "packet", text: `${unread.length} welcome packet ${unread.length === 1 ? "item" : "items"} to read.`, href: href("/family/packet"), action: "Read" });
  }

  // the menu boards, in order
  const boards: Board[] = input.daughterGoals.map(({ daughter: d, goals }) => ({
    key: `goals-${d.player_id}`,
    title: `${possessive(firstOf(d.player_name))} Goals`,
    subtitle: GOAL_METHOD_LABEL[goals.method],
    variant: "neon" as const,
    wide: true,
    cta: offForDaughter(d, "parent.view_as") ? null : { href: href(`/players/${d.player_id}/goals`), label: "All her goals" },
    body: <GoalsBoardSummary first={firstOf(d.player_name)} goals={goals} />,
  }));
  if (teamsWith("parent.team").length) {
    const posted = input.teamCulture.filter(hasTeamCulture);
    const lead = posted[0];
    boards.push({
      key: "team",
      title: "Team Standards & Culture",
      subtitle: posted.length > 1 ? posted.map((t) => t.team.name).join(" · ") : lead?.team.name,
      variant: "navy",
      cta: posted.length ? { href: href("/family/team"), label: "Full details" } : null,
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
  if (input.budgets.length) {
    boards.push({
      key: "budget",
      title: "Team Budget",
      subtitle: "View only · team totals",
      variant: "pink",
      cta: { href: href("/family/budget"), label: "Full details" },
      body: (
        <div className="flex flex-col gap-4">
          {input.budgets.map(({ team, summary }) =>
            summary ? (
              <div key={team.id} className="flex flex-col gap-4">
                {input.budgets.length > 1 && <p className="font-mono text-xs font-bold tracking-[0.2em] uppercase">{team.name}</p>}
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
      cta: { href: href("/family/mentors"), label: "Messages, notes & requests" },
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
      cta: { href: href("/family/packet"), label: unread.length ? "Read it" : "Open it" },
      body: <MenuItem name="Read" value={`${packet.length - unread.length}/${packet.length}`} note={unread.length ? `Next: ${unread[0].title}` : "All read. Thanks!"} />,
    });
  }
  if (adminTeams.length) {
    const linkClass = "font-mono text-xs tracking-widest text-pink-soft uppercase";
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
              ).map(([path, label]) =>
                preview ? (
                  <span key={path} className={linkClass}>
                    {label} <span aria-hidden="true">→</span>
                  </span>
                ) : (
                  <Link key={path} href={`${path}?team=${t.id}`} className={`${linkClass} hover:underline`}>
                    {label} <span aria-hidden="true">→</span>
                  </Link>
                ),
              )}
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
  const menuItems: PageMenuItem[] = [
    ...(daughters.length
      ? [{ href: preview ? "#forms" : "/family/forms", label: "Season Forms", note: "Preseason questionnaire · medical & emergency card", badge: formsToDo ? `${formsToDo} to do` : null }]
      : []),
    {
      href: preview ? "#logins" : "/family/logins",
      label: "Logins & Teams",
      note: "Her login and consent · your teams · join a team",
      badge: daughters.some(consentNeededFor) ? "Consent" : null,
    },
  ];

  return { needs, menuItems, boards };
}

/** The numbered boards, two columns from tablets up. */
export function FamilyBoards({ boards }: { boards: Board[] }) {
  if (boards.length === 0) return null;
  return (
    <section aria-label="Family menu" className="grid gap-8 md:grid-cols-2">
      {boards.map((b, i) => (
        <MenuPanel key={b.key} number={i + 1} title={b.title} subtitle={b.subtitle} variant={b.variant} wide={b.wide} cta={b.cta}>
          {b.body}
        </MenuPanel>
      ))}
    </section>
  );
}

/** The Yearbook, first on the family menu (user, 2026-11-13); a label only in a preview. */
export function YearbookBanner({ teamNames, preview = false }: { teamNames: string[]; preview?: boolean }) {
  const body = (
    <>
      <span>
        <span className="block font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{teamNames.join(" · ")}</span>
        <span className="block font-display text-4xl font-black tracking-tight text-highlight uppercase italic sm:text-5xl">Yearbook</span>
        <span className="block text-sm text-muted">The season in photos. Add yours and tag the players in them.</span>
      </span>
      <span className="font-mono text-xs tracking-wider text-ink uppercase">Open →</span>
    </>
  );
  const cls = "flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-neon bg-linear-to-r from-neon/10 to-pink/10 p-5 sm:p-6";
  return preview ? (
    <div className={cls}>{body}</div>
  ) : (
    <Link href="/family/yearbook" className={`${cls} transition hover:from-neon/15`}>
      {body}
    </Link>
  );
}
