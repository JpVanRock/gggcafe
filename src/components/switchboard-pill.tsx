// The row under the main menu (user, 2026-11-12; 2026-11-13): the Coach / Parent switch for a coach
// who is also a parent here, to the left of the Switchboard pill (head coaches and admins). The switch
// is under the menu on the Coach pages and the family pages alike, so it stays in one place; the
// Switchboard is a coaches' tool, so it shows on the Coach pages only (not the family pages, nor
// the View as previews of a parent's or a mentor's page: SwitchboardLink), user 2026-11-13.
import { getCurrentUser, isHeadCoach } from "@/lib/auth";
import { SwitchboardLink } from "@/components/switchboard-link";
import { RoleSwitch, isStaffParent } from "@/components/role-switch";

export async function SwitchboardPill({ current }: { current: "coach" | "parent" }) {
  const user = await getCurrentUser();
  if (!user?.staff) return null;
  const head = isHeadCoach(user.staff.role) && current === "coach";
  const parent = await isStaffParent();
  if (!head && !parent) return null;
  return (
    // -mb-4: the page below starts closer under this row (user, 2026-11-13: less empty space above the title).
    // relative z-10: the page then overlaps the row's bottom 16px, and a later flex item paints (and takes
    // taps) on top, which left the lower half of the pills dead (user, 2026-11-14: "the switchboard button
    // does not function"); the row stays above it.
    // empty:hidden: nothing left in it (a View as preview without the switch) means no row at all
    <div className="relative z-10 mx-auto -mb-4 flex w-full max-w-5xl flex-wrap items-center justify-end gap-3 px-4 pt-3 empty:hidden">
      {parent && <RoleSwitch current={current} />}
      {head && <SwitchboardLink />}
    </div>
  );
}
