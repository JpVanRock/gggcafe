import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminTeamIds, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BudgetSummary, CreditsSummary, type BudgetSummaryData } from "@/components/budget-summary";
import { Card, Disclosure, Loading, PageHeader, secondaryButtonClass, eyebrowClass, badgeClass } from "@/components/ui";
import { JoinForm } from "./join-form";
import { FamilyHeader } from "./header";
import { yearbookTeams } from "@/lib/yearbook-data";
import { suggestUsername } from "@/lib/player-logins";
import { CreatePlayerLoginForm, ResetPlayerPasswordForm } from "./player-login";
import { MedicalForm, QuestionnaireForm } from "@/components/family-forms";
import { markPacketRead, saveMedicalAsParent, saveQuestionnaireAsParent } from "./actions";
import { PACKET_KIND_LABEL, medicalOnFile, type PacketKind, type Questionnaire } from "@/lib/family";
import { ActionForm } from "@/components/action-form";
import { DaughterMentors, loadFamilyMentors } from "./mentors";
import { ConsentOnFile, ConsentSteps } from "./consent";
import { consentStep } from "@/lib/consent";
import { formatLongDateAt } from "@/lib/dates";
import { isStaffParent } from "@/components/role-switch";
import type { SwitchKey } from "@/lib/switchboard";
import { VIDEO_CALL_COLUMNS, VideoCallList, type VideoCallRow } from "@/components/video-calls";
import { comingSinceISO, isComing } from "@/lib/video-calls";
import { loadComingUp, loadDaughterGoals, loadTeamCulture } from "./team-data";
import { ComingUpCard, DaughterGoalsCard, TeamCultureSection, hasTeamCulture } from "./team-sections";
import { TitleWithTeamLogo } from "@/components/team-logo";

export const metadata: Metadata = { title: "Family · GGG.Cafe" };

