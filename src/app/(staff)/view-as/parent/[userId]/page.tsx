import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { BudgetSummary, CreditsSummary, type BudgetSummaryData } from "@/components/budget-summary";
import { Badge, Card, EmptyState, badgeClass, eyebrowClass } from "@/components/ui";
import { MenuHeader, NeedsYou } from "@/components/menu-board";
import { PageMenu } from "@/components/page-menu";
import { PillNav } from "@/components/pill-nav";
import { TeamLogoMark } from "@/components/team-logo";
import { ComingUpCard } from "@/components/coming-up";
import { PACKET_KIND_LABEL, medicalOnFile, type PacketKind } from "@/lib/family";
import { signedLogoUrl } from "@/lib/team-logos";
import type { SwitchKey } from "@/lib/switchboard";
import { LINK_STATUS, loginStatus, type ParentView } from "@/lib/view-as";
import { FamilyBoards, YearbookBanner, familyMenu, type ConsentStep } from "@/app/family/menu-content";
import { loadComingUp, loadDaughterGoals, loadTeamCulture } from "@/app/family/team-data";
import { AccountFacts, ViewBanner, ViewToggle, requireAdminPage } from "../../parts";

export const metadata: Metadata = { title: "Parent view · GGG.Cafe" };

/**
 * Admins: a parent's family page as the parent sees it, read only (user, 2026-11-12), now drawn by the
 * family page's own menu builder (user, 2026-11-14: "Parent View, to see what their pages look like"),
 * with the account and troubleshooting facts under it. `?team=` comes from the Dugout's Parents tab: the
 * Coach view toggle goes back there, and the picker lists that team's parents.
 */
