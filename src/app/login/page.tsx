import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand";

export const metadata: Metadata = { title: "Sign in · GGG.Cafe" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <header className="flex flex-col items-center text-center">
        <Link href="/" aria-label="GGG.Cafe home">
          <Logo size={128} priority className="h-28 w-28 shadow-[0_0_40px_rgba(254,32,122,0.3)]" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold uppercase tracking-[0.12em] text-neon">Sign in</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        <p className="mt-3 text-sm text-muted">For coaches and staff.</p>
      </header>

      <LoginForm />

      <p className="text-center text-sm text-muted">
        No account, or forgot your password? Ask a GGG.Cafe admin.
      </p>
    </main>
  );
}
