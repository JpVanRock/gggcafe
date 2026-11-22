import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAdminTeamIds } from "@/lib/auth";
import type { BudgetSummaryData } from "@/components/budget-summary";
import { Card, buttonClass, secondaryButtonClass } from "@/components/ui";
import { MenuHeader, NeedsYou } from "@/components/menu-board";
import { MyTeamLogo } from "@/components/team-logo";
import { isStaffParent } from "@/components/role-switch";
import { VideoCallList } from "@/components/video-calls";
import { callsForPlayers } from "@/lib/video-call-data";
import { yearbookTeams } from "@/lib/yearbook-data";
import { comingUp, daughtersOnCall, medicalOnFile } from "@/lib/family";
import { callComingUp } from "@/lib/call-events";
import { addDays, todayISO } from "@/lib/dates";
import { consentStep } from "@/lib/consent";
import { comingSinceISO, isComing } from "@/lib/video-calls";
import { JoinForm } from "./join-form";
import { WaitingRequests } from "./waiting-requests";
import { loadFamilyMentors } from "./mentors";
import { firstOf, loadFamily } from "./family-data";
import { ParentPlayerToggle } from "@/components/parent-player-toggle";
import { COMING_UP_DAYS, loadComingUp, loadDaughterGoals, loadTeamCulture } from "./team-data";
import { FamilyBoards, YearbookBanner, familyMenu } from "./menu-content";
import { ComingUpCard } from "@/components/coming-up";
import { FamilyShell } from "./shell";
import { PageLinks } from "@/components/page-menu";

export const metadata: Metadata = { title: "Family · GGG.Cafe" };

// The family menu (user, 2026-11-13: cleaner and organized like the player dashboard's menu): the
// media-day header, the Yearbook at the top, "Needs you" (what's waiting on the parent, with where to do
// it), video calls, Coming up, then numbered menu boards, each with a short summary and its own page
// (Team Standards & Culture, Team Budget, Mentors, Welcome packet). Season Forms, Logins & Teams and Join
// Another Team are links under the header (PageLinks; a second Menu button until the design audit, N2).
export default function FamilyPage({ searchParams }: PageProps<"/family">) {
  return (
    <FamilyShell>
      <Family searchParams={searchParams} />
    </FamilyShell>
  );
}

async function Family({ searchParams }: Pick<PageProps<"/family">, "searchParams">) {
  const { code } = await searchParams;
  const { user, supabase, meta, joinError, links, daughters, teams, offOn, offForDaughter, teamsOf, teamsWith } = await loadFamily();

  const calendarTeams = teamsWith("parent.calendar");
  // her goals: off when her team turned them off for parents, or turned Goals off for players
  const goalDaughters = daughters.filter((d) => d.on_roster && !offForDaughter(d, "parent.goals") && !offForDaughter(d, "player.goals"));
  const [
    { data: account },
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
    { calls: callRows, invited },
  ] = await Promise.all([
    supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle(),
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
    // video calls their daughters are invited to (user, 2026-11-12; group calls 2026-11-14): parents are invited to every one
    callsForPlayers(supabase, daughters.map((d) => d.player_id), { since: comingSinceISO(), limit: 10 }),
  ]);

  const metaName = (meta.display_name ?? "").trim();
  // their name (a coach who is also a parent here may have no parent profile name)
  const fullName = (account?.display_name || metaName || user.staff?.displayName || "").trim();
  const [nameFirst, ...nameRest] = fullName.split(" ");
  const consents = new Map((consentRows ?? []).map((c) => [c.player_id, c]));
  const calls = callRows.filter((c) => isComing(c));
  // on a group call, name only their own daughters
  const daughtersOn = daughtersOnCall(invited, daughters);
  // Coming up: the team calendar and the calls booked to show on parents' calendars, each linking to its call page
  const today = todayISO();
  const upcoming = comingUp([...comingUpItems, ...callComingUp(calls, today, addDays(today, COMING_UP_DAYS), "family")], 10);
  // Needs you, the page links and the boards: the same builder as an admin's Parent View
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
  // her login can be made (user, 2026-11-16: a "Create Player Login" button on the parent dashboard)
  const loginToMake = daughters.filter((d) => d.on_roster && !d.username && !d.has_account);
  const pending = links.filter((l) => l.status === "pending");
  const declined = links.filter((l) => l.status === "declined");
  return (
    <div className="flex flex-col gap-10">
      <MenuHeader
        eyebrow="Family menu"
        first={nameFirst || "Welcome"}
        last={nameRest.join(" ") || undefined}
        line={teams.map((t) => t.name).join(" · ") || undefined}
        aside={
          <Suspense fallback={null}>
            <MyTeamLogo />
          </Suspense>
        }
        actions={
          <>
            {loginToMake.map((d) => (
              <Link key={d.player_id} href={`/family/logins#login-${d.player_id}`} className={buttonClass}>
                {daughters.length === 1 ? "Create Player Login" : `Create ${firstOf(d.player_name)}'s Login`}
              </Link>
            ))}
            {/* once she has a login: Parent view / Player view (user, 2026-11-16) */}
            <ParentPlayerToggle current="parent" />
            {/* a coach who is a parent here has the Coach / Parent switch under the menu instead */}
            {user.staff && !(await isStaffParent()) && (
              <Link href="/dashboard" className={secondaryButtonClass}>
                Coach dashboard →
              </Link>
            )}
          </>
        }
      />

      {/* Season Forms, Logins & Teams, Join Another Team: in the open, not behind a second Menu button (design audit, N2) */}
      {links.length > 0 && <PageLinks items={menuItems} label="Family pages" />}

      {(code === "invalid" || joinError) && links.length === 0 && (
        <p role="alert" className="rounded-lg border border-pink/60 bg-pink/10 p-4 text-sm">
          Your account is set up, but {joinError === "failed" ? "we couldn't join the team yet" : "that code didn't match a team"}. Check
          the parent code with your coach and enter it below.
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
          <VideoCallList calls={calls} showPlayer playerLabel={daughtersOn} />
        </Card>
      )}

      {calendarTeams.length > 0 && <ComingUpCard items={upcoming} teams={calendarTeams} calendarHref="/family/calendar" />}

      {links.length === 0 ? (
        <Card title="Join your daughter's team">
          <p className="mb-4 text-sm text-muted">
            Enter the parent code from your coach and your daughter&apos;s name as it is on the team roster. You&apos;re in right away, and your family
            menu fills in here.
          </p>
          <JoinForm askName={!account} defaultName={metaName} defaultCode={meta.team_code} defaultChild={meta.child} />
        </Card>
      ) : (
        <>
          {pending.length > 0 && <WaitingRequests links={pending} />}
          {declined.length > 0 && teams.length === 0 && (
            <Card title="Your teams">
              <ul className="flex flex-col gap-1 text-sm">
                {declined.map((l) => (
                  <li key={l.link_id}>
                    <span className="font-semibold">{l.team_name}</span> · parent of {l.child_name}: not approved; check the code and her name with your
                    coach
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
