// The row under the main menu (user, 2026-11-12; 2026-11-13): the Coach / Parent switch for a coach
// who is also a parent here, to the left of the Switchboard pill (head coaches and admins). It sits
// under the menu on the Coach pages and the family pages alike, so the switch stays in one place
// whichever page you're on, and phones see it without opening the menu.
import { getCurrentUser, isHeadCoach } from "@/lib/auth";
import { SwitchboardLink } from "@/components/switchboard-link";
import { RoleSwitch, isStaffParent } from "@/components/role-switch";

export async function SwitchboardPill({ current }: { current: "coach" | "parent" }) {
  const user = await getCurrentUser();
  if (!user?.staff) return null;
  const head = isHeadCoach(user.staff.role);
  const parent = await isStaffParent();
  if (!head && !parent) return null;
  return (
    // -mb-4: the page below starts closer under this row (user, 2026-11-13: less empty space above the title)
    <div className="mx-auto -mb-4 flex w-full max-w-5xl flex-wrap items-center justify-end gap-3 px-4 pt-3">
      {parent && <RoleSwitch current={current} />}
      {head && <SwitchboardLink />}
    </div>
  );
}
