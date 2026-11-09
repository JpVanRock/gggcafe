import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Disclosure, EmptyState, sectionLabelClass } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDay, todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/softball";
import { CONFIDENCE_LABEL, SCOUT_CATEGORY_LABEL } from "@/lib/playbook";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { PlaybookNav } from "../nav";
import { removeScoutReport } from "../actions";
import { ScoutNoteForm, ScoutingForm } from "../forms";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Scouting · Coaches Dugout · GGG.Cafe" };

type ReportRow = {
  id: string;
  subject_team_id: string;
  category: keyof typeof SCOUT_CATEGORY_LABEL;
  title: string;
  body: string;
  confidence: number | null;
  observed_on: string | null;
  created_at: string;
};

const CATEGORY_ORDER = ["team_overview", "hitter_tendencies", "pitcher_tendencies", "defense", "baserunning", "coaching_tendencies", "signs_and_signals", "other"] as const;

export default async function ScoutingPage({ searchParams }: PageProps<"/dugout/playbook/scouting">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam, opp } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const today = todayISO();

  // Every opponent's note count (one small column), but full notes only for the one picked.
  const [oppResult, countResult, reportResult, gameResult] = await Promise.all([
    supabase.from("teams").select("id, name").eq("is_own_team", false).order("name"),
    supabase.from("scouting_reports").select("subject_team_id"),
    isUuid(opp)
      ? supabase
          .from("scouting_reports")
          .select("id, subject_team_id, category, title, body, confidence, observed_on, created_at")
          .eq("subject_team_id", opp)
          .order("observed_on", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("games")
      .select("id, game_date, home_team_id, away_team_id, home:teams!home_team_id(name), away:teams!away_team_id(name)")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .order("game_date", { ascending: false })
      .limit(40),
  ]);
  const opponents = (oppResult.data ?? []) as { id: string; name: string }[];
  const reports = (reportResult.data ?? []) as ReportRow[];
  const games = ((gameResult.data ?? []) as { id: string; game_date: string; home_team_id: string; home: { name: string } | null; away: { name: string } | null }[]).map((g) => {
    const opponent = g.home_team_id === team.id ? g.away?.name : g.home?.name;
    return { id: g.id, opponent: opponent ?? "TBD", label: `${formatDay(g.game_date)} · ${g.home_team_id === team.id ? "vs" : "@"} ${opponent ?? "TBD"}` };
  });
  const count = new Map<string, number>();
  for (const r of (countResult.data ?? []) as { subject_team_id: string }[]) count.set(r.subject_team_id, (count.get(r.subject_team_id) ?? 0) + 1);
  const selected = opponents.find((o) => o.id === opp) ?? null;
  const theirs = selected ? reports.filter((r) => r.subject_team_id === selected.id) : [];
  const href = (id: string) => `/dugout/playbook/scouting?team=${team.id}&opp=${id}`;

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/playbook/scouting" />
      <PlaybookNav current="scouting" teamId={team.id} />

      {opponents.length === 0 ? (
        <EmptyState>
          Add opponents on the{" "}
          <Link href="/teams" className="text-pink hover:underline">
            Teams
          </Link>{" "}
          page first.
        </EmptyState>
      ) : (
        <>
          <nav aria-label="Opponents" className="flex flex-wrap gap-2">
            {opponents.map((o) => (
              <Link
                key={o.id}
                href={href(o.id)}
                aria-current={o.id === selected?.id ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1 text-sm font-semibold transition ${
                  o.id === selected?.id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
                }`}
              >
                {o.name}
                {count.get(o.id) ? <span className="ml-1.5 font-mono text-xs opacity-80">{count.get(o.id)}</span> : null}
              </Link>
            ))}
          </nav>

          {editor && (
            <Disclosure summary="Scouting checklist" open={!selected}>
              <p className="mb-4 text-sm text-muted">
                Fill in what you saw; blank prompts are skipped. Each answer is saved as a note on that opponent.
              </p>
              <ScoutingForm opponents={opponents} games={games} defaultOpponent={selected?.id ?? null} today={today} />
            </Disclosure>
          )}

          {selected && (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold tracking-wide text-highlight uppercase">{selected.name}</h2>
              {theirs.length === 0 ? (
                <EmptyState>No scouting on {selected.name} yet.</EmptyState>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {CATEGORY_ORDER.map((c) => {
                    const list = theirs.filter((r) => r.category === c);
                    if (list.length === 0) return null;
                    return (
                      <Card key={c} title={SCOUT_CATEGORY_LABEL[c]}>
                        <ul className="flex flex-col divide-y divide-navy-800">
                          {list.map((r) => (
                            <li key={r.id} className="py-2.5 text-sm">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="font-semibold text-ink">{r.title}</p>
                                {editor && (
                                  <ActionForm action={removeScoutReport}>
                                    <input type="hidden" name="id" value={r.id} />
                                    <ConfirmSubmit message={`Remove “${r.title}”?`} className="text-xs text-muted hover:text-danger">
                                      Remove
                                    </ConfirmSubmit>
                                  </ActionForm>
                                )}
                              </div>
                              <p className="mt-1 whitespace-pre-line text-ink/90">{r.body}</p>
                              <p className="mt-1 font-mono text-[11px] text-muted">
                                {[r.observed_on && formatDay(r.observed_on), r.confidence && CONFIDENCE_LABEL[r.confidence]].filter(Boolean).join(" · ")}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    );
                  })}
                </div>
              )}
              {editor && (
                <Disclosure summary={`Add a note on ${selected.name}`}>
                  <ScoutNoteForm opponentId={selected.id} today={today} />
                </Disclosure>
              )}
            </section>
          )}
          {!selected && <p className={sectionLabelClass}>Pick an opponent to read their report.</p>}
        </>
      )}
    </div>
  );
}
