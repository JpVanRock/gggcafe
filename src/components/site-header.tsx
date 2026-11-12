// The one header for every signed-in area (staff, players, families, mentors): logo, the area's
// links, the Night/Day switch and the account controls. On phones the links and account fold
// behind a Menu button (HeaderMenu); it sticks to the top only from 640px up.
//
//   <SiteHeader
//     home={{ href: "/dashboard", label: "GGG.Cafe dashboard" }}
//     nav={<Suspense fallback={…}><MainNav /></Suspense>}
//     account={<SignOutButton />}
//     count={<Suspense fallback={null}><MenuCount /></Suspense>}
//   />
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { Logo } from "@/components/brand";
import { HeaderMenu } from "@/components/header-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { secondaryButtonClass } from "@/components/ui";

/** The links in a header: stacked with room to tap on phones, one row from 640px up. */
export const navClass = "flex flex-col text-base font-medium uppercase tracking-wider sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1 sm:text-sm";
/** One header link: a 40px tap target on phones. */
export const navItemClass = "inline-flex min-h-10 items-center gap-1.5 sm:min-h-0";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className={secondaryButtonClass}>
        Sign out
      </button>
    </form>
  );
}

export function SiteHeader({
  home,
  nav,
  account = <SignOutButton />,
  count,
  width = "wide",
  teamLogo,
}: {
  /** where the logo goes, and what screen readers call that link */
  home: { href: string; label: string };
  nav: ReactNode;
  account?: ReactNode;
  /** a count for the phone Menu button (approvals, notifications) */
  count?: ReactNode;
  /** match the page under it: "wide" (most pages) or "narrow" (the player home) */
  width?: "wide" | "narrow";
  /** the team's logo beside ours, when it has one (coaches' and parents' pages) */
  teamLogo?: ReactNode;
}) {
  return (
    <header className="z-10 border-b border-pink/40 bg-navy-950/90 backdrop-blur sm:sticky sm:top-0">
      <div className={`mx-auto flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 ${width === "narrow" ? "max-w-3xl" : "max-w-5xl"}`}>
        <Link href={home.href} aria-label={home.label} className="shrink-0">
          <Logo size={44} className="h-11 w-11" />
        </Link>
        {teamLogo}
        <HeaderMenu nav={nav} account={account} toggle={<ThemeToggle />} count={count} />
      </div>
    </header>
  );
}