export default function FamilyPage({ searchParams }: PageProps<"/family">) {
  return (
    <div className="flex flex-1 flex-col">
      <FamilyHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<Loading />}>
          <Family searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

type Daughter = { player_id: string; player_name: string; team_name: string; on_roster: boolean; username: string | null; has_account: boolean };

type Link_ = {
  link_id: string;
  team_id: string;
  team_name: string;
  child_name: string;
  player_name: string | null;
  status: "pending" | "approved" | "declined";
};

async function Family({ searchParams }: Pick<PageProps<"/family">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { code } = await searchParams;

  const supabase = await createClient();
  const [{ data: account }, { data: claims }, linksResult, daughtersResult, { data: consentRows }] = await Promise.all([
    supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.auth.getClaims(),
    supabase.rpc("parent_home"),
    supabase.rpc("parent_player_logins"),
    // verified parental consent for daughters under 13 (COPPA)
    supabase.rpc("parent_consent_status"),
  ]);
  const daughters = (daughtersResult.data ?? []) as Daughter[];
  const consents = new Map((consentRows ?? []).map((c) => [c.player_id, c]));
  // Phase 6: her questionnaire and medical card (through the database functions), and the welcome packet
  const [forms, packetResult, readsResult, familyMentors] = await Promise.all([
    Promise.all(
      daughters.map(async (d) => ({
        id: d.player_id,
        questionnaire: ((await supabase.rpc("parent_questionnaire", { p_player_id: d.player_id })).data ?? null) as Partial<Questionnaire> | null,
        medical: ((await supabase.rpc("parent_medical_card", { p_player_id: d.player_id })).data ?? null) as Record<string, string | null> | null,
      })),
    ),
    supabase.from("parent_packet_items").select("id, team_id, kind, title, body, position").order("position"),
    supabase.from("parent_packet_reads").select("item_id").eq("parent_id", user.id),
    loadFamilyMentors(supabase),
  ]);
  const packetRows = (packetResult.data ?? []) as { id: string; team_id: string; kind: PacketKind; title: string; body: string }[];
  const readIds = new Set(((readsResult.data ?? []) as { item_id: string }[]).map((r) => r.item_id));
  const packet = packetRows.filter((i) => !offOn(i.team_id, "parent.packet"));
  const links = (linksResult.data ?? []) as Link_[];
  // what she typed on the sign-up page fills in the join form
  const meta = (claims?.claims?.user_metadata ?? {}) as { display_name?: string; team_code?: string; child?: string };
  const metaName = (meta.display_name ?? "").trim();
  const approvedTeams = [...new Map(links.filter((l) => l.status === "approved").map((l) => [l.team_id, l])).values()];
  const [adminTeamIds, { data: offRows }] = await Promise.all([
    getAdminTeamIds(),
    // the Switchboard: parent features each team's head coach turned off
    approvedTeams.length
      ? supabase.from("team_features_off").select("team_id, feature").in("team_id", approvedTeams.map((l) => l.team_id))
      : Promise.resolve({ data: [] as { team_id: string; feature: string }[] }),
  ]);
  const offOn = (teamId: string, feature: SwitchKey) => (offRows ?? []).some((r) => r.team_id === teamId && r.feature === feature);
  // a daughter's feature is off when her team turned it off
  const offForDaughter = (d: Daughter, feature: SwitchKey) => approvedTeams.some((l) => l.team_name === d.team_name && offOn(l.team_id, feature));
  const budgets = await Promise.all(
    approvedTeams.filter((l) => !offOn(l.team_id, "parent.budget")).map(async (l) => ({
      link: l,
      summary: (await supabase.rpc("team_budget_summary", { p_team_id: l.team_id })).data as BudgetSummaryData | null,
    })),
  );
  const firstName = (account?.display_name ?? metaName).split(" ")[0];
  // team admin (user, 2026-11-12): the head coach let them run the calendar, GameDay and measurements
  const adminTeams = approvedTeams.filter((l) => adminTeamIds.includes(l.team_id));
  // the team on the family page (user, 2026-11-13), each behind its own switch
  const teamOf = (l: Link_) => ({ id: l.team_id, name: l.team_name });
  const calendarTeams = approvedTeams.filter((l) => !offOn(l.team_id, "parent.calendar")).map(teamOf);
  const cultureTeams = approvedTeams.filter((l) => !offOn(l.team_id, "parent.team")).map(teamOf);
  // her goals: off when her team turned them off for parents, or turned Goals off for players
  const goalDaughters = daughters.filter((d) => d.on_roster && !offForDaughter(d, "parent.goals") && !offForDaughter(d, "player.goals"));
  const [comingUpItems, teamCulture, daughterGoals] = await Promise.all([
    loadComingUp(supabase, calendarTeams),
    loadTeamCulture(supabase, cultureTeams),
    Promise.all(
      goalDaughters.map(async (d) => ({
        daughter: d,
        goals: await loadDaughterGoals(supabase, d.player_id, approvedTeams.filter((l) => l.team_name === d.team_name).map(teamOf)),
      })),
    ),
  ]);
  const [yearbooks, { data: callRows }] = await Promise.all([
    yearbookTeams(supabase, approvedTeams.filter((l) => !offOn(l.team_id, "parent.yearbook")).map((l) => l.team_id)),
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
  const calls = ((callRows ?? []) as VideoCallRow[]).filter((c) => isComing(c));

  return (
    <div className="flex flex-col gap-8">
      {/* their team's logo on the right, beside the title (user, 2026-11-13) */}
      <TitleWithTeamLogo>
        <PageHeader title={firstName ? `Welcome, ${firstName}` : "Welcome"} description={user.email ?? undefined}>
          {/* a coach who is a parent here has the Coach / Parent switch under the menu instead */}
          {user.staff && !(await isStaffParent()) && (
            <Link href="/dashboard" className={secondaryButtonClass}>
              Coach dashboard →
            </Link>
          )}
        </PageHeader>
      </TitleWithTeamLogo>

      {code === "invalid" && (
        <p role="alert" className="rounded-lg border border-pink/60 bg-pink/10 p-4 text-sm">
          Your account is set up, but that team code didn&apos;t match a team. Check it with your coach and enter it below.
        </p>
      )}

      {calls.length > 0 && (
        <Card title="Video calls">
          <p className="text-sm text-muted">
            You&apos;re invited to every call a mentor or head coach books with your daughter. Join from the call page; it opens 10 minutes before the start.
          </p>
          <VideoCallList calls={calls} showPlayer />
        </Card>
      )}

      {calendarTeams.length > 0 && <ComingUpCard items={comingUpItems} teams={calendarTeams} calendarHref="/family/calendar" />}

      {links.length > 0 && (
        <Card title="Your teams">
          <ul className="divide-y divide-navy-800">
            {links.map((l) => (
              <li key={l.link_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-semibold">{l.team_name}</p>
                  <p className="text-sm text-muted">Parent of {l.player_name ?? l.child_name}</p>
                </div>
                <span
                  className={badgeClass(l.status === "approved" ? "neon" : l.status === "pending" ? "pink" : "neutral")}
                >
                  {l.status === "approved" ? "Approved" : l.status === "pending" ? "Waiting for coach" : "Not approved"}
                </span>
              </li>
            ))}
          </ul>
          {links.some((l) => l.status === "pending") && (
            <p className="mt-3 text-sm text-muted">Your coach will approve you soon. Check back here.</p>
          )}
          {links.some((l) => l.status === "declined") && (
            <p className="mt-3 text-sm text-muted">If a request wasn&apos;t approved, check the team code and name with your coach.</p>
          )}
        </Card>
      )}

      {adminTeams.length > 0 && (
        <Card title="Team admin">
          <p className="mb-4 text-sm text-muted">
            Your head coach made you a team admin for {adminTeams.map((t) => t.team_name).join(" and ")}: you can change the calendar, GameDay
            (lineups, depth chart, box scores) and players&apos; measurements.
          </p>
          <ul className="flex flex-col gap-3">
            {adminTeams.map((t) => (
              <li key={t.team_id} className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {adminTeams.length > 1 && <span className="font-semibold">{t.team_name}</span>}
                {(
                  [
                    ["/dugout/calendar", "Calendar"],
                    ["/dugout/gameday", "GameDay"],
                    ["/dugout/measurements", "Measurements"],
                  ] as const
                ).map(([href, label]) => (
                  <Link key={href} href={`${href}?team=${t.team_id}`} className="text-sm font-semibold text-link hover:underline">
                    {label} <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {daughters.length > 0 && (
        <Card title={daughters.length === 1 ? "Her login" : "Their logins"}>
          <ul className="flex flex-col gap-5">
            {daughters.map((d) => {
              const first = d.player_name.split(" ")[0];
              const consent = consents.get(d.player_id);
              const step = consentStep(consent);
              return (
                <li key={d.player_id} className="flex flex-col gap-3">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-semibold">
                      {d.player_name} <span className="font-normal text-muted">· {d.team_name}</span>
                    </span>
                    {/* her pages as she sees them, read only (user, 2026-11-12) */}
                    {d.on_roster && !offForDaughter(d, "parent.view_as") && (
                      <Link href={`/players/${d.player_id}`} className="text-sm font-semibold text-link hover:underline">
                        View as {first} <span aria-hidden="true">→</span>
                      </Link>
                    )}
                  </p>
                  {d.username ? (
                    <>
                      <p className="text-sm text-muted">
                        {first} signs in with the username <span className="font-mono font-bold text-ink">{d.username}</span> and the password
                        you set.
                      </p>
                      <Disclosure summary={`Set a new password for ${first}`}>
                        <ResetPlayerPasswordForm playerId={d.player_id} firstName={first} />
                      </Disclosure>
                      {step === "verified" && consent?.reviewed_at && (
                        <ConsentOnFile playerId={d.player_id} firstName={first} status="verified" method={consent.method} date={formatLongDateAt(consent.reviewed_at)} />
                      )}
                    </>
                  ) : d.has_account ? (
                    <p className="text-sm text-muted">{first} has her own account and signs in with her email.</p>
                  ) : !d.on_roster ? (
                    <p className="text-sm text-muted">
                      {first} isn&apos;t on the team&apos;s current roster yet. Once the head coach adds her, you can make her login here.
                    </p>
                  ) : step === "birth-date" ? (
                    <p className="text-sm text-muted">
                      Her birth date isn&apos;t on her profile yet. Ask her head coach to add it; then you can make {first}&apos;s login here.
                    </p>
                  ) : step === "needed" ? (
                    <ConsentSteps
                      playerId={d.player_id}
                      firstName={first}
                      userId={user.id}
                      defaultName={account?.display_name ?? metaName}
                      declinedNote={consent?.status === "declined" ? consent.review_note : null}
                    />
                  ) : step === "pending" && consent ? (
                    <ConsentOnFile playerId={d.player_id} firstName={first} status="pending" method={consent.method} date={formatLongDateAt(consent.submitted_at)} />
                  ) : (
                    <>
                      {step === "verified" && consent?.reviewed_at && (
                        <ConsentOnFile playerId={d.player_id} firstName={first} status="verified" method={consent.method} date={formatLongDateAt(consent.reviewed_at)} />
                      )}
                      <p className="text-sm text-muted">
                        No email for {first}? Make her a username and password; she signs in with them instead of an email. If she has
                        an email, she can sign up herself and claim her profile.
                      </p>
                      <CreatePlayerLoginForm playerId={d.player_id} firstName={first} suggestion={suggestUsername(d.player_name)} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {daughterGoals.map(({ daughter: d, goals }) => (
        <DaughterGoalsCard
          key={`goals-${d.player_id}`}
          first={d.player_name.split(" ")[0]}
          goals={goals}
          fullHref={offForDaughter(d, "parent.view_as") ? null : `/players/${d.player_id}/goals`}
        />
      ))}

      {teamCulture.filter(hasTeamCulture).map((t) => (
        <TeamCultureSection key={`culture-${t.team.id}`} data={t} />
      ))}

      {packet.length > 0 && (
        <Card title={`Welcome packet · ${packet.filter((i) => readIds.has(i.id)).length} of ${packet.length} read`}>
          <ul className="flex flex-col gap-3">
            {packet.map((it) => (
              <li key={it.id} className={`rounded-xl border p-4 ${readIds.has(it.id) ? "border-navy-700" : "border-pink/60 bg-pink/5"}`}>
                <p className={eyebrowClass}>{PACKET_KIND_LABEL[it.kind]}</p>
                <p className="mt-1 font-semibold">{it.title}</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-ink/90">{it.body}</p>
                {readIds.has(it.id) ? (
                  <p className="mt-2 text-xs text-muted">Read ✓</p>
                ) : (
                  <ActionForm action={markPacketRead} className="mt-2">
                    <input type="hidden" name="item_id" value={it.id} />
                    <button type="submit" className="text-sm font-semibold text-link hover:underline">
                      Mark as read
                    </button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {daughters.map((d) => {
        const f = forms.find((x) => x.id === d.player_id);
        const first = d.player_name.split(" ")[0];
        return (
          <Card key={`forms-${d.player_id}`} title={`${first}'s season forms`}>
            <div className="flex flex-col gap-3">
              {!offForDaughter(d, "parent.questionnaire") && (
                <Disclosure summary={`Preseason questionnaire: sizes, numbers, positions${f?.questionnaire ? " ✓" : ""}`}>
                  <QuestionnaireForm action={saveQuestionnaireAsParent} hidden={{ player_id: d.player_id }} values={f?.questionnaire ?? null} />
                </Disclosure>
              )}
              <Disclosure summary={`Medical & emergency card${medicalOnFile(f?.medical ?? null) ? " ✓ on file" : " · not on file yet"}`}>
                <MedicalForm action={saveMedicalAsParent} hidden={{ player_id: d.player_id }} values={f?.medical ?? null} />
              </Disclosure>
            </div>
          </Card>
        );
      })}

      {daughters.map((d) => (
        <DaughterMentors
          key={`mentors-${d.player_id}`}
          daughter={d}
          teams={approvedTeams.filter((l) => l.team_name === d.team_name).map((l) => ({ id: l.team_id, name: l.team_name }))}
          links={familyMentors.links}
          mentors={familyMentors.mentors}
        />
      ))}

      {yearbooks.length > 0 && (
        <Link
          href="/family/yearbook"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-neon bg-linear-to-r from-neon/10 to-pink/10 p-5 transition hover:from-neon/15"
        >
          <span>
            <span className="block font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">
              {approvedTeams.filter((l) => yearbooks.includes(l.team_id)).map((l) => l.team_name).join(" · ")}
            </span>
            <span className="block font-display text-4xl font-black tracking-tight text-highlight uppercase italic">Yearbook</span>
            <span className="block text-sm text-muted">The season in photos. Add yours and tag the players in them.</span>
          </span>
          <span className="font-mono text-xs tracking-wider text-ink uppercase">Open →</span>
        </Link>
      )}

      {budgets.map(({ link, summary }) => (
        <section key={link.team_id} aria-label={`${link.team_name} Team Budget`} className="flex flex-col gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{link.team_name}</p>
            <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">
              Team Budget{summary ? ` · ${summary.season}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted">View only. Team totals; individual families&apos; payments stay private.</p>
          </div>
          {summary ? <BudgetSummary summary={summary} /> : <p className="text-sm text-muted">The budget isn&apos;t set up yet.</p>}
          {/* tournament credit: its own running balance, apart from the budget (user, 2026-11-12) */}
          {summary?.credits && summary.credits.length > 0 && <CreditsSummary credits={summary.credits} />}
        </section>
      ))}

      {links.length === 0 ? (
        <Card title="Join your daughter's team">
          <p className="mb-4 text-sm text-muted">Enter the team code from your coach. Your coach approves you, then the Team Budget shows here.</p>
          <JoinForm askName={!account} defaultName={metaName} defaultCode={meta.team_code} defaultChild={meta.child} />
        </Card>
      ) : (
        <Disclosure summary="Join another team">
          <JoinForm askName={!account} defaultName={metaName} />
        </Disclosure>
      )}
    </div>
  );
}
