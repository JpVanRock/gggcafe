import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, type StaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Dashboard · GGG.Cafe" };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
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
        <Header title="Almost there" email={user.email} />
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

  const rows: [string, number | null][] = [
    ["Teams", teams.count],
    ["Players", players.count],
    ["Games", games.count],
    ["Development metrics", metrics.count],
  ];

  return (
    <>
      <Header title={`Welcome, ${user.staff.displayName}`} email={user.email} />

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">Your access</h2>
        <p className="mt-1">{ROLE_LABEL[user.staff.role]}</p>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">In the database</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {rows.map(([label, count]) => (
            <div key={label}>
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{count ?? "–"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

function Header({ title, email }: { title: string; email: string | null }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-500">GGG.Cafe</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {email && <p className="mt-1 text-sm text-zinc-500">{email}</p>}
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
