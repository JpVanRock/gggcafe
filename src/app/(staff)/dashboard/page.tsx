import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canEdit, getCurrentUser, type StaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard · GGG.Cafe" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin: full access, manages staff",
  coach: "Coach: can view and edit",
  viewer: "Viewer: read only",
};

async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.staff) {
    // Players and parents have their own home pages.
    const supabase = await createClient();
    const [{ data: parent }, { data: claims }, { data: jwt }] = await Promise.all([
      supabase.from("parent_accounts").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("player_claims").select("id").limit(1),
      supabase.auth.getClaims(),
    ]);
    const role = (jwt?.claims?.user_metadata as { role?: string } | undefined)?.role;
    if ((claims ?? []).length > 0 || role === "player") redirect("/me");
    if (parent || role === "parent") redirect("/family");
    return (
      <>
        <PageHeader title="Almost there" description={user.email ?? undefined} />
        <p className="rounded-lg border border-pink/50 bg-pink/10 p-4 text-ink">
          You&apos;re signed in, but your account isn&apos;t on the GGG.Cafe staff
          list yet. Ask an admin to add you.
        </p>
        <p className="mt-4 text-sm text-muted">
          A player?{" "}
          <Link href="/me" className="text-pink hover:underline">
            Claim your profile →
          </Link>{" "}
          A parent?{" "}
          <Link href="/family" className="text-pink hover:underline">
            Set up your family account →
          </Link>
        </p>
      </>
    );
  }

  const supabase = await createClient();
  const editorRole = canEdit(user.staff.role);
  const waiting = editorRole
    ? (((await supabase.rpc("pending_approvals")).data ?? []) as { team_id: string; team_name: string; player_claims: number; parent_requests: number }[])
    : [];
  const [teams, players, games, metrics] = await Promise.all(
    ["teams", "players", "games", "metrics"].map((table) =>
      supabase.from(table).select("*", { count: "exact", head: true }),
    ),
  );

  const rows: { label: string; count: number | null; href?: string }[] = [
    { label: "Teams", count: teams.count, href: "/teams" },
    { label: "Players", count: players.count, href: "/players" },
    { label: "Games", count: games.count },
    { label: "Development metrics", count: metrics.count },
  ];
  const editor = canEdit(user.staff.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome, ${user.staff.displayName}`} description={ROLE_LABEL[user.staff.role]} />

      {waiting.length > 0 && (
        <section className="rounded-2xl border border-pink/60 bg-pink/10 p-4 sm:p-5" aria-label="Waiting for your approval">
          <h2 className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Waiting for your approval</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {waiting.map((w) => (
              <li key={w.team_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold">{w.team_name}</span>
                {Number(w.player_claims) > 0 && (
                  <Link href={`/teams/${w.team_id}#claims`} className="text-pink hover:underline">
                    {w.player_claims} player claim{Number(w.player_claims) === 1 ? "" : "s"} →
                  </Link>
                )}
                {Number(w.parent_requests) > 0 && (
                  <Link href={`/dugout/parents?team=${w.team_id}`} className="text-pink hover:underline">
                    {w.parent_requests} parent request{Number(w.parent_requests) === 1 ? "" : "s"} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card title="In the database">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {rows.map(({ label, count, href }) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-3xl font-semibold tabular-nums text-highlight">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {count ?? "–"}
                  </Link>
                ) : (
                  (count ?? "–")
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Coaches Dugout">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/dugout", label: "Standards & Culture", note: "What your team stands for" },
            { href: "/dugout/calendar", label: "Calendar", note: "Dates that show in TWIS" },
            { href: "/dugout/plans", label: "Practice Plans", note: "Build, print and share" },
            { href: "/dugout/drills", label: "Drill Library", note: "Every drill, tagged" },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-lg border border-navy-700 px-4 py-3 transition hover:border-pink hover:bg-navy-800"
              >
                <span className="block font-semibold text-highlight uppercase tracking-wide">{item.label}</span>
                <span className="text-sm text-muted">{item.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {editor && (
        <Card title="Get started">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              <Link href="/teams" className="underline">Add your team</Link>, and the opponents you play.
            </li>
            <li>Open a team, create a season (e.g. &ldquo;Spring 2027&rdquo;), and add players to its roster.</li>
            <li>
              Fill in player details (bats/throws, positions, grad year) from the{" "}
              <Link href="/players" className="underline">Players</Link> page.
            </li>
          </ol>
        </Card>
      )}
    </div>
  );
}
