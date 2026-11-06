import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/env";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">GGG.Cafe</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Softball player development and game strategy.
          </p>
        </div>
        <Suspense fallback={null}>
          <AccountLink />
        </Suspense>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">Database</h2>
        <Suspense fallback={<p className="mt-1">Checking connection…</p>}>
          <DatabaseStatus />
        </Suspense>
      </section>
    </main>
  );
}

async function AccountLink() {
  if (!supabaseConfig()) return null;
  const user = await getCurrentUser();
  return (
    <Link
      href={user ? "/dashboard" : "/login"}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {user ? "Open dashboard" : "Sign in"}
    </Link>
  );
}

async function DatabaseStatus() {
  if (!supabaseConfig()) {
    return (
      <StatusLine ok={false}>
        Not configured. Fill in <code>.env.local</code> (see{" "}
        <code>.env.example</code>).
      </StatusLine>
    );
  }

  const supabase = await createClient();
  // Signed-out visitors see zero rows (Row Level Security), but a successful
  // query still proves the site can reach the database and the schema exists.
  const { error } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true });

  if (!error) {
    return <StatusLine ok>Connected. Schema is in place.</StatusLine>;
  }
  if (error.code === "PGRST205" || error.code === "42P01") {
    return (
      <StatusLine ok={false}>
        Connected, but the schema isn&apos;t applied yet. Run{" "}
        <code>npm run db:push</code>.
      </StatusLine>
    );
  }
  return <StatusLine ok={false}>Connection error: {error.message}</StatusLine>;
}

function StatusLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className="mt-1 flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      <span>{children}</span>
    </p>
  );
}
