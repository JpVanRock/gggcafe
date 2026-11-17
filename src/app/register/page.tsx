import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { CornerThemeToggle } from "@/components/theme-toggle";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Sign up · GGG.Cafe" };

export default function RegisterPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <CornerThemeToggle />
      <header className="flex flex-col items-center text-center">
        <Link href="/" aria-label="GGG.Cafe home">
          <Logo size={112} className="h-28 w-28 shadow-[0_0_40px_rgba(254,31,124,0.3)]" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-[0.08em] text-highlight uppercase">Sign up</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        <p className="mt-3 text-sm text-muted">
          For parents, coaches and mentors. Make your account and confirm your email, then sign in and join your team with the parent code
          from your coach. Parents are in right away; a coach, a parent or an admin approves everyone else. Players don&apos;t sign up: a
          parent makes each player&apos;s login from the family page.
        </p>
      </header>

      <RegisterForm />

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-pink-soft underline hover:text-ink">
          Sign in
        </Link>
      </p>
    </main>
  );
}
