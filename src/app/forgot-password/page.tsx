import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ForgotForm } from "./forgot-form";
import { Logo } from "@/components/brand";

export const metadata: Metadata = { title: "Reset your password · GGG.Cafe" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <header className="flex flex-col items-center text-center">
        <Link href="/" aria-label="GGG.Cafe home">
          <Logo size={128} priority className="h-28 w-28 shadow-[0_0_40px_rgba(254,31,124,0.3)]" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold uppercase tracking-[0.12em] text-neon">Reset password</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        <p className="mt-3 text-sm text-muted">We&apos;ll email you a link to set a new one.</p>
      </header>

      {/* useSearchParams (the "link expired" notice) needs a Suspense boundary */}
      <Suspense>
        <ForgotForm />
      </Suspense>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-pink-soft underline hover:text-ink">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
