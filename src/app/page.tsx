import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/env";
import { Logo } from "@/components/brand";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 pt-14 pb-4 sm:pt-16">
      {/* soft pink glow behind the badge */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-pink/10 blur-3xl"
      />
      <div className="relative flex w-full max-w-xl flex-1 flex-col items-center gap-8 text-center">
        <h1 className="sr-only">GGG.Cafe</h1>
        <Logo
          size={240}
          priority
          className="h-48 w-48 shadow-[0_0_60px_rgba(254,31,124,0.35)] sm:h-60 sm:w-60"
        />
        <div>
          <p className="text-lg font-medium uppercase tracking-[0.2em] text-neon sm:text-xl">
            Player development &amp; game strategy
          </p>
          <p className="mt-3 text-muted">
            Softball stats, scouting and progress tracking for our coaches and staff.
          </p>
        </div>
        <Suspense fallback={<div className="h-12" />}>
          <AccountLink />
        </Suspense>

        <footer className="mt-auto pt-8 text-xs text-muted">
          <Suspense fallback={<span>Checking database…</span>}>
            <DatabaseStatus />
          </Suspense>
        </footer>
      </div>
    </main>
  );
}

async function AccountLink() {
  if (!supabaseConfig()) return null;
  const user = await getCurrentUser();
  return (
    <Link
      href={user ? "/dashboard" : "/login"}
      className="rounded-md bg-neon px-6 py-3 font-semibold text-navy-950 shadow-[0_0_24px_rgba(231,251,6,0.25)] transition hover:bg-neon-bright"
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
    return <StatusLine ok>Database connected. Schema is in place.</StatusLine>;
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
    <p className="flex items-center justify-center gap-2">
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-neon" : "bg-pink"}`}
      />
      <span>{children}</span>
    </p>
  );
}
