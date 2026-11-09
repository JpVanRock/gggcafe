import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Disclosure, EmptyState, badgeClass, buttonClass, sectionLabelClass, type BadgeTone } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDay, todayISO } from "@/lib/dates";
import {
  INSTALL_CATEGORIES, INSTALL_CATEGORY_LABEL, INSTALL_STATUSES, INSTALL_STATUS_LABEL, STARTER_ITEMS,
  groupInstallItems, installPace, installProgress, type InstallCategory, type InstallIqTrack, type InstallStatus,
} from "@/lib/install";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { PlansNav } from "../plans-nav";
import { loadStarterInstall, removeInstallItem, setInstallStatus } from "./actions";
import { AddInstallItemForm } from "./forms";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Install Checklist · Coaches Dugout · GGG.Cafe" };

const IQ_LABEL: Record<InstallIqTrack, string> = {
  defense: "Defensive IQ",
  baserunning: "Baserunning IQ",
  offense: "Offense IQ",
  battery: "Battery IQ",
  position: "Position IQ",
};

/** not started → taught → repped → game-ready, getting brighter */
const STATUS_TONE: Record<InstallStatus, BadgeTone> = {
  not_started: "neutral",
  taught: "pink",
  repped: "pinkSolid",
  game_ready: "neon",
};

type ItemRow = {
  id: string;
  category: InstallCategory;
  group_name: string;
  title: string;
  status: InstallStatus;
  iq_track: InstallIqTrack | null;
  position: number;
  plans: { plan: { id: string; practice_date: string } | null }[];
};

type PlanRow = { id: string; practice_date: string; focus: string | null; installs: { item_id: string }[] };

function StatusControl({ item, editor }: { item: ItemRow; editor: boolean }) {
  if (!editor) {
    return <Badge tone={STATUS_TONE[item.status]}>{INSTALL_STATUS_LABEL[item.status]}</Badge>;
  }
  return (
    <ActionForm action={setInstallStatus} className="flex flex-wrap gap-1.5" aria-label={`Status of ${item.title}`}>
      <input type="hidden" name="id" value={item.id} />
      {INSTALL_STATUSES.map((s) => {
        const on = s === item.status;
        return (
          <button
            key={s}
            type="submit"
            name="status"
            value={s}
            aria-pressed={on}
            className={`${badgeClass(on ? STATUS_TONE[s] : "neutral", "md")} transition ${on ? "" : "hover:border-pink hover:text-ink"}`}
          >
            {INSTALL_STATUS_LABEL[s]}
          </button>
        );
      })}
    </ActionForm>
  );
}

