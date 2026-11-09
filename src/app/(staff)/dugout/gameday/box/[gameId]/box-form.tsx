"use client";

// Box-score entry for one team in one game: batting, pitching and fielding lines, the
// final score, and an optional 0-5 grade on each plate appearance (quality at-bats).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, buttonClass, fieldClass, TableScroll } from "@/components/ui";
import {
  BATTING_COLUMNS, BATTING_LABEL, FIELDING_COLUMNS, FIELDING_LABEL, PITCHING_COLUMNS, PITCHING_LABEL, QAB_SCALE,
  boxProblems, emptyBatting, emptyFielding, ipLabel, parseIp,
  type BattingLine, type BoxScore, type FieldingLine, type PaGrade, type PitchingLine,
} from "@/lib/box-score";
import { saveBoxScore } from "../../actions";

// these small inputs set their own width (fieldClass has none)
const base = fieldClass;
const cell = `${base} w-11 px-1 py-1 text-center text-sm tabular-nums`;
const th = "px-0.5 pb-1 text-center font-mono text-2xs font-bold tracking-wider text-muted uppercase";

function Num({ value, onChange, label, max = 99 }: { value: number; onChange: (n: number) => void; label: string; max?: number }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value === 0 ? "" : value}
      placeholder="0"
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))))}
      className={cell}
    />
  );
}

type Player = { id: string; short: string };

