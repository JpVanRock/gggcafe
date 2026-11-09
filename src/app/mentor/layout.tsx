// The mentor area: mentors and skill coaches (not staff) see the players coaches
// assign them. Its own header: logo, My players, theme, sign out.
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { secondaryButtonClass } from "@/components/ui";

export default function MentorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="z-10 border-b border-pink/40 bg-navy-950/90 backdrop-blur sm:sticky sm:top-0">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link href="/mentor" aria-label="GGG.Cafe mentor home" className="shrink-0">
            <Logo size={44} className="h-11 w-11" />
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium tracking-wider uppercase">
            <Link href="/mentor" className="text-muted hover:text-highlight">
              My players
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit" className={secondaryButtonClass}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
