import Link from "next/link";
import { Disclosure, EmptyState, tableClass, tdClass, thClass, TableScroll } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import { BATS_LABEL, POSITION_LABEL, THROWS_LABEL, batsThrows, type Player } from "@/lib/softball";
import { PlayerForm } from "../player-form";
import { MoveTeamForm, type MoveSeason, type MoveTeam } from "../move-form";
import { currentRostering, type MetricProgress, type PopReport } from "./data";
import { DetailHeading, MenuItem } from "./menu";
import { HittingSection, MovementSection, movementHeadline } from "./movement";
import type { StyleVersion } from "./data";
import type { HittingZones } from "@/lib/my-zone";
import { MyZoneSection } from "./my-zone";

function metricValue(m: MetricProgress, value: number | null) {
  return value === null ? "–" : `${Number(value)} ${m.unit}`;
}

/** "1.7 mph better", "0.15 sec better", "0.4 mph worse" (direction-aware) */
function changeLabel(m: MetricProgress) {
  if (m.improvement === null || m.measurements < 2) return "–";
  const amount = Math.abs(Number(m.improvement));
  if (amount === 0) return "No change";
  return `${amount} ${m.unit} ${Number(m.improvement) > 0 ? "better" : "worse"}`;
}

export function PopSummary({ player, pop, styles }: { player: Player; pop: PopReport; styles?: { movement: StyleVersion[] } }) {
  const moves = styles ? movementHeadline(styles.movement) : null;
  const team = currentRostering(pop);
  const latestMetrics = [...pop.metrics]
    .sort((a, b) => (b.latest_measured_on ?? "").localeCompare(a.latest_measured_on ?? ""))
    .slice(0, 2);
  return (
    <div className="flex flex-col gap-4">
      <MenuItem
        name="Position"
        value={player.primary_position ?? "–"}
        note={player.secondary_positions.length ? `Also ${player.secondary_positions.join(", ")}` : undefined}
      />
      <MenuItem name="Bats / Throws" value={batsThrows(player)} note={player.is_slapper ? "Slapper" : undefined} />
      <MenuItem name="Class of" value={player.grad_year ?? "–"} />
      {moves && <MenuItem name="Movement" note={moves} />}
      <MenuItem
        name="Team"
        value={team?.jersey_number ? `#${team.jersey_number}` : undefined}
        note={team?.team ? `${team.team.name}${team.season ? ` · ${team.season.name}` : ""}` : "Not on a roster"}
      />
      {latestMetrics.map((m) => (
        <MenuItem key={m.metric_key} name={m.metric_name} value={metricValue(m, m.latest_value)} />
      ))}
    </div>
  );
}

