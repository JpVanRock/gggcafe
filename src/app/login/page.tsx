import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Logo, Tagline } from "@/components/brand";
import { CornerThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Sign in · GGG.Cafe" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <CornerThemeToggle />
      <header className="flex flex-col items-center text-center">
        <Link href="/" aria-label="GGG.Cafe home">
          {/* 20% larger than before (7rem -> 8.4rem) */}
          <Logo size={168} priority className="h-[8.4rem] w-[8.4rem] shadow-[0_0_40px_rgba(254,31,124,0.3)]" />
        </Link>
        {/* The tagline sits apart from the logo, never as a lockup (brand kit rule) */}
        {/* keep-night: in Day Game the tagline sits on a navy panel (brand kit: artwork over navy) */}
        <h1 className="keep-night mt-6 rounded-xl bg-navy-950 px-4 py-2">
          <Tagline width={280} />
        </h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        <p className="mt-3 text-sm text-muted">Good Vibes Only</p>
      </header>

      <LoginForm />

      <div className="flex flex-col gap-2 text-center text-sm text-muted">
        <Link href="/forgot-password" className="text-pink-soft underline hover:text-ink">
          Forgot your password?
        </Link>
        <p>No account? Ask a GGG.Cafe admin.</p>
      </div>
    </main>
  );
}
