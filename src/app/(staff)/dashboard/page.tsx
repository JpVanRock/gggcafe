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
    // Parents have their own home page.
    const supabase = await createClient();
    const { data: parent } = await supabase.from("parent_accounts").select("user_id").eq("user_id", user.id).maybeSingle();
    if (parent) redirect("/family");
    return (
      <>
        <PageHeader title="Almost there" description={user.email ?? undefined} />
        <p className="rounded-lg border border-pink/50 bg-pink/10 p-4 text-ink">
          You&apos;re signed in, but your account isn&apos;t on the GGG.Cafe staff
          list yet. Ask an admin to add you.
        </p>
        <p className="mt-4 text-sm text-muted">
          A parent?{" "}
          <Link href="/family" className="text-pink hover:underline">
            Set up your family account →
          </Link>
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
