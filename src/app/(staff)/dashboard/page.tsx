import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canEdit, getCurrentUser, getMentor, isHeadCoach, type StaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading, PageHeader } from "@/components/ui";
import { addDays, formatDay, formatTime, todayISO } from "@/lib/dates";
import { COACH_SIGNUP_ROLE, ROLE_NOTE, canEditPlanRole, dugoutTabsFor, isCoachSignup, type StaffRole } from "@/lib/roles";
import { loadStaffRequests, type StaffRequestRow } from "@/lib/approvals";

export const metadata: Metadata = { title: "Dashboard · GGG.Cafe" };

// Every account type has its own home (user, 2026-11-08): head coaches and admins
// get the full dashboard, assistant coaches their week and their plans, coaches
// waiting for approval a holding page; players, parents and mentors are sent to
// /me, /family and /mentor.
export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}

const heading = "font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase";

const TAB_NOTE: Record<string, string> = {
  "/dugout/roster": "Your roster, player accounts, approvals",
  "/dugout": "What your team stands for",
  "/dugout/calendar": "Dates that show in TWIS",
  "/dugout/plans": "Build, print and share",
  "/dugout/gameday": "Lineups and defensive rotations",
  "/dugout/drills": "Every drill, tagged",
  "/dugout/budget": "Fees, payments and expenses",
  "/dugout/parents": "Team code and parent requests",
  "/dugout/mentors": "Mentors and skill coaches",
};