export function PopDetail({
  player,
  pop,
  canEdit,
  photoUrl,
  move,
  styles,
  canAct = canEdit,
  movementAccess = "open",
  measurements,
}: {
  player: Player;
  pop: PopReport;
  canEdit: boolean;
  /** Movement Preferences is G3 Advanced: "open" with it, "locked" (admins: a note) or "hidden" without */
  movementAccess?: "open" | "locked" | "hidden";
  /** Movement Preferences and Preferred Hitting Style, newest version first; My Zone */
  styles?: { movement: StyleVersion[]; hitting: StyleVersion[]; zone?: HittingZones | null };
  /** the player herself or a coach: can change her hitting style */
  canAct?: boolean;
  photoUrl?: string | null;
  /** coaches: teams and seasons to move her to */
  move?: { teams: MoveTeam[]; seasons: MoveSeason[] } | null;
  /** measurements by season (MeasurementsBySeason); without it, the latest/best table */
  measurements?: React.ReactNode;
}) {
  const facts: [string, string][] = [
    ["Position", player.primary_position ? `${player.primary_position} · ${POSITION_LABEL[player.primary_position]}` : "–"],
    ["Also plays", player.secondary_positions.length ? player.secondary_positions.join(", ") : "–"],
    ["Bats", player.bats ? BATS_LABEL[player.bats] : "–"],
    ["Throws", player.throws ? THROWS_LABEL[player.throws] : "–"],
    ["Class of", player.grad_year ? String(player.grad_year) : "–"],
    ["Born", player.birth_date ? formatLongDate(player.birth_date) : "–"],
    ["Slapper", player.is_slapper ? "Yes" : "No"],
  ];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <DetailHeading>Profile</DetailHeading>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {canEdit && player.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-ink/90">{player.notes}</p>}
      </section>

      {styles && movementAccess === "open" && <MovementSection playerId={player.id} versions={styles.movement} canManage={canEdit} />}
      {movementAccess === "locked" && (
        <p className="rounded-xl border border-dashed border-navy-600 px-4 py-3 text-sm text-muted">
          Movement Preferences is a G3 Advanced feature.{" "}
          <Link href={`/players/${player.id}`} className="text-link hover:underline">
            Unlock G3 Advanced on her menu
          </Link>{" "}
          to use it. Anything already saved is kept.
        </p>
      )}
      {styles && <HittingSection playerId={player.id} versions={styles.hitting} canAct={canAct} />}
      {styles && <MyZoneSection playerId={player.id} zones={styles.zone ?? null} canAct={canAct} />}

      <section>
        <DetailHeading>Teams</DetailHeading>
        {pop.rosters.length === 0 ? (
          <EmptyState>Not on any roster yet. Add them from a team&apos;s page.</EmptyState>
        ) : (
          <TableScroll label="Teams">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Season</th>
                  <th className={thClass}>Team</th>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pop.rosters.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>{r.season?.name ?? "–"}</td>
                    <td className={tdClass}>
                      {r.team ? (
                        <Link href={`/teams/${r.team.id}`} className="hover:underline">
                          {r.team.name}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className={tdClass}>{r.jersey_number ?? "–"}</td>
                    <td className={tdClass}>{r.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      {measurements ?? (
      <section>
        <DetailHeading>Measurements</DetailHeading>
        {pop.metrics.length === 0 ? (
          <EmptyState>No measurements yet (exit velo, pop time, home to first…).</EmptyState>
        ) : (
          <TableScroll label="Measurements">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Metric</th>
                  <th className={thClass}>Latest</th>
                  <th className={thClass}>Best</th>
                  <th className={thClass}>Change</th>
                  <th className={thClass}>Last measured</th>
                </tr>
              </thead>
              <tbody>
                {pop.metrics.map((m) => (
                  <tr key={m.metric_key}>
                    <td className={tdClass}>{m.metric_name}</td>
                    <td className={tdClass}>{metricValue(m, m.latest_value)}</td>
                    <td className={tdClass}>{metricValue(m, m.best_value)}</td>
                    <td className={`${tdClass} ${Number(m.improvement) > 0 ? "text-highlight" : ""}`}>
                      {changeLabel(m)}
                    </td>
                    <td className={tdClass}>{m.latest_measured_on ? formatLongDate(m.latest_measured_on) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
      )}

      {pop.evaluations.length > 0 && (
        <section>
          <DetailHeading>Coach ratings</DetailHeading>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pop.evaluations.map((e) => (
              <li key={e.area} className="rounded-lg border border-navy-700 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm capitalize">{e.area.replaceAll("_", " ")}</span>
                  <span className="font-mono text-highlight" aria-label={`${e.rating} out of 5`}>
                    {"●".repeat(e.rating)}
                    <span className="text-navy-600">{"●".repeat(5 - e.rating)}</span>
                  </span>
                </div>
                {e.comments && <p className="mt-1 text-xs text-muted">{e.comments}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <Disclosure summary="Edit profile">
          <PlayerForm player={player} photoUrl={photoUrl} />
        </Disclosure>
      )}
      {canEdit && move && (
        <Disclosure summary="Move to another team">
          <MoveTeamForm playerId={player.id} teams={move.teams} seasons={move.seasons} />
        </Disclosure>
      )}
    </div>
  );
}
