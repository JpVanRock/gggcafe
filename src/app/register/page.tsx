import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand";
import { CornerThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm, type SignupTeam } from "./register-form";

export const metadata: Metadata = { title: "Sign up · GGG.Cafe" };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <CornerThemeToggle />
      <header className="flex flex-col items-center text-center">
        <Link href="/" aria-label="GGG.Cafe home">
          <Logo size={112} className="h-28 w-28 shadow-[0_0_40px_rgba(254,31,124,0.3)]" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-[0.08em] text-highlight uppercase">Sign up</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        <p className="mt-3 text-sm text-muted">Players claim their profile. Parents join the team. Your coach approves both.</p>
      </header>

      <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
        <Form />
      </Suspense>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-pink-soft underline hover:text-ink">
          Sign in
        </Link>
      </p>
    </main>
  );
}

async function Form() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("signup_teams");
  return <RegisterForm teams={(data ?? []) as SignupTeam[]} />;
}