async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.staff) return <NotStaff userId={user.id} email={user.email} />;

  const staffUser = user as StaffUser;
  const role = staffUser.staff.role;
  const supabase = await createClient();
  const editor = canEdit(role);
  const head = isHeadCoach(role);
  const [waiting, staffRequests] = await Promise.all([
    editor
      ? supabase.rpc("pending_approvals").then((r) => (r.data ?? []) as { team_id: string; team_name: string; player_claims: number; parent_requests: number }[])
      : Promise.resolve([]),
    head ? loadStaffRequests(supabase) : Promise.resolve([] as StaffRequestRow[]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome, ${staffUser.staff.displayName}`} description={ROLE_NOTE[role]} />
      <Approvals waiting={waiting} staffRequests={staffRequests} />
      {editor && <CheckIns />}
      {role === "assistant" ? <AssistantHome user={staffUser} /> : <HeadCoachHome role={role} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed in, not on staff
// ---------------------------------------------------------------------------

async function NotStaff({ userId, email }: { userId: string; email: string | null }) {
  // Players, parents and mentors have their own home pages.
  const supabase = await createClient();
  const [{ data: parent }, { data: claims }, { data: jwt }] = await Promise.all([
    supabase.from("parent_accounts").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("player_claims").select("id").limit(1),
    supabase.auth.getClaims(),
  ]);
  const meta = (jwt?.claims?.user_metadata ?? {}) as { role?: string; display_name?: string; team?: string; note?: string };
  if ((claims ?? []).length > 0 || meta.role === "player") redirect("/me");
  if (meta.role === "mentor" || (await getMentor())) redirect("/mentor");
  if (parent || meta.role === "parent") redirect("/family");

  // Coaches who signed up: the request goes in on the first sign-in after confirming the email.
  if (isCoachSignup(meta.role)) {
    const { data: status, error } = await supabase.rpc("request_staff_access", {
      p_role: COACH_SIGNUP_ROLE[meta.role],
      p_name: (meta.display_name ?? email ?? "").slice(0, 80),
      p_team_id: meta.team && /^[0-9a-f-]{36}$/.test(meta.team) ? meta.team : null,
      p_note: meta.note ?? null,
    });
    const assistant = meta.role === "assistant-coach";
    if (status === "staff") redirect("/dashboard");
    const declined = status === "declined";
    return (
      <>
        <PageHeader title={declined ? "Not approved" : "Waiting for approval"} description={email ?? undefined} />
        <div className={`rounded-2xl border p-5 ${declined ? "border-navy-600" : "border-pink/50 bg-pink/10"}`}>
          <p className="font-display text-xl font-bold tracking-wide uppercase">{assistant ? "Assistant Coach" : "Head Coach"}</p>
          <p className="mt-2 text-ink">
            {error
              ? "We couldn't send your request. Sign out and back in, or ask your head coach to add you."
              : declined
                ? "Your coach sign-up wasn't approved. If that's a mistake, talk to your head coach or the GGG.Cafe admin."
                : assistant
                  ? "Your email is confirmed. A head coach approves assistant coaches; once they do, your Coaches Dugout opens here."
                  : "Your email is confirmed. An admin approves new head coaches; once they do, you can register your team and build its roster here."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Almost there" description={email ?? undefined} />
      <p className="rounded-lg border border-pink/50 bg-pink/10 p-4 text-ink">
        You&apos;re signed in, but your account isn&apos;t on the GGG.Cafe staff list yet. Ask an admin to add you.
      </p>
      <p className="mt-4 text-sm text-muted">
        A player?{" "}
        <Link href="/me" className="text-pink hover:underline">
          Claim your profile →
        </Link>{" "}
        A parent?{" "}
        <Link href="/family" className="text-pink hover:underline">
          Set up your family account →
        </Link>
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function Approvals({
  waiting,
  staffRequests,
}: {
  waiting: { team_id: string; team_name: string; player_claims: number; parent_requests: number }[];
  staffRequests: StaffRequestRow[];
}) {
  if (waiting.length === 0 && staffRequests.length === 0) return null;
  const heads = staffRequests.filter((r) => r.role === "coach");
  const assistants = staffRequests.filter((r) => r.role === "assistant");
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  return (
    <section className="rounded-2xl border border-pink/60 bg-pink/10 p-4 sm:p-5" aria-label="Waiting for your approval">
      <h2 className={heading}>Waiting for your approval</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {heads.length > 0 && (
          <li className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">Head coaches</span>
            <span className="text-muted">{heads.map((r) => r.display_name).join(", ")}</span>
            <Link href="/dugout/roster#waiting" className="text-pink hover:underline">
              Review in Roster →
            </Link>
          </li>
        )}
        {waiting.map((w) => {
          const coaches = assistants.filter((r) => r.team_id === w.team_id).length;
          return (
            <li key={w.team_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold">{w.team_name}</span>
              <span className="text-muted">
                {[
                  Number(w.player_claims) > 0 && plural(Number(w.player_claims), "player claim"),
                  Number(w.parent_requests) > 0 && plural(Number(w.parent_requests), "parent request"),
                  coaches > 0 && plural(coaches, "assistant coach"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Link href={`/dugout/roster?team=${w.team_id}#waiting`} className="text-pink hover:underline">
                Review in Roster →
              </Link>
            </li>
          );
        })}
        {/* assistant coaches for teams with nothing else waiting */}
        {Object.values(
          Object.fromEntries(
            assistants.filter((r) => !waiting.some((w) => w.team_id === r.team_id)).map((r) => [r.team_id ?? "", r] as const),
          ),
        ).map((r) => (
          <li key={r.team_id ?? "none"} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">{r.team_name ?? "Assistant coaches"}</span>
            <span className="text-muted">{plural(assistants.filter((a) => a.team_id === r.team_id).length, "assistant coach")}</span>
            <Link href={`/dugout/roster${r.team_id ? `?team=${r.team_id}` : ""}#waiting`} className="text-pink hover:underline">
              Review in Roster →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Leadership Plan check-ins coming up: the dates her plan set, as TWIS reminders. */
async function CheckIns() {
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase
    .from("player_activities")
    .select("id, starts_on, player:players(id, first_name, preferred_name, last_name)")
    .eq("source", "leadership-checkin")
    .gte("starts_on", today)
    .lte("starts_on", addDays(today, 14))
    .order("starts_on");
  const checkIns = (data ?? []) as unknown as {
    id: string;
    starts_on: string;
    player: { id: string; first_name: string; preferred_name: string | null; last_name: string } | null;
  }[];
  if (checkIns.length === 0) return null;
  return (
    <section className="rounded-2xl border border-neon/60 bg-neon/5 p-4 sm:p-5" aria-label="Leadership check-ins">
      <h2 className={heading}>Leadership check-ins · next two weeks</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {checkIns.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className={`w-24 font-display font-bold tabular-nums ${c.starts_on === today ? "text-highlight" : "text-muted"}`}>
              {c.starts_on === today ? "Today" : c.starts_on === addDays(today, 1) ? "Tomorrow" : formatDay(c.starts_on)}
            </span>
            <span className="font-semibold">{c.player ? `${c.player.preferred_name || c.player.first_name} ${c.player.last_name}` : "A player"}</span>
            {c.player && (
              <Link href={`/players/${c.player.id}/advanced/leadership/plan`} className="text-pink hover:underline">
                Her Leadership Plan →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DugoutCard({ role }: { role: StaffRole }) {
  return (
    <Card title="Coaches Dugout">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dugoutTabsFor(role).map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} className="block rounded-lg border border-navy-700 px-4 py-3 transition hover:border-pink hover:bg-navy-800">
              <span className="block font-semibold tracking-wide text-highlight uppercase">{tab.label}</span>
              <span className="text-sm text-muted">{TAB_NOTE[tab.href]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Head coach, admin (and view-only staff)
// ---------------------------------------------------------------------------

async function HeadCoachHome({ role }: { role: StaffRole }) {
  const supabase = await createClient();
  const [teams, players, games, metrics] = await Promise.all(
    ["teams", "players", "games", "metrics"].map((table) => supabase.from(table).select("*", { count: "exact", head: true })),
  );
  const rows: { label: string; count: number | null; href?: string }[] = [
    { label: "Teams", count: teams.count, href: "/teams" },
    { label: "Players", count: players.count, href: "/players" },
    { label: "Games", count: games.count },
    { label: "Development metrics", count: metrics.count },
  ];
  return (
    <>
      <Card title="In the database">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {rows.map(({ label, count, href }) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-3xl font-semibold tabular-nums text-highlight">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {count ?? "–"}
                  </Link>
                ) : (
                  (count ?? "–")
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <DugoutCard role={role} />

      {isHeadCoach(role) && (
        <Card title="Get started">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              Register your team on the{" "}
              <Link href="/teams" className="underline">
                Teams
              </Link>{" "}
              page, and the opponents you play.
            </li>
            <li>
              Build the official roster with Player intake. Players claim, and parents join, only players on it; a parent can make a
              login for a daughter without an email.
            </li>
            <li>
              Turn on your team code in Coaches Dugout →{" "}
              <Link href="/dugout/parents" className="underline">
                Parents
              </Link>{" "}
              and share it with families.
            </li>
            <li>Assistant coaches sign up and pick your team; approve them on the Roster tab.</li>
          </ol>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Assistant coach: the week ahead, practice plans, the Dugout tabs she has
// ---------------------------------------------------------------------------

type EventRow = { id: string; kind: string; title: string | null; event_date: string; start_time: string | null; team: { name: string; is_own_team: boolean } | null };
type PlanRow = { id: string; practice_date: string; start_time: string | null; focus: string | null; status: "draft" | "final"; created_by: string | null; team: { name: string } | null };

async function AssistantHome({ user }: { user: StaffUser }) {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: events }, { data: plans }, { data: drafts }] = await Promise.all([
    supabase
      .from("team_events")
      .select("id, kind, title, event_date, start_time, team:teams(name, is_own_team)")
      .gte("event_date", today)
      .lte("event_date", addDays(today, 7))
      .order("event_date")
      .order("start_time", { nullsFirst: true }),
    supabase
      .from("practice_plans")
      .select("id, practice_date, start_time, focus, status, created_by, team:teams(name)")
      .gte("practice_date", today)
      .lte("practice_date", addDays(today, 14))
      .order("practice_date"),
    supabase
      .from("practice_plans")
      .select("id, practice_date, start_time, focus, status, created_by, team:teams(name)")
      .eq("created_by", user.id)
      .eq("status", "draft")
      .order("practice_date", { ascending: false })
      .limit(5),
  ]);
  const week = ((events ?? []) as unknown as EventRow[]).filter((e) => e.team?.is_own_team);
  const upcoming = (plans ?? []) as unknown as PlanRow[];
  const mine = (drafts ?? []) as unknown as PlanRow[];
  const when = (date: string, time: string | null) =>
    `${date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : formatDay(date)}${time ? ` · ${formatTime(time)}` : ""}`;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="This week">
          {week.length === 0 ? (
            <p className="text-sm text-muted">Nothing on the calendar for the next seven days.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {week.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-3">
                  <span className="w-40 font-display font-bold text-muted tabular-nums">{when(e.event_date, e.start_time)}</span>
                  <span className="font-semibold">{e.title || e.kind[0].toUpperCase() + e.kind.slice(1)}</span>
                  <span className="text-muted">{e.team?.name}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dugout/calendar" className="mt-3 inline-block text-sm text-pink hover:underline">
            Calendar →
          </Link>
        </Card>

        <Card title="Practice plans · next two weeks">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">No practice plans yet for the next two weeks.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {upcoming.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3">
                  <Link href={`/dugout/plans/${p.id}`} className="font-semibold hover:underline">
                    {when(p.practice_date, p.start_time)} · {p.focus ?? "Practice"}
                  </Link>
                  <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
                    {canEditPlanRole(user.staff.role, user.id, p.created_by) ? "Yours" : "View only"} · {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dugout/plans" className="mt-3 inline-block text-sm text-pink hover:underline">
            All practice plans →
          </Link>
        </Card>
      </div>

      {mine.length > 0 && (
        <Card title="Your drafts">
          <ul className="flex flex-col gap-2 text-sm">
            {mine.map((p) => (
              <li key={p.id}>
                <Link href={`/dugout/plans/${p.id}`} className="font-semibold hover:underline">
                  {formatDay(p.practice_date)} · {p.focus ?? "Practice"}
                </Link>{" "}
                <span className="text-muted">· {p.team?.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <DugoutCard role="assistant" />
    </>
  );
}
