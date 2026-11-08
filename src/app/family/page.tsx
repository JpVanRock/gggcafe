import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BudgetSummary, type BudgetSummaryData } from "@/components/budget-summary";
import { Card, Disclosure, Loading, PageHeader, secondaryButtonClass } from "@/components/ui";
import { JoinForm } from "./join-form";
import { FamilyHeader } from "./header";
import { yearbookTeams } from "@/lib/yearbook-data";
import { suggestUsername } from "@/lib/player-logins";
import { CreatePlayerLoginForm, ResetPlayerPasswordForm } from "./player-login";

export const metadata: Metadata = { title: "Family · GGG.Cafe" };

export default function FamilyPage({ searchParams }: PageProps<"/family">) {
  return (
    <div className="flex flex-1 flex-col">
      <FamilyHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
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
  const [{ data: account }, { data: claims }, linksResult, daughtersResult] = await Promise.all([
    supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.auth.getClaims(),
    supabase.rpc("parent_home"),
    supabase.rpc("parent_player_logins"),
  ]);
  const daughters = (daughtersResult.data ?? []) as Daughter[];
  const links = (linksResult.data ?? []) as Link_[];
  const metaName = ((claims?.claims?.user_metadata as { display_name?: string } | undefined)?.display_name ?? "").trim();
  const approvedTeams = [...new Map(links.filter((l) => l.status === "approved").map((l) => [l.team_id, l])).values()];
  const budgets = await Promise.all(
    approvedTeams.map(async (l) => ({
      link: l,
      summary: (await supabase.rpc("team_budget_summary", { p_team_id: l.team_id })).data as BudgetSummaryData | null,
    })),
  );
  const firstName = (account?.display_name ?? metaName).split(" ")[0];
  const yearbooks = await yearbookTeams(supabase, approvedTeams.map((l) => l.team_id));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={firstName ? `Welcome, ${firstName}` : "Welcome"} description={user.email ?? undefined}>
        {user.staff && (
          <Link href="/dashboard" className={secondaryButtonClass}>
            Coach dashboard →
          </Link>
        )}
      </PageHeader>

      {code === "invalid" && (
        <p role="alert" className="rounded-lg border border-pink/60 bg-pink/10 p-4 text-sm">
          Your account is set up, but that team code didn&apos;t match a team. Check it with your coach and enter it below.
        </p>
      )}

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
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${
                    l.status === "approved" ? "bg-neon text-on-accent" : l.status === "pending" ? "border border-pink text-pink-soft" : "border border-navy-600 text-muted"
                  }`}
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

      {daughters.length > 0 && (
        <Card title={daughters.length === 1 ? "Her login" : "Their logins"}>
          <ul className="flex flex-col gap-5">
            {daughters.map((d) => {
              const first = d.player_name.split(" ")[0];
              return (
                <li key={d.player_id} className="flex flex-col gap-3">
                  <p className="font-semibold">
                    {d.player_name} <span className="font-normal text-muted">· {d.team_name}</span>
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
                    </>
                  ) : d.has_account ? (
                    <p className="text-sm text-muted">{first} has her own account and signs in with her email.</p>
                  ) : !d.on_roster ? (
                    <p className="text-sm text-muted">
                      {first} isn&apos;t on the team&apos;s current roster yet. Once the head coach adds her, you can make her login here.
                    </p>
                  ) : (
                    <>
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
        </section>
      ))}

      {links.length === 0 ? (
        <Card title="Join your daughter's team">
          <p className="mb-4 text-sm text-muted">Enter the team code from your coach. Your coach approves you, then the Team Budget shows here.</p>
          <JoinForm askName={!account} defaultName={metaName} />
        </Card>
      ) : (
        <Disclosure summary="Join another team">
          <JoinForm askName={!account} defaultName={metaName} />
        </Disclosure>
      )}
    </div>
  );
}
