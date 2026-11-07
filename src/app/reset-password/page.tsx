import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password · GGG.Cafe" };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <header className="flex flex-col items-center text-center">
        <Logo size={128} priority className="h-28 w-28 shadow-[0_0_40px_rgba(254,31,124,0.3)]" />
        <h1 className="mt-6 text-2xl font-semibold uppercase tracking-[0.12em] text-neon">New password</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
      </header>
      <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
        <ResetGate />
      </Suspense>
    </main>
  );
}

/** The reset link signs her in; without that session there's nothing to reset. */
async function ResetGate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return (
      <div className="flex flex-col gap-4 text-center text-sm">
        <p>This reset link has expired or was already used.</p>
        <Link href="/forgot-password" className="text-pink-soft underline hover:text-ink">
          Request a new link
        </Link>
      </div>
    );
  }
  return <ResetForm email={typeof data.claims.email === "string" ? data.claims.email : null} />;
}