export default async function InstallPage({ searchParams }: PageProps<"/dugout/plans/install">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const today = todayISO();

  const [itemsResult, gameResult, phaseResult] = await Promise.all([
    supabase
      .from("install_items")
      .select("id, category, group_name, title, status, iq_track, position, plans:install_item_plans(plan:practice_plans(id, practice_date))")
      .eq("team_id", team.id)
      .order("position"),
    supabase
      .from("games")
      .select("game_date")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .neq("status", "cancelled")
      .gte("game_date", today)
      .order("game_date")
      .limit(1),
    supabase.from("training_phases").select("starts_on").eq("team_id", team.id).eq("kind", "inseason").gte("starts_on", today).order("starts_on").limit(1),
  ]);
  const items = (itemsResult.data ?? []) as ItemRow[];
  const opener =
    ((gameResult.data ?? [])[0] as { game_date: string } | undefined)?.game_date ??
    ((phaseResult.data ?? [])[0] as { starts_on: string } | undefined)?.starts_on ??
    null;

  const [eventsResult, plansResult] = opener
    ? await Promise.all([
        supabase.from("team_events").select("event_date").eq("team_id", team.id).eq("kind", "practice").gte("event_date", today).lt("event_date", opener),
        supabase
          .from("practice_plans")
          .select("id, practice_date, focus, installs:install_item_plans(item_id)")
          .eq("team_id", team.id)
          .gte("practice_date", today)
          .lt("practice_date", opener)
          .order("practice_date"),
      ])
    : [{ data: [] }, { data: [] }];
  const upcomingPlans = (plansResult.data ?? []) as PlanRow[];
  const practiceDates = [
    ...((eventsResult.data ?? []) as { event_date: string }[]).map((e) => e.event_date),
    ...upcomingPlans.map((p) => p.practice_date),
  ];

  const progress = installProgress(items);
  const pace = installPace(today, opener, practiceDates, progress);
  const titleOf = new Map(items.map((i) => [i.id, i.title]));
  const situationGroups = [...new Set([...items, ...STARTER_ITEMS.map((s) => ({ ...s, group_name: s.group }))].filter((i) => i.category === "situation").map((i) => i.group_name))];

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/plans/install" />
      <PlansNav current="install" teamId={team.id} />

      <section className="rounded-2xl border border-navy-600 bg-navy-900/70 p-5">
        <h2 className={sectionLabelClass}>Road to opening day</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="font-display text-3xl font-bold text-highlight tabular-nums">{pace.days ?? "–"}</p>
            <p className="text-xs text-muted">{opener ? `days to ${formatDay(opener)}` : "No first game on the schedule yet"}</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-highlight tabular-nums">{pace.practices}</p>
            <p className="text-xs text-muted">practices on the calendar before then</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-highlight tabular-nums">{pace.toGo}</p>
            <p className="text-xs text-muted">items not game-ready</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-highlight tabular-nums">{pace.perPractice ?? "–"}</p>
            <p className="text-xs text-muted">to bring to game-ready each practice</p>
          </div>
        </div>
        {progress.total > 0 && (
          <div className="mt-4">
            <div className="flex h-2 overflow-hidden rounded-full bg-navy-800" aria-hidden>
              <div className="bg-neon" style={{ width: `${(progress.game_ready / progress.total) * 100}%` }} />
              <div className="bg-pink" style={{ width: `${(progress.repped / progress.total) * 100}%` }} />
              <div className="bg-pink/40" style={{ width: `${(progress.taught / progress.total) * 100}%` }} />
            </div>
            <p className="mt-2 font-mono text-xs text-muted">
              {progress.game_ready} game-ready · {progress.repped} repped · {progress.taught} taught · {progress.not_started} not started ({progress.readyPct}% ready)
            </p>
          </div>
        )}
        {opener && upcomingPlans.length > 0 && (
          <div className="mt-5">
            <h3 className={sectionLabelClass}>Preseason calendar</h3>
            <ol className="mt-2 divide-y divide-navy-700">
              {upcomingPlans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
                  <Link href={`/dugout/plans/${p.id}`} className="font-semibold text-pink-soft hover:underline">
                    {formatDay(p.practice_date)}
                  </Link>
                  <span className="text-ink/90">{p.focus ?? "Practice"}</span>
                  <span className="text-xs text-muted">
                    {p.installs.length
                      ? `Installs: ${p.installs.map((i) => titleOf.get(i.item_id)).filter(Boolean).join(" · ")}`
                      : "No installs picked yet"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">
          Pick what each practice installs on the practice plan (&ldquo;Installs this practice&rdquo;). Practices come from the Calendar and
          your plans; the first game comes from the team schedule (or the In-season phase on the Training roadmap).
        </p>
      </section>

      {items.length === 0 ? (
        <EmptyState>
          No install checklist yet.
          {editor && (
            <ActionForm action={loadStarterInstall} className="mt-3">
              <input type="hidden" name="team_id" value={team.id} />
              <button type="submit" className={buttonClass}>
                Load the starter checklist ({STARTER_ITEMS.length} items)
              </button>
            </ActionForm>
          )}
        </EmptyState>
      ) : (
        INSTALL_CATEGORIES.map((category) => {
          const groups = groupInstallItems(items.filter((i) => i.category === category).map((i) => ({ ...i, group: i.group_name })));
          if (groups.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="mb-3 text-xl font-bold tracking-wide text-highlight uppercase">{INSTALL_CATEGORY_LABEL[category]}</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {groups.map((g) => {
                  const ready = g.items.filter((i) => i.status === "game_ready").length;
                  return (
                    <article key={g.group} className="rounded-2xl border border-navy-700 bg-navy-900/70 p-4">
                      <header className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-lg font-bold text-ink">{g.group}</h3>
                        <span className="font-mono text-xs text-muted tabular-nums">
                          {ready}/{g.items.length} game-ready
                        </span>
                      </header>
                      <ul className="mt-2 divide-y divide-navy-800">
                        {g.items.map((item) => {
                          const plans = item.plans.map((p) => p.plan).filter((p): p is NonNullable<typeof p> => !!p).sort((a, b) => a.practice_date.localeCompare(b.practice_date));
                          return (
                            <li key={item.id} className="flex flex-col gap-1.5 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-ink">{item.title}</p>
                                {editor && (
                                  <ActionForm action={removeInstallItem}>
                                    <input type="hidden" name="id" value={item.id} />
                                    <ConfirmSubmit message={`Remove “${item.title}” from the checklist?`} className="text-xs text-muted hover:text-danger">
                                      Remove
                                    </ConfirmSubmit>
                                  </ActionForm>
                                )}
                              </div>
                              <StatusControl item={item} editor={editor} />
                              {(plans.length > 0 || item.iq_track) && (
                                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                                  {plans.map((p) => (
                                    <Link key={p.id} href={`/dugout/plans/${p.id}`} className="rounded border border-navy-600 px-1.5 py-px hover:border-pink hover:text-ink">
                                      {formatDay(p.practice_date)}
                                    </Link>
                                  ))}
                                  {item.iq_track && <span className="text-muted">Players can test it in {IQ_LABEL[item.iq_track]}</span>}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {editor && items.length > 0 && (
        <Disclosure summary="Add to the checklist">
          <AddInstallItemForm teamId={team.id} situationGroups={situationGroups} />
          {items.length < STARTER_ITEMS.length && (
            <ActionForm action={loadStarterInstall} className="mt-4">
              <input type="hidden" name="team_id" value={team.id} />
              <button type="submit" className="text-sm font-semibold text-pink-soft hover:underline">
                Add any starter items we don&apos;t have yet
              </button>
            </ActionForm>
          )}
        </Disclosure>
      )}
    </div>
  );
}
