import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · GGG.Cafe" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <header>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          GGG.Cafe
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          For coaches and staff.
        </p>
      </header>

      <LoginForm />

      <p className="text-sm text-zinc-500">
        No account, or forgot your password? Ask a GGG.Cafe admin.
      </p>
    </main>
  );
}
