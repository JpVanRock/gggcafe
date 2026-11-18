// Shared bits of the admins' "View as" pages (user, 2026-11-12): the read-only banner and the
// account facts that help troubleshoot (what the person can't see themselves).
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth";
import { formatLongDateAt } from "@/lib/dates";
import type { ViewAccount } from "@/lib/view-as";
import { buttonStyles, groupLabelClass } from "@/components/ui";

/** Admins only: anyone else gets a 404. */
export async function requireAdminPage() {
  const user = await requireStaffPage();
  if (user.staff.role !== "admin") notFound();
  return user;
}

export function ViewBanner({ who, role, children }: { who: string; role: "parent" | "mentor"; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-pink bg-pink/5 p-4 sm:p-5">
      <p className={`text-pink-soft ${groupLabelClass}`}>Admin · view as {role} · read only</p>
      <p className="text-lg font-semibold text-ink">
        What {who} sees on their {role === "parent" ? "family page" : "mentor home"}
      </p>
      <p className="text-sm text-muted">
        The database answered as {who}, so this is exactly what their access allows. Nothing here can be changed from this page.{" "}
        <Link href="/view-as" className="text-link hover:underline">
          View someone else
        </Link>
      </p>
      {children}
    </div>
  );
}

/**
 * Admins' way into a Parent or Mentor View (user, 2026-11-14), on the Dugout's Parents and Mentors tabs,
 * and the way back from one. A plain link, not a second Coach/Parent-style switch (design audit
 * 2026-11-18, N3: four look-alike pink switches did different things; the header's Coach / Parent
 * switch is the only one now). The View page's banner says whose view it is. `viewHref` null when
 * there's nobody to show.
 */
export function ViewToggle({ kind, current, coachHref, viewHref }: { kind: "parent" | "mentor"; current: "coach" | "view"; coachHref: string; viewHref: string | null }) {
  if (current === "view") {
    return (
      <Link href={coachHref} className="self-start text-sm font-semibold text-link hover:underline">
        <span aria-hidden="true">←</span> Back to the Coach view
      </Link>
    );
  }
  const label = `Preview as ${kind}`;
  return viewHref ? (
    <Link href={viewHref} className={buttonStyles("secondary", "self-start")}>
      {label} <span aria-hidden="true">→</span>
    </Link>
  ) : (
    <span className="self-start text-sm text-muted">{label}: {kind === "parent" ? "no approved parents on this team yet" : "no mentors on this team yet"}</span>
  );
}

const when = (t: string | null) => (t ? formatLongDateAt(t) : "Never");

export function AccountFacts({ account }: { account: ViewAccount }) {
  const rows: [string, string][] = [
    ["Email", account.email ?? "–"],
    ["Signed up as", account.signed_up_as ?? "–"],
    ["Account made", when(account.created_at)],
    ["Email confirmed", account.confirmed_at ? when(account.confirmed_at) : "Not yet"],
    ["Last signed in", when(account.last_sign_in_at)],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-navy-700 bg-navy-900/60 p-4 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="truncate">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
