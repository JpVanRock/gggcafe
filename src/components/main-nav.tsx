// The top menu. Staff get the full menu (with a count of approvals waiting on the
// Coaches Dugout) on every page, including the player (/me) and family (/family)
// homes; everyone else gets `fallback`.
import Link from "next/link";
import type { ReactNode } from "react";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dugout", label: "Coaches Dugout" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
] as const;

const navClass = "flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium uppercase tracking-wider";
const linkClass = "text-muted hover:text-highlight";

export async function MainNav({ fallback = null }: { fallback?: ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.staff) return fallback;
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
    <nav className={navClass}>
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

/** What players see in the staff area's menu. */
export function PlayerNav() {
  return (
    <nav className={navClass}>
      <Link href="/me" className={linkClass}>
        My profile
      </Link>
    </nav>
  );
}
