import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAdminTeamIds } from "@/lib/auth";
import type { BudgetSummaryData } from "@/components/budget-summary";
import { Card, secondaryButtonClass } from "@/components/ui";
import { MenuHeader, NeedsYou } from "@/components/menu-board";
import { MyTeamLogo } from "@/components/team-logo";
import { isStaffParent } from "@/components/role-switch";
import { VIDEO_CALL_COLUMNS, VideoCallList, type VideoCallRow } from "@/components/video-calls";
import { yearbookTeams } from "@/lib/yearbook-data";
import { medicalOnFile } from "@/lib/family";
import { consentStep } from "@/lib/consent";
import { comingSinceISO, isComing } from "@/lib/video-calls";
import { JoinForm } from "./join-form";
import { loadFamilyMentors } from "./mentors";
import { loadFamily } from "./family-data";
import { loadComingUp, loadDaughterGoals, loadTeamCulture } from "./team-data";
import { FamilyBoards, YearbookBanner, familyMenu } from "./menu-content";
import { ComingUpCard } from "@/components/coming-up";
import { FamilyShell } from "./shell";
import { PageMenu } from "@/components/page-menu";

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
  const calls = ((callRows ?? []) as VideoCallRow[]).filter((c) => isComing(c));
  // Needs you, the hamburger menu and the boards: the same builder as an admin's Parent View
  const { needs, menuItems, boards } = familyMenu({
    daughters,
    teams,
    offOn,
    forms,
    consentStepOf: (id) => consentStep(consents.get(id)),
    packet: packetRows ?? [],
    readIds: new Set((readRows ?? []).map((r) => r.item_id)),
    mentorLinks: familyMentors.links.map((l) => ({ ...l, key: l.id })),
    mentors: familyMentors.mentors,
    adminTeamIds,
    teamCulture,
    daughterGoals,
    budgets,
  });
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
      {yearbooks.length > 0 && <YearbookBanner teamNames={teams.filter((t) => yearbooks.includes(t.id)).map((t) => t.name)} />}

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
          <FamilyBoards boards={boards} />
        </>
      )}
    </div>
  );
}
