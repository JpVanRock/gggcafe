import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { secondaryButtonClass } from "@/components/ui";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dugout", label: "Dugout" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
] as const;

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-pink/40 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link href="/dashboard" aria-label="GGG.Cafe dashboard" className="shrink-0">
            <Logo size={44} className="h-11 w-11" />
          </Link>
          <Suspense fallback={<nav className="flex gap-4 text-sm" aria-hidden />}>
            <MainNav />
          </Suspense>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

/** Staff get the full menu (with a count of approvals waiting); players get their profile. */
async function MainNav() {
  const user = await getCurrentUser();
  const linkClass = "text-muted hover:text-highlight";
  if (!user?.staff) {
    return (
      <nav className="flex gap-4 text-sm font-medium uppercase tracking-wider">
        <Link href="/me" className={linkClass}>
          My profile
        </Link>
      </nav>
    );
  }
  let waiting = 0;
  if (canEdit(user.staff.role)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("pending_approvals");
    waiting = ((data ?? []) as { player_claims: number; parent_requests: number }[]).reduce(
      (sum, t) => sum + Number(t.player_claims) + Number(t.parent_requests),
      0,
    );
  }
  return (
    <nav className="flex gap-4 text-sm font-medium uppercase tracking-wider">
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className={`${linkClass} inline-flex items-center gap-1.5`}>
          {item.label}
          {item.href === "/dugout" && waiting > 0 && (
            <span
              className="grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 font-mono text-[10px] font-bold text-on-accent"
              title={`${waiting} approval${waiting === 1 ? "" : "s"} waiting`}
            >
              {waiting}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      {user.staff && (
        <span className="hidden text-sm text-muted sm:inline">
          {user.staff.displayName} · {user.staff.role}
        </span>
      )}
      <form action={signOut}>
        <button type="submit" className={secondaryButtonClass}>
          Sign out
        </button>
      </form>
    </div>
  );
}
