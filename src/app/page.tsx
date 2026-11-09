import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { supabaseConfig } from "@/lib/supabase/env";
import { Logo, Tagline } from "@/components/brand";
import { CornerThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main id="main" className="relative flex flex-1 flex-col items-center overflow-hidden px-4 pt-14 pb-4 sm:pt-16">
      <CornerThemeToggle />
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
        <div className="flex flex-col items-center">
          {/* one line at every width: the size follows the screen (12px floor, 20px max) */}
          <p className="text-[clamp(0.75rem,3.8vw,1.25rem)] font-medium whitespace-nowrap uppercase tracking-[0.14em] text-ink sm:tracking-[0.2em]">
            Player development &amp; team <span aria-hidden>mgmt</span>
            <span className="sr-only">management</span>
          </p>
          {/* the brand kit's artwork (yellow at night, navy by day), apart from the logo: no lockup */}
          <Tagline width={260} eager className="mt-6" />
        </div>
        <Suspense fallback={<div className="h-12" />}>
          <AccountLink />
        </Suspense>
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
      className="rounded-md bg-neon px-6 py-3 font-semibold text-on-accent shadow-[0_0_24px_rgba(231,251,6,0.25)] transition hover:bg-neon-bright"
    >
      {user ? "Open dashboard" : "Sign in"}
    </Link>
  );
}