export default async function ViewAsParentPage({ params, searchParams }: PageProps<"/view-as/parent/[userId]">) {
  await requireAdminPage();
  const { userId } = await params;
  const { team: teamParam } = await searchParams;
  if (!isUuid(userId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_view_parent", { p_user: userId });
  if (error || !data) notFound();
  const v = data as ParentView;
  const name = v.profile?.display_name ?? v.account.display_name ?? v.account.email ?? "This parent";
  const first = (n: string) => n.split(" ")[0];
  const read = new Set(v.packet_read);
  const mentorName = (id: string) => v.mentors.find((m) => m.user_id === id)?.display_name ?? "A mentor";
  const approvedTeams = v.links.filter((l) => l.status === "approved");
  const teams = [...new Map(approvedTeams.map((l) => [l.team_id, { id: l.team_id, name: l.team_name }])).values()];
  const pickerTeam = (typeof teamParam === "string" && isUuid(teamParam) ? teamParam : null) ?? teams[0]?.id ?? null;

  // what the database shows staff about this parent's teams (an admin reads all of it): the switches,
  // team admin, the team's culture, schedule and her goals; the rest comes from admin_view_parent()
  const ids = teams.map((t) => t.id);
  const [{ data: offRows }, { data: adminRows }, { data: teamParents }] = await Promise.all([
    ids.length ? supabase.from("team_features_off").select("team_id, feature").in("team_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("team_admins").select("team_id").eq("user_id", userId),
    pickerTeam ? supabase.from("parent_links").select("parent_id").eq("team_id", pickerTeam).eq("status", "approved") : Promise.resolve({ data: [] }),
  ]);
  const offOn = (teamId: string, feature: SwitchKey) => (offRows ?? []).some((r) => r.team_id === teamId && r.feature === feature);
  const teamsWith = (feature: SwitchKey) => teams.filter((t) => !offOn(t.id, feature));
  const teamsOf = (teamName: string) => teams.filter((t) => t.name === teamName);
  const offFor = (teamName: string, feature: SwitchKey) => teamsOf(teamName).some((t) => offOn(t.id, feature));
  const goalDaughters = v.daughters.filter((d) => d.on_roster && !offFor(d.team_name, "parent.goals") && !offFor(d.team_name, "player.goals"));
  const parentIds = [...new Set((teamParents ?? []).map((p) => p.parent_id))];
  const [teamCulture, comingUpItems, daughterGoals, logo, { data: parentNames }] = await Promise.all([
    loadTeamCulture(supabase, teamsWith("parent.team")),
    loadComingUp(supabase, teamsWith("parent.calendar")),
    Promise.all(goalDaughters.map(async (d) => ({ daughter: d, goals: await loadDaughterGoals(supabase, d.player_id, teamsOf(d.team_name)) }))),
    v.logos[0] ? signedLogoUrl(supabase, v.logos[0].logo_path).then((url) => (url ? { name: v.logos[0].team_name, url } : null)) : Promise.resolve(null),
    parentIds.length ? supabase.from("parent_accounts").select("user_id, display_name").in("user_id", parentIds) : Promise.resolve({ data: [] }),
  ]);

  const consentStepOf = (playerId: string): ConsentStep => {
    const c = v.consent.find((x) => x.player_id === playerId);
    if (!c) return "birth-date";
    if (!c.under_13) return "not-needed";
    return c.status === "verified" ? "verified" : c.status === "pending" ? "pending" : "needed";
  };
  const budgets = (v.budgets as (BudgetSummaryData | null)[])
    .filter((s): s is BudgetSummaryData => Boolean(s))
    .map((summary) => ({ team: teams.find((t) => t.name === summary.team) ?? { id: summary.season_id, name: summary.team }, summary }))
    .filter(({ team }) => !offOn(team.id, "parent.budget"));
  const { needs, menuItems, boards } = familyMenu(
    {
      daughters: v.daughters,
      teams,
      offOn,
      forms: v.daughters.map((d) => ({ id: d.player_id, questionnaire: Boolean(d.questionnaire), medical: medicalOnFile(d.medical) })),
      consentStepOf,
      packet: v.packet,
      readIds: read,
      mentorLinks: v.mentor_links.map((l) => ({ ...l, key: `${l.mentor_id}-${l.player_id ?? l.team_id}` })),
      mentors: v.mentors,
      adminTeamIds: (adminRows ?? []).map((r) => r.team_id),
      teamCulture,
      daughterGoals,
      budgets,
    },
    { preview: true },
  );
  const [nameFirst, ...nameRest] = name.split(" ");
  const calendarTeams = teamsWith("parent.calendar");
  const yearbooks = teamsWith("parent.yearbook").filter((t) => v.yearbook_teams.includes(t.id));
  const pickerPeople = (parentNames ?? []).sort((a, b) => a.display_name.localeCompare(b.display_name));
  const coachHref = pickerTeam ? `/dugout/parents?team=${pickerTeam}` : "/view-as";

  return (
    <div className="flex flex-col gap-8">
      <ViewToggle kind="parent" current="view" coachHref={coachHref} viewHref={`/view-as/parent/${userId}${pickerTeam ? `?team=${pickerTeam}` : ""}`} />
      {pickerPeople.length > 1 && (
        <PillNav
          label="Choose a parent"
          size="sm"
          current={userId}
          items={pickerPeople.map((p) => ({ key: p.user_id, label: p.display_name, href: `/view-as/parent/${p.user_id}?team=${pickerTeam}` }))}
        />
      )}
      <ViewBanner who={name} role="parent" />

      {/* their family menu, as they see it: the family page's own builder, links left out */}
      <section aria-label={`${name}'s family page`} className="flex flex-col gap-10 rounded-2xl border-2 border-navy-700 p-4 sm:p-6">
        {!v.profile || v.links.length === 0 ? (
          <EmptyState title="Join your daughter's team">
            {!v.profile
              ? "No parent profile yet: they signed up but never entered their name and team code, so their family page shows only this form."
              : "No team requests yet, so their family page shows only the join form."}
          </EmptyState>
        ) : (
          <>
            <MenuHeader
              eyebrow="Family menu"
              first={nameFirst}
              last={nameRest.join(" ") || undefined}
              line={[teams.map((t) => t.name).join(" · "), v.account.email].filter(Boolean).join(" · ")}
              start={<PageMenu items={menuItems} />}
              aside={<TeamLogoMark logo={logo} />}
            />
            {yearbooks.length > 0 && <YearbookBanner teamNames={yearbooks.map((t) => t.name)} preview />}
            <NeedsYou items={needs} />
            {calendarTeams.length > 0 && <ComingUpCard items={comingUpItems} teams={calendarTeams} calendarHref={`/dugout/calendar?team=${calendarTeams[0].id}`} />}
            <FamilyBoards boards={boards} />
          </>
        )}
      </section>

      {/* what they can't see themselves: for troubleshooting */}
      <section aria-labelledby="behind" className="flex flex-col gap-6">
        <h2 id="behind" className="font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
          Behind the page · admins only
        </h2>
        <AccountFacts account={v.account} />

        <div id="logins" className="scroll-mt-24">
          <Card title="Their teams">
            {v.links.length === 0 ? (
              <EmptyState>No team requests. Their page shows the &quot;Join your daughter&apos;s team&quot; form.</EmptyState>
            ) : (
              <ul className="divide-y divide-navy-800">
                {v.links.map((l) => (
                  <li key={l.link_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="font-semibold">{l.team_name}</p>
                      <p className="text-sm text-muted">
                        Parent of {l.player_name ?? l.child_name}
                        {!l.player_name && l.status !== "approved" && ` (typed as "${l.child_name}")`}
                      </p>
                    </div>
                    <span className={badgeClass(l.status === "approved" ? "neon" : l.status === "pending" ? "pink" : "neutral")}>{LINK_STATUS[l.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {v.daughters.length > 0 && (
          <Card title={v.daughters.length === 1 ? "Her login" : "Their logins"}>
            <ul className="flex flex-col gap-4">
              {v.daughters.map((d) => {
                const consent = v.consent.find((c) => c.player_id === d.player_id);
                return (
                  <li key={d.player_id} className="flex flex-col gap-1">
                    <p className="font-semibold">
                      {d.player_name} <span className="font-normal text-muted">· {d.team_name}</span>
                    </p>
                    <p className="text-sm text-muted">{loginStatus(d)}</p>
                    {consent?.under_13 && (
                      <p className="text-sm">
                        Under 13 · parental consent:{" "}
                        <span className="font-semibold">
                          {consent.status ? `${consent.status}${consent.method ? ` (${consent.method === "video_call" ? "video call" : "signed form"})` : ""}` : "not given yet"}
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <div id="forms" className="flex scroll-mt-24 flex-col gap-6">
          {v.daughters.map((d) => {
            const mine = v.mentor_links.filter((l) => l.player_id === d.player_id);
            const wholeTeam = v.mentor_links.filter((l) => !l.player_id && l.status === "approved" && approvedTeams.some((t) => t.team_id === l.team_id));
            return (
              <Card key={`forms-${d.player_id}`} title={`${first(d.player_name)}'s season forms and mentors`}>
                <div className="flex flex-col gap-2 text-sm">
                  <p>Preseason questionnaire: {d.questionnaire ? <Badge tone="neon">On file</Badge> : <span className="text-muted">not filled in yet</span>}</p>
                  <p>Medical &amp; emergency card: {medicalOnFile(d.medical) ? <Badge tone="neon">On file</Badge> : <span className="text-muted">not on file yet</span>}</p>
                  <p>
                    Mentors:{" "}
                    {mine.length + wholeTeam.length === 0 ? (
                      <span className="text-muted">none</span>
                    ) : (
                      [...mine, ...wholeTeam]
                        .map((l) => `${mentorName(l.mentor_id)} (${l.player_id ? (l.status === "approved" ? "approved" : "asks to mentor her") : "whole team"})`)
                        .join(", ")
                    )}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {v.packet.length > 0 && (
          <Card title={`Welcome packet · ${v.packet.filter((i) => read.has(i.id)).length} of ${v.packet.length} read`}>
            <ul className="flex flex-col gap-2">
              {v.packet.map((it) => (
                <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
                  <span>
                    <span className={eyebrowClass}>{PACKET_KIND_LABEL[it.kind as PacketKind] ?? it.kind}</span> {it.title}
                  </span>
                  <span className="text-muted">{read.has(it.id) ? "Read ✓" : "Not read yet"}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {budgets.map(({ summary }) => (
          <section key={summary.season_id + summary.team} aria-label={`${summary.team} Team Budget`} className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">
              {summary.team} · Team Budget · {summary.season}
            </p>
            <BudgetSummary summary={summary} />
            {summary.credits && summary.credits.length > 0 && <CreditsSummary credits={summary.credits} />}
          </section>
        ))}
      </section>
    </div>
  );
}
