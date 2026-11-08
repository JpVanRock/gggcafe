// Coach sign-ups waiting (head coaches: assistants; admins: everyone) and the
// coaching staff list, on the Dugout Roster tab.
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { ROLE_LABEL, type StaffRole } from "@/lib/roles";
import type { StaffRequestRow } from "@/lib/approvals";
import { decideStaffRequest, removeStaff, setStaffRole } from "./actions";

const item = "rounded-xl border border-pink/50 bg-navy-950/40 p-4";

export function PendingStaffList({ requests }: { requests: StaffRequestRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => (
        <li key={r.user_id} className={item}>
          <p className="font-semibold">
            {r.display_name} <span className="font-normal text-muted">· {r.email}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted">
            <span className="text-ink">{r.role === "coach" ? "Head Coach" : "Assistant Coach"}</span>
            {r.team_name && ` · ${r.team_name}`}
            {r.note && ` · ${r.note}`} · asked {formatDay(r.requested_at.slice(0, 10))}
          </p>
          <form action={decideStaffRequest} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="user_id" value={r.user_id} />
            <button type="submit" name="decision" value="approve" className={buttonClass}>
              Approve
            </button>
            <button type="submit" name="decision" value="decline" className={secondaryButtonClass}>
              Decline
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export type StaffMember = { user_id: string; display_name: string; role: StaffRole };

const ORDER: Record<StaffRole, number> = { admin: 0, coach: 1, assistant: 2, viewer: 3 };

/** Everyone on staff. Admins change roles (head coach, assistant, viewer) and remove people. */
export function StaffList({ staff, isAdmin, meId }: { staff: StaffMember[]; isAdmin: boolean; meId: string }) {
  const sorted = [...staff].sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.display_name.localeCompare(b.display_name));
  return (
    <ul className="divide-y divide-navy-800">
      {sorted.map((s) => (
        <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
          <span>
            <span className="font-semibold">{s.display_name}</span> <span className="text-muted">· {ROLE_LABEL[s.role]}</span>
          </span>
          {isAdmin && s.role !== "admin" && s.user_id !== meId && (
            <span className="flex flex-wrap items-center gap-3">
              <form action={setStaffRole} className="flex items-center gap-2">
                <input type="hidden" name="user_id" value={s.user_id} />
                <select name="role" defaultValue={s.role} aria-label={`${s.display_name}'s role`} className={`${inputClass} py-1 text-xs`}>
                  <option value="coach">Head Coach</option>
                  <option value="assistant">Assistant Coach</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button type="submit" className="text-xs text-pink hover:underline">
                  Save
                </button>
              </form>
              <form action={removeStaff}>
                <input type="hidden" name="user_id" value={s.user_id} />
                <ConfirmSubmit message={`Take ${s.display_name} off the coaching staff? Their account stays; they lose staff access.`} className="text-xs text-danger hover:underline">
                  Remove
                </ConfirmSubmit>
              </form>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
