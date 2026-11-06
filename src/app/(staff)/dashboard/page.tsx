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
    return (
      <>
        <PageHeader title="Almost there" description={user.email ?? undefined} />
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          You&apos;re signed in, but your account isn&apos;t on the GGG.Cafe staff
          list yet. Ask an admin to add you.
        </p>
      </>
    );
  }

  const supabase = await createClient();
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

      <Card title="In the database">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {rows.map(({ label, count, href }) => (
            <div key={label}>
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">
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
