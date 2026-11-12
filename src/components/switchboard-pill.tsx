// The Switchboard's pill under the main menu (user, 2026-11-12): head coaches and admins only.
import { getCurrentUser, isHeadCoach } from "@/lib/auth";
import { SwitchboardLink } from "@/components/switchboard-link";

export async function SwitchboardPill() {
  const user = await getCurrentUser();
  if (!user?.staff || !isHeadCoach(user.staff.role)) return null;
  return (
    <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-3">
      <SwitchboardLink />
    </div>
  );
}
