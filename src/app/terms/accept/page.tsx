import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand";
import { CornerThemeToggle } from "@/components/theme-toggle";
import { Loading } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { EFFECTIVE_DATE, TERMS_SUMMARY, safeNext } from "@/lib/legal";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Agree to the Terms · GGG.Cafe" };

/**
 * Where src/proxy.ts sends a signed-in user who hasn't agreed to the current Terms (accounts made
 * before the Terms existed, player logins a parent made, and everyone after a new version).
 */
export default function AcceptTermsPage(props: PageProps<"/terms/accept">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-16">
      <CornerThemeToggle />
      <header className="flex flex-col items-center text-center">
        <Logo size={96} className="h-24 w-24 shadow-[0_0_40px_rgba(254,31,124,0.3)]" />
        <h1 className="mt-6 text-2xl font-semibold tracking-[0.08em] text-highlight uppercase">Terms of Service</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        <p className="mt-3 text-sm text-muted">Updated {EFFECTIVE_DATE}. Agree to keep using GGG.Cafe.</p>
      </header>
      <section aria-labelledby="short-version" className="rounded-xl border border-navy-700 bg-navy-900/60 p-5">
        <h2 id="short-version" className="text-2xs font-semibold tracking-[0.14em] text-pink-soft uppercase">
          The short version
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-ink marker:text-pink-soft">
          {TERMS_SUMMARY.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
      <Suspense fallback={<Loading />}>
        <Agree searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Agree({ searchParams }: { searchParams: PageProps<"/terms/accept">["searchParams"] }) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!user) {
    return (
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-link underline">
          Sign in
        </Link>{" "}
        first, then agree to the Terms.
      </p>
    );
  }
  return <AcceptForm next={safeNext(next)} />;
}