export function BoxScoreForm({
  gameId,
  teamId,
  players,
  initial,
}: {
  gameId: string;
  teamId: string;
  players: Player[];
  initial: BoxScore;
}) {
  const router = useRouter();
  const name = new Map(players.map((p) => [p.id, p.short]));
  const [us, setUs] = useState<number | null>(initial.us);
  const [them, setThem] = useState<number | null>(initial.them);
  const [batting, setBatting] = useState<Record<string, BattingLine>>(() =>
    Object.fromEntries(players.map((p) => [p.id, initial.batting.find((b) => b.player_id === p.id) ?? emptyBatting(p.id)])),
  );
  const [fielding, setFielding] = useState<Record<string, FieldingLine>>(() =>
    Object.fromEntries(players.map((p) => [p.id, initial.fielding.find((f) => f.player_id === p.id) ?? emptyFielding(p.id)])),
  );
  const [pitching, setPitching] = useState<(PitchingLine & { ip: string })[]>(() => initial.pitching.map((p) => ({ ...p, ip: ipLabel(p.outs) })));
  const [grades, setGrades] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(initial.grades.map((g) => [`${g.player_id}:${g.pa_no}`, g.grade])),
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ error: string | null; saved: boolean }>({ error: null, saved: false });

  const setBat = (id: string, k: (typeof BATTING_COLUMNS)[number], n: number) => setBatting((b) => ({ ...b, [id]: { ...b[id], [k]: n } }));
  const setField = (id: string, k: (typeof FIELDING_COLUMNS)[number], n: number) => setFielding((f) => ({ ...f, [id]: { ...f[id], [k]: n } }));
  const setPitch = (i: number, patch: Partial<PitchingLine & { ip: string }>) => setPitching((list) => list.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  const gradeList: PaGrade[] = Object.entries(grades)
    .filter(([, g]) => g !== null)
    .map(([key, g]) => {
      const [player_id, n] = key.split(":");
      return { player_id, pa_no: Number(n), grade: g as number };
    })
    .filter((g) => g.pa_no <= (batting[g.player_id]?.pa ?? 0));
  const badIp = pitching.filter((p) => parseIp(p.ip) === null);
  const box: BoxScore = {
    us,
    them,
    batting: Object.values(batting),
    pitching: pitching.map(({ ip, ...p }) => ({ ...p, outs: parseIp(ip) ?? 0 })),
    fielding: Object.values(fielding),
    grades: gradeList,
  };
  const problems = [...boxProblems(box, (id) => name.get(id) ?? "Player"), ...badIp.map((p) => `${name.get(p.player_id)}: innings like 4.2 (4 innings, 2 outs).`)];
  const unpitched = players.filter((p) => !pitching.some((x) => x.player_id === p.id));

  function save() {
    setStatus({ error: null, saved: false });
    startTransition(async () => {
      const res = await saveBoxScore(gameId, teamId, JSON.stringify(box));
      setStatus({ error: res.error, saved: !res.error });
      if (!res.error) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Final score">
        <div className="flex items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Us
            <input type="number" min={0} max={99} value={us ?? ""} onChange={(e) => setUs(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))} className={`${cell} w-16 text-lg`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Them
            <input type="number" min={0} max={99} value={them ?? ""} onChange={(e) => setThem(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))} className={`${cell} w-16 text-lg`} />
          </label>
          <p className="pb-2 text-xs text-muted">Saving with both scores marks the game final.</p>
        </div>
      </Card>

      <Card title="Batting">
        <TableScroll label="Batting">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="pr-2 pb-1 text-left font-mono text-2xs font-bold tracking-wider text-muted uppercase">Player</th>
                {BATTING_COLUMNS.map((k) => (
                  <th key={k} className={th}>
                    {BATTING_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="py-0.5 pr-2 whitespace-nowrap">{p.short}</td>
                  {BATTING_COLUMNS.map((k) => (
                    <td key={k} className="px-0.5 py-0.5">
                      <Num value={batting[p.id][k]} onChange={(n) => setBat(p.id, k, n)} label={`${p.short} ${BATTING_LABEL[k]}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <Card title="Quality at-bats (optional)">
        <details className="mb-3 text-xs text-muted">
          <summary className="cursor-pointer font-semibold text-pink-soft">The 0-5 scale</summary>
          <ul className="mt-2 space-y-0.5">
            {QAB_SCALE.map((s) => (
              <li key={s.grade}>
                <span className="font-display font-bold text-ink">{s.grade}</span> {s.label}
              </li>
            ))}
          </ul>
          <p className="mt-1">3 or better is a quality at-bat.</p>
        </details>
        {players.filter((p) => batting[p.id].pa > 0).length === 0 ? (
          <p className="text-sm text-muted">Enter plate appearances above, then grade each one here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {players
              .filter((p) => batting[p.id].pa > 0)
              .map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 truncate">{p.short}</span>
                  {Array.from({ length: Math.min(15, batting[p.id].pa) }, (_, i) => i + 1).map((n) => {
                    const key = `${p.id}:${n}`;
                    return (
                      <select
                        key={n}
                        value={grades[key] ?? ""}
                        onChange={(e) => setGrades((g) => ({ ...g, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
                        aria-label={`${p.short}, plate appearance ${n}`}
                        className={`${base} w-14 px-1 py-1 text-center text-sm`}
                      >
                        <option value="">PA{n}</option>
                        {[5, 4, 3, 2, 1, 0].map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    );
                  })}
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card title="Pitching">
        {pitching.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="pr-2 pb-1 text-left font-mono text-2xs font-bold tracking-wider text-muted uppercase">Pitcher</th>
                  <th className={th}>IP</th>
                  {PITCHING_COLUMNS.map((k) => (
                    <th key={k} className={th}>
                      {PITCHING_LABEL[k]}
                    </th>
                  ))}
                  <th className={th}>Pitches</th>
                  <th className={th}>Strikes</th>
                  <th className={th}>Dec</th>
                  <th className={th}>GS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pitching.map((p, i) => (
                  <tr key={p.player_id}>
                    <td className="py-0.5 pr-2 whitespace-nowrap">{name.get(p.player_id)}</td>
                    <td className="px-0.5">
                      <input value={p.ip} onChange={(e) => setPitch(i, { ip: e.target.value })} aria-label="Innings pitched" placeholder="0.0" className={`${cell} w-14`} />
                    </td>
                    {PITCHING_COLUMNS.map((k) => (
                      <td key={k} className="px-0.5">
                        <Num value={p[k]} onChange={(n) => setPitch(i, { [k]: n })} label={`${PITCHING_LABEL[k]}`} max={200} />
                      </td>
                    ))}
                    <td className="px-0.5">
                      <Num value={p.pitches ?? 0} onChange={(n) => setPitch(i, { pitches: n || null })} label="Pitches" max={400} />
                    </td>
                    <td className="px-0.5">
                      <Num value={p.strikes ?? 0} onChange={(n) => setPitch(i, { strikes: n || null })} label="Strikes" max={400} />
                    </td>
                    <td className="px-0.5">
                      <select value={p.decision ?? ""} onChange={(e) => setPitch(i, { decision: (e.target.value || null) as PitchingLine["decision"] })} aria-label="Decision" className={`${base} px-1 py-1 text-sm`}>
                        <option value="">–</option>
                        <option value="W">W</option>
                        <option value="L">L</option>
                        <option value="S">S</option>
                      </select>
                    </td>
                    <td className="px-1 text-center">
                      <input type="checkbox" checked={p.starter} onChange={(e) => setPitch(i, { starter: e.target.checked })} aria-label="Started" className="accent-pink" />
                    </td>
                    <td className="px-1">
                      <button type="button" onClick={() => setPitching((list) => list.filter((_, k) => k !== i))} aria-label="Remove pitcher" className="text-muted hover:text-danger">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {unpitched.length > 0 && (
          <select
            value=""
            onChange={(e) =>
              e.target.value &&
              setPitching((list) => [
                ...list,
                { player_id: e.target.value, ip: "0.0", outs: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hbp: 0, hr: 0, wp: 0, pitches: null, strikes: null, decision: null, starter: list.length === 0 },
              ])
            }
            aria-label="Add a pitcher"
            className={`${base} w-60 px-2 py-1 text-sm`}
          >
            <option value="">+ Add a pitcher…</option>
            {unpitched.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short}
              </option>
            ))}
          </select>
        )}
      </Card>

      <Card title="Fielding">
        <TableScroll label="Fielding">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="pr-2 pb-1 text-left font-mono text-2xs font-bold tracking-wider text-muted uppercase">Player</th>
                {FIELDING_COLUMNS.map((k) => (
                  <th key={k} className={th}>
                    {FIELDING_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="py-0.5 pr-2 whitespace-nowrap">{p.short}</td>
                  {FIELDING_COLUMNS.map((k) => (
                    <td key={k} className="px-0.5 py-0.5">
                      <Num value={fielding[p.id][k]} onChange={(n) => setField(p.id, k, n)} label={`${p.short} ${FIELDING_LABEL[k]}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        <p className="mt-2 text-xs text-muted">PB, SBA (steals allowed) and CS (caught stealing) are for catchers.</p>
      </Card>

      <div className="flex flex-col gap-2">
        {problems.map((p) => (
          <p key={p} className="text-sm text-pink-soft">
            {p}
          </p>
        ))}
        <div className="flex items-center gap-4">
          <button type="button" onClick={save} disabled={pending || problems.length > 0} className={buttonClass}>
            {pending ? "Saving…" : "Save box score"}
          </button>
          {status.error && (
            <span role="alert" className="text-sm text-danger">
              {status.error}
            </span>
          )}
          {status.saved && <span className="text-sm font-semibold text-highlight">Saved.</span>}
        </div>
      </div>
    </div>
  );
}
