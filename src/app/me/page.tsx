import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { Logo } from "@/components/brand";
import { SpeedStripes } from "@/components/athletic";
import { ThemeToggle } from "@/components/theme-toggle";
import { MainNav } from "@/components/main-nav";
import { Card, Loading, PageHeader, inputClass, secondaryButtonClass } from "@/components/ui";
import { isUuid } from "@/lib/softball";
import { ClaimForm } from "./claim-form";
import { usernameFromEmail } from "@/lib/player-logins";

export const metadata: Metadata = { title: "My profile · GGG.Cafe" };

export default function MePage({ searchParams }: PageProps<"/me">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-pink/40 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link href="/me" aria-label="GGG.Cafe" className="shrink-0">
            <Logo size={44} className="h-11 w-11" />
          </Link>
          <Suspense fallback={<span className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Player</span>}>
            <MainNav fallback={<span className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Player</span>} />
          </Suspense>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit" className={secondaryButtonClass}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Suspense fallback={<Loading />}>
          <Me searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

type Claim = {
  claim_id: string;
  team_id: string;
  team_name: string;
  season_name: string;
  typed_name: string;
  typed_jersey: string | null;
  status: "pending" | "approved" | "declined";
  is_current: boolean;
  player_id: string | null;
  welcome_message: string | null;
};

/** The coach's welcome message, media-day style. */
function Welcome({ team, season, message }: { team: string; season: string | null; message: string | null }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-navy-600 bg-navy-900/80 p-6 sm:p-8">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-pink via-pink to-neon" />
      <p className="flex items-center gap-3 font-mono text-xs tracking-[0.3em] text-pink-soft uppercase">
        <SpeedStripes className="h-3 w-9 text-pink" />
        Welcome to
      </p>
      <h2 className="mt-2 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase sm:text-4xl">{team}</h2>
      {season && <p className="mt-1 font-mono text-xs tracking-wider text-muted uppercase">{season}</p>}
      {message ? (
        <blockquote className="mt-5 border-l-2 border-pink pl-4 text-base leading-relaxed whitespace-pre-line text-ink">
          {message}
          <footer className="mt-2 font-mono text-[0.75rem] tracking-[0.2em] text-pink-soft uppercase">Your coaches</footer>
        </blockquote>
      ) : (
        <p className="mt-4 text-sm text-muted">Glad you&apos;re here. Claim your profile below.</p>
      )}
    </section>
  );
}

async function Me({ searchParams }: Pick<PageProps<"/me">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { team: teamParam } = await searchParams;

  const supabase = await createClient();
  const [{ data: claimsData }, { data: claimsJwt }] = await Promise.all([supabase.rpc("my_claims"), supabase.auth.getClaims()]);
  const claims = (claimsData ?? []) as Claim[];
  const metaName = ((claimsJwt?.claims?.user_metadata as { display_name?: string } | undefined)?.display_name ?? "").trim();

  // Approved for this season: straight to her dashboard.
  const active = claims.find((c) => c.is_current && c.status === "approved" && c.player_id);
  if (active && typeof teamParam !== "string") redirect(`/players/${active.player_id}`);

  const current = claims.filter((c) => c.is_current);
  const pending = current.filter((c) => c.status === "pending");
  const declined = current.filter((c) => c.status === "declined");
  // last season approved, new season not claimed yet
  const lapsed = claims.filter(
    (c) => !c.is_current && c.status === "approved" && !current.some((k) => k.team_id === c.team_id),
  );
  const lapsedTeams = [...new Map(lapsed.map((c) => [c.team_id, c])).values()];

  const chosenTeam = typeof teamParam === "string" && isUuid(teamParam) ? teamParam : null;
  const welcome = chosenTeam
    ? ((await supabase.rpc("team_welcome", { p_team_id: chosenTeam })).data as { team_name: string; season_name: string | null; welcome_message: string | null }[] | null)?.[0] ?? null
    : null;
  const teams = (await supabase.rpc("signup_teams")).data as { id: string; name: string; age_group: string | null }[] | null;
  const firstName = (metaName || claims[0]?.typed_name || "").split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={firstName ? `Hey, ${firstName}` : "My profile"} description={usernameFromEmail(user.email) ? `Username: ${usernameFromEmail(user.email)}` : (user.email ?? undefined)}>
        {user.staff && (
          <Link href="/dashboard" className={secondaryButtonClass}>
            Coach dashboard →
          </Link>
        )}
      </PageHeader>

      {active && (
        <Link href={`/players/${active.player_id}`} className={`${secondaryButtonClass} self-start`}>
          Open my dashboard →
        </Link>
      )}

      {pending.map((c) => (
        <div key={c.claim_id} className="flex flex-col gap-4">
          <Welcome team={c.team_name} season={c.season_name} message={c.welcome_message} />
          <p role="status" className="rounded-xl border border-neon/60 bg-neon/10 p-4 text-sm">
            Claim sent for <strong>{c.typed_name}</strong>
            {c.typed_jersey ? ` #${c.typed_jersey}` : ""}. Your coach approves it, then your dashboard opens here.
          </p>
        </div>
      ))}

      {lapsedTeams.map((c) => (
        <div key={c.team_id} className="flex flex-col gap-4">
          <Welcome team={c.team_name} season="New season" message={c.welcome_message} />
          <Card title="Claim your spot for the new season">
            <p className="mb-4 text-sm text-muted">
              Your profile and everything you&apos;ve earned stay with you. Claim your spot again so your coach can approve the new season.
            </p>
            <ClaimForm teamId={c.team_id} defaultName={c.typed_name} defaultJersey={c.typed_jersey} />
          </Card>
        </div>
      ))}

      {declined.map((c) => (
        <Card key={c.claim_id} title={`${c.team_name}: claim not approved`}>
          <p className="mb-4 text-sm text-muted">Your coach couldn&apos;t match this claim. Check your name and jersey number and try again.</p>
          <ClaimForm teamId={c.team_id} defaultName={c.typed_name} defaultJersey={c.typed_jersey} />
        </Card>
      ))}

      {welcome && !current.some((c) => c.team_id === chosenTeam) && (
        <div className="flex flex-col gap-4">
          <Welcome team={welcome.team_name} season={welcome.season_name} message={welcome.welcome_message} />
          <Card title="Claim your player profile">
            <p className="mb-4 text-sm text-muted">Enter your name and jersey number exactly as your coach has them. Your coach approves it.</p>
            <ClaimForm teamId={chosenTeam!} defaultName={metaName} />
          </Card>
        </div>
      )}

      {!welcome && pending.length === 0 && lapsedTeams.length === 0 && declined.length === 0 && !active && (
        <Card title="Choose your team">
          {teams?.length ? (
            <form method="get" className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-60 flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">Team</span>
                <select name="team" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Pick your team
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.age_group && !t.name.includes(t.age_group) ? ` · ${t.age_group}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={secondaryButtonClass}>
                Continue →
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted">No teams are set up for sign-up yet. Check with your coach.</p>
          )}
        </Card>
      )}
    </div>
  );
}
