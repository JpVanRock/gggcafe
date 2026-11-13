// The notifications bell. Head coaches and admins get it in the staff menu (Player of the Week,
// mentors' video calls); players, parents and mentors get it in theirs for video calls booked or
// cancelled (user, 2026-11-12). Opens /notifications.
import { NavLink } from "@/components/nav-link";
import { navItemClass } from "@/components/site-header";
import { CountBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export function BellLink({ unread }: { unread: number }) {
  return (
    <NavLink href="/notifications" className={navItemClass} aria-label={unread ? `Notifications: ${unread} new` : "Notifications"} title="Notifications">
      <svg viewBox="0 0 24 24" aria-hidden className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {/* on phones the bell sits in a list, so it gets its name */}
      <span className="sm:hidden">Notifications</span>
      <CountBadge count={unread} label={`${unread} new`} tone="neon" />
    </NavLink>
  );
}

/** The bell with this person's unread count (render inside <Suspense>). */
export async function NotificationBell() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_notifications");
  return <BellLink unread={Number(data ?? 0)} />;
}
