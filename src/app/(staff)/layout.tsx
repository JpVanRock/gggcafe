import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import { secondaryButtonClass } from "@/components/ui";
import { Logo } from "@/components/brand";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
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
          <nav className="flex gap-4 text-sm font-medium uppercase tracking-wider">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted hover:text-neon">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
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
