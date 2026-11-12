// Coaches who are parents (user, 2026-11-12): one login, two homes. The header's switch
// takes a coach with a parent link (any status) between the Coach page (/dashboard) and
// the Parent page (/family). Nobody else sees it.
import Link from "next/link";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Is the signed-in staff member also a parent here (asked, or approved)? Once per request. */
export const isStaffParent = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user?.staff) return false;
  const supabase = await createClient();
  const { count } = await supabase.from("parent_links").select("id", { count: "exact", head: true }).eq("parent_id", user.id);
  return (count ?? 0) > 0;
});

const item = "inline-flex min-h-8 items-center rounded-full px-3 transition";

export async function RoleSwitch({ current }: { current: "coach" | "parent" }) {
  if (!(await isStaffParent())) return null;
  return (
    <nav aria-label="Coach or parent page" className="inline-flex rounded-full border border-navy-600 p-0.5 text-xs font-semibold tracking-wider uppercase">
      {(
        [
          ["coach", "/dashboard", "Coach"],
          ["parent", "/family", "Parent"],
        ] as const
      ).map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
          className={`${item} ${current === key ? "bg-pink text-on-accent" : "text-muted hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
