import type { Metadata } from "next";
import { canEdit, isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, EmptyState, tableClass, tdClass, thClass, TableScroll } from "@/components/ui";
import { StatTerm } from "@/components/stat-term";
import { formatDay, todayISO } from "@/lib/dates";
import { qabSummary } from "@/lib/box-score";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { TrainingNav } from "../nav";
import { loadTeamRoster } from "../data";
import { removeBpRound } from "../actions";
import { BpRoundForm } from "./bp-form";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "BP Rounds · Training · Coaches Dugout · GGG.Cafe" };

type Round = { id: string; player_id: string; round_date: string; grades: number[]; note: string | null };

export default async function BpPage({ searchParams }: PageProps<"/dugout/training/bp">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const roster = await loadTeamRoster(supabase, team.id);
  const { data } = roster.length
    ? await supabase
        .from("bp_rounds")
        .select("id, player_id, round_date, grades, note")
        .in("player_id", roster.map((p) => p.id))
        .order("round_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const rounds = (data ?? []) as Round[];
  const short = (id: string) => {
    const p = roster.find((r) => r.id === id);
    return p ? `${p.number ? `#${p.number} ` : ""}${p.name}` : "Player";
  };
  const totals = roster
    .map((p) => {
      const mine = rounds.filter((r) => r.player_id === p.id);
      return { ...p, rounds: mine.length, ...qabSummary(mine.flatMap((r) => r.grades)) };
    })
    .filter((p) => p.rounds > 0)
    .sort((a, b) => (b.production ?? 0) - (a.production ?? 0));

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/bp" />
      <TrainingNav current="bp" teamId={team.id} head={isHeadCoach(user.staff.role)} />
      <p className="text-sm text-muted">
        Grade every BP swing 0-5. A hitter&apos;s production average shows on her stats card, and the top five (20+ swings) on the team Leaderboard.
      </p>
      {editor && (
        <Card title="Grade a round">
          {roster.length ? <BpRoundForm players={roster.map((p) => ({ id: p.id, short: short(p.id) }))} today={todayISO()} /> : <EmptyState>No roster yet.</EmptyState>}
        </Card>
      )}
      {totals.length > 0 && (
        <Card title="Production by hitter (last 200 rounds)">
          <TableScroll label="Production by hitter">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Hitter</th>
                  <th className={thClass}>Rounds</th>
                  <th className={thClass}>Swings</th>
                  <th className={thClass}>
                    <StatTerm k="PROD" />
                  </th>
                  <th className={thClass}>3+ swings</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <tr key={t.id}>
                    <td className={tdClass}>{short(t.id)}</td>
                    <td className={`${tdClass} tabular-nums`}>{t.rounds}</td>
                    <td className={`${tdClass} tabular-nums`}>{t.graded}</td>
                    <td className={`${tdClass} font-semibold text-highlight tabular-nums`}>{t.production?.toFixed(2)}</td>
                    <td className={`${tdClass} tabular-nums`}>{t.qabPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}
      {rounds.length > 0 && (
        <Card title="Recent rounds">
          <ul className="flex flex-col divide-y divide-navy-800 text-sm">
            {rounds.slice(0, 30).map((r) => {
              const s = qabSummary(r.grades);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-semibold">{short(r.player_id)}</span>
                    <span className="ml-2 text-muted">
                      {formatDay(r.round_date)} · {s.graded} swings · {s.production?.toFixed(2)}
                      {r.note && ` · ${r.note}`}
                    </span>
                  </span>
                  {editor && (
                    <ActionForm action={removeBpRound}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit message="Remove this BP round?" className="text-xs text-muted hover:text-danger">
                        Remove
                      </ConfirmSubmit>
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
