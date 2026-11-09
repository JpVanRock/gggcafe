"use client";

// How to Keep the Book, extra credit: she keeps the book for a two-inning game.
// Each batter's call comes in, she marks the batter's box and every runner's box,
// and the database grades it. A clean book reveals a surprise (see
// src/lib/scorebook-game.ts); nothing here names it until it's earned.
import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass, fieldClass, inputClass, secondaryButtonClass, eyebrowClass } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { ScoreBox, ScoreSheet } from "@/components/scorebook";
import { WorldSeriesTrophy } from "@/components/world-series-trophy";
import { DYNASTY_TROPHY, DynastyTrophy } from "@/components/dynasty-trophy";
import type { BoxMarks } from "@/lib/scorebook";
import {
  CLEAN_BOOK, GAMES, GAME_COUNT, GAME_PLAYS, PLAY_TOKENS, boxId, canonicalMarks, formatPlay, parseBoxId, parsePlay, runnersOn, teamsOf,
  type Club, type Team,
} from "@/lib/scorebook-game";
import { finishScorebookGame, scoreGamePlay, startScorebookGame, type GameRun } from "./scorebook-actions";
import { confirmAction } from "@/components/confirm-submit";

type Draft = { marks: BoxMarks; tokens: string[] };
type View = "intro" | "play" | "line" | "result";

const BASES = ["–", "1st", "2nd", "3rd", "Home"];
const FIELD_NAME: Record<string, string> = {
  hit: "the hit (1 · 2 · 3 · HR)",
  reached: "BB · HP · SAC",
  play: "the play",
  out: "the out number",
  path: "how far she got",
  rbi: "the RBI number",
  lastOut: "the last-out slash",
  box: "that box",
};

function chip(on: boolean, flagged = false) {
  return `rounded-full border px-3 py-1 text-sm font-semibold transition disabled:opacity-40 ${
    on ? "border-pink bg-pink/20 text-ink" : flagged ? "border-pink/60 text-muted hover:border-pink" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
  }`;
}

function playerOf(id: string, teams: Record<Team, Club>) {
  const p = parseBoxId(id);
  if (!p) return null;
  const player = teams[p.team].lineup[p.row - 1];
  return { ...p, ...player, last: player.name.split(",")[0] };
}

function halfLabel(team: Team, inning: number) {
  return `${team === "V" ? "Top" : "Bottom"} of the ${inning === 1 ? "1st" : "2nd"}`;
}

function draftFrom(marks: BoxMarks | undefined): Draft {
  return { marks: { ...(marks ?? {}) }, tokens: parsePlay(marks?.play) };
}

/** One box she's writing in: circle, play, out, how far she got, RBI, slash. */
function BoxEditor({
  id,
  teams,
  role,
  draft,
  onChange,
  batterNo,
  flagged,
  disabled,
}: {
  id: string;
  teams: Record<Team, Club>;
  role: string;
  draft: Draft;
  onChange: (d: Draft) => void;
  batterNo: string;
  flagged: Set<string>;
  disabled: boolean;
}) {
  const who = playerOf(id, teams)!;
  const m = draft.marks;
  const set = (patch: Partial<BoxMarks>) => onChange({ ...draft, marks: { ...m, ...patch } });
  const setTokens = (tokens: string[]) => onChange({ tokens, marks: { ...m, play: formatPlay(tokens) || undefined } });
  const bad = (f: string) => flagged.has(f);
  const row = (label: string, field: string, children: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`w-16 shrink-0 font-mono text-2xs tracking-wider uppercase ${bad(field) ? "text-pink-soft" : "text-muted"}`}>
        {label}
        {bad(field) && " ●"}
      </span>
      {children}
    </div>
  );
  return (
    <section className={`rounded-xl border p-3 sm:p-4 ${flagged.size ? "border-pink/60" : "border-navy-600"}`} aria-label={`${who.last}'s box`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            #{who.no} {who.name}
          </p>
          <p className={eyebrowClass}>{role}</p>
        </div>
        <ScoreBox marks={canonicalMarks(m)} className="w-24 shrink-0 p-1.5" />
      </div>
      <fieldset disabled={disabled} className="mt-3 flex flex-col gap-2.5">
        {row(
          "Circle",
          flagged.has("hit") ? "hit" : "reached",
          <>
            {(["1", "2", "3", "HR"] as const).map((t, i) => (
              <button key={t} type="button" aria-pressed={m.hit === i + 1} onClick={() => set({ hit: m.hit === i + 1 ? undefined : ((i + 1) as BoxMarks["hit"]) })} className={chip(m.hit === i + 1)}>
                {t}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-navy-600" aria-hidden />
            {(["BB", "HP", "SAC"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={m.reached === t} onClick={() => set({ reached: m.reached === t ? undefined : t })} className={chip(m.reached === t)}>
                {t}
              </button>
            ))}
          </>,
        )}
        {row(
          "Play",
          "play",
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <output className="min-w-24 rounded-lg border border-navy-600 px-3 py-1 font-display text-xl font-bold text-highlight">
                {m.play === "Kc" ? <span className="inline-block -scale-x-100">K</span> : m.play || "–"}
              </output>
              <button type="button" onClick={() => setTokens(draft.tokens.slice(0, -1))} className="text-sm text-muted underline" aria-label="Delete the last mark">
                ⌫
              </button>
              {draft.tokens.length > 0 && (
                <button type="button" onClick={() => setTokens([])} className="text-xs text-muted underline">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Write the play">
              {PLAY_TOKENS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTokens([...draft.tokens, t])}
                  aria-label={t === "Kc" ? "backwards K" : t}
                  className="min-w-9 rounded-md border border-navy-600 px-2 py-1 font-display text-sm font-bold text-ink hover:border-pink"
                >
                  {t === "Kc" ? <span className="inline-block -scale-x-100">K</span> : t}
                </button>
              ))}
            </div>
          </div>,
        )}
        {row(
          "Out",
          "out",
          ([0, 1, 2, 3] as const).map((n) => (
            <button key={n} type="button" aria-pressed={(m.out ?? 0) === n} onClick={() => set({ out: n ? n : undefined })} className={chip((m.out ?? 0) === n)}>
              {n || "–"}
            </button>
          )),
        )}
        {row(
          "Got to",
          "path",
          BASES.map((b, n) => (
            <button
              key={b}
              type="button"
              aria-pressed={(m.path ?? 0) === n}
              onClick={() => set({ path: n || undefined, rbi: n === 4 ? m.rbi : undefined })}
              className={chip((m.path ?? 0) === n)}
            >
              {b}
            </button>
          )),
        )}
        {m.path === 4 &&
          row(
            "RBI",
            "rbi",
            <>
              <input
                value={m.rbi ?? ""}
                onChange={(e) => set({ rbi: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) || undefined })}
                inputMode="numeric"
                aria-label="Jersey number of the batter who drove her in"
                placeholder="#"
                className={`${fieldClass} w-20`}
              />
              <button type="button" onClick={() => set({ rbi: batterNo })} className={chip(m.rbi === batterNo)}>
                #{batterNo} (batter)
              </button>
            </>,
          )}
        {row(
          "Slash",
          "lastOut",
          <button type="button" aria-pressed={Boolean(m.lastOut)} onClick={() => set({ lastOut: !m.lastOut || undefined })} className={chip(Boolean(m.lastOut))}>
            Last out of the inning
          </button>,
        )}
      </fieldset>
    </section>
  );
}

export function GameRunner({
  playerId,
  game: n,
  initialRun,
  canEdit,
  found,
  gamesHref,
  nextHref,
  trophiesHref,
}: {
  playerId: string;
  game: number;
  initialRun: GameRun | null;
  canEdit: boolean;
  /** the surprises she's already found */
  found: { worldSeries: boolean; allTen: boolean };
  /** the list of games */
  gamesHref: string;
  /** the next game, when there is one */
  nextHref: string | null;
  trophiesHref: string;
}) {
  const game = GAMES[n - 1];
  const TEAMS = teamsOf(game);
  const CALLS = game.calls;
  const [run, setRun] = useState<GameRun | null>(initialRun);
  const [view, setView] = useState<View>("intro");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [feedback, setFeedback] = useState<{ correct: boolean; wrong: string[]; answer: Record<string, BoxMarks> | null } | null>(null);
  const [sheetTeam, setSheetTeam] = useState<Team>("V");
  const [line, setLine] = useState<Record<Team, string[]>>({ V: ["", ""], H: ["", ""] });
  const [lineWrong, setLineWrong] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; firstTry: number; awardEarned: boolean; allTenEarned: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // the batter on screen and the boxes she writes in, fixed until "Next batter"
  const [playN, setPlayN] = useState<number | null>(null);
  const [involved, setInvolved] = useState<string[]>([]);
  const call = playN ? CALLS[playN - 1] : null;
  const batter = call ? boxId(call.team, call.batter, call.inning) : null;

  function openPlay(r: GameRun) {
    const c = r.nextPlay <= GAME_PLAYS ? CALLS[r.nextPlay - 1] : null;
    setRun(r);
    setFeedback(null);
    if (!c) {
      setPlayN(null);
      setView("line");
      return;
    }
    const ids = [boxId(c.team, c.batter, c.inning), ...runnersOn(r.book, c.team, c.inning)];
    setPlayN(c.n);
    setInvolved(ids);
    setDrafts(Object.fromEntries(ids.map((id) => [id, draftFrom(r.book[id])])));
    setSheetTeam(c.team);
    setView("play");
  }

  function start(restart = false) {
    setError(null);
    startTransition(async () => {
      const res = await startScorebookGame({ playerId, game: n, restart });
      if (res.error || !res.run) return setError(res.error ?? "Couldn't start the game.");
      setLine({ V: ["", ""], H: ["", ""] });
      setResult(null);
      openPlay(res.run);
    });
  }

  function record() {
    if (!run || !call) return;
    setError(null);
    const boxes = Object.fromEntries(involved.map((id) => [id, canonicalMarks(drafts[id]?.marks ?? {})]));
    startTransition(async () => {
      const res = await scoreGamePlay({ playerId, runId: run.id, play: call.n, boxes });
      if (res.error) return setError(res.error);
      setFeedback({ correct: Boolean(res.correct), wrong: res.wrong ?? [], answer: res.answer ?? null });
      if (res.correct) {
        setRun({ ...run, book: { ...run.book, ...boxes }, nextPlay: res.nextPlay ?? run.nextPlay + 1, firstTry: res.firstTry ?? run.firstTry, tries: 0 });
      } else {
        setRun({ ...run, tries: run.tries + 1 });
      }
    });
  }

  function nextBatter() {
    if (run) openPlay(run);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finish() {
    if (!run) return;
    setError(null);
    const parsed = { V: line.V.map(Number), H: line.H.map(Number) };
    if ([...line.V, ...line.H].some((v) => v.trim() === "" || !/^\d{1,2}$/.test(v.trim()))) return setError("Fill in the runs for every inning (0 if none).");
    startTransition(async () => {
      const res = await finishScorebookGame({ playerId, runId: run.id, line: parsed });
      if (res.error) return setError(res.error);
      if (!res.lineOk) return setLineWrong(true);
      setLineWrong(false);
      setResult({
        passed: Boolean(res.passed),
        firstTry: res.firstTry ?? run.firstTry,
        awardEarned: Boolean(res.awardEarned),
        allTenEarned: Boolean(res.allTenEarned),
      });
      setView("result");
    });
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">
          How to Keep the Book · Game {n} of {GAME_COUNT}
        </p>
        <h2 className="mt-1 font-display text-3xl font-bold tracking-wide text-highlight uppercase">
          {TEAMS.V.short} at {TEAMS.H.short}
        </h2>
      </div>
      <Link href={gamesHref} className="text-sm text-link hover:underline">
        ← All games
      </Link>
    </div>
  );
  const errorLine = error && (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  );

  // ---- intro --------------------------------------------------------------------
  if (view === "intro") {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="rounded-xl border border-navy-600 bg-navy-950/50 p-5 sm:p-6">
          <p className="text-lg font-semibold">
            {TEAMS.V.name} at {TEAMS.H.name}. Two innings, {GAME_PLAYS} batters. You keep the book.
          </p>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink/90">
            <li>Each call comes in one batter at a time. Mark her box, and update the box of every runner on base.</li>
            <li>Record it and the book tells you if you got it right. Missed something? Fix it and record again.</li>
            <li>
              Keep a clean book: at least {CLEAN_BOOK} of {GAME_PLAYS} batters right on the first try, and the right final line score.
            </li>
          </ul>
          <p className="mt-4 font-mono text-xs tracking-widest text-pink-soft uppercase">
            {!found.worldSeries
              ? "A clean book unlocks something. That's all we're saying."
              : !found.allTen
                ? `Clean books in all ${GAME_COUNT} games? Something else is waiting.`
                : "You've found everything these games were hiding. Play any of them again."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => start()} disabled={!canEdit || pending} className={buttonClass}>
              {run ? `Resume · batter ${Math.min(run.nextPlay, GAME_PLAYS)} of ${GAME_PLAYS}` : "Play ball"}
            </button>
            {run && (
              <button
                type="button"
                onClick={async () => (await confirmAction("Start a new game? This book will be cleared.")) && start(true)}
                disabled={!canEdit || pending}
                className="text-xs text-muted underline hover:text-ink"
              >
                Start over
              </button>
            )}
          </div>
          {!canEdit && <p className="mt-2 text-xs text-muted">Viewers can look; the player or a coach keeps the book.</p>}
        </div>
        {errorLine}
      </div>
    );
  }

  // ---- result -------------------------------------------------------------------
  if (view === "result" && result && run) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        {result.passed && (result.allTenEarned || result.awardEarned) ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-neon bg-neon/10 p-6 text-center">
            <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">
              Clean book · {result.firstTry} of {GAME_PLAYS} first try
            </p>
            {result.allTenEarned ? <DynastyTrophy size={240} /> : <WorldSeriesTrophy size={240} />}
            <p className="font-display text-3xl font-bold tracking-wide text-highlight uppercase">
              {result.allTenEarned ? DYNASTY_TROPHY : "GGG World Series Trophy"}
            </p>
            <p className="max-w-md text-sm">
              {result.allTenEarned
                ? `Ten games, ten clean books. Nobody keeps a better book than you. The ${DYNASTY_TROPHY} is in your Trophy Room.`
                : "You kept the book for a full game without losing the thread. That's a scorekeeper. The trophy is in your Trophy Room."}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link href={trophiesHref} className={buttonClass}>
                See the Trophy Room
              </Link>
              {nextHref && (
                <Link href={nextHref} className={secondaryButtonClass}>
                  Game {n + 1} →
                </Link>
              )}
            </div>
          </div>
        ) : result.passed ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-neon bg-neon/10 p-6 text-center">
            <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">Game {n} · clean book</p>
            <p className="text-4xl font-bold text-highlight tabular-nums">
              {result.firstTry}/{GAME_PLAYS}
            </p>
            <p className="max-w-md text-sm">
              {nextHref ? `Right on the first try, and the line score checks out. Game ${n + 1} is open.` : "Right on the first try, and the line score checks out."}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {nextHref && (
                <Link href={nextHref} className={buttonClass}>
                  Game {n + 1} →
                </Link>
              )}
              <Link href={gamesHref} className={secondaryButtonClass}>
                All games
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-pink/60 bg-pink/5 p-6 text-center">
            <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">Book complete</p>
            <p className="mt-2 text-4xl font-bold text-highlight tabular-nums">
              {result.firstTry}/{GAME_PLAYS}
            </p>
            <p className="mt-2 text-sm">
              Right on the first try. A clean book takes {CLEAN_BOOK}. Something&apos;s still waiting for it.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => start()} disabled={pending} className={buttonClass}>
                Play it again
              </button>
              <Link href={gamesHref} className={secondaryButtonClass}>
                All games
              </Link>
            </div>
          </div>
        )}
        {errorLine}
      </div>
    );
  }

  if (!run) return null;

  // ---- the book (both pages), with her current marks drawn in --------------------
  const preview: Record<string, BoxMarks> = { ...run.book };
  if (view === "play" && !feedback?.correct) for (const id of involved) preview[id] = canonicalMarks(drafts[id]?.marks ?? {});
  const sheetFor = (team: Team) => ({
    kind: "sheet" as const,
    innings: 2,
    lineup: TEAMS[team].lineup,
    cells: Object.fromEntries(
      Object.entries(preview)
        .map(([id, m]) => [parseBoxId(id), m] as const)
        .filter(([p]) => p?.team === team)
        .map(([p, m]) => [`${p!.row}-${p!.inning}`, m]),
    ),
    highlight: call && call.team === team && view === "play" ? { cell: [call.batter, call.inning] as [number, number] } : undefined,
  });
  const book = (
    <div>
      <div className="mb-2 flex gap-2" role="tablist" aria-label="Team pages">
        {(["V", "H"] as Team[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={sheetTeam === t} onClick={() => setSheetTeam(t)} className={chip(sheetTeam === t)}>
            {TEAMS[t].name}
          </button>
        ))}
      </div>
      <ScoreSheet spec={sheetFor(sheetTeam)} />
    </div>
  );
  const status = (
    <ProgressBar
      value={Math.min(run.nextPlay - 1, GAME_PLAYS)}
      max={GAME_PLAYS}
      label={`${Math.min(run.nextPlay - 1, GAME_PLAYS)} of ${GAME_PLAYS} batters scored · ${run.firstTry} first try`}
    />
  );

  // ---- line score ------------------------------------------------------------------
  if (view === "line") {
    const total = (t: Team) => line[t].reduce((n, v) => n + (Number(v) || 0), 0);
    return (
      <div className="flex flex-col gap-5">
        {header}
        {status}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-navy-600 bg-navy-950/50 p-5">
            <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">Ballgame</p>
            <p className="mt-1 text-lg font-semibold">Fill in the line score from your book.</p>
            <p className="mt-1 text-sm text-muted">Count the shaded diamonds in each inning column, on each team&apos;s page.</p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-2xs tracking-wider text-muted uppercase">
                  <th className="py-1 font-normal">Team</th>
                  <th className="w-16 py-1 text-center font-normal">1</th>
                  <th className="w-16 py-1 text-center font-normal">2</th>
                  <th className="w-12 py-1 text-center font-normal">R</th>
                </tr>
              </thead>
              <tbody>
                {(["V", "H"] as Team[]).map((t) => (
                  <tr key={t}>
                    <td className="py-1.5 font-semibold">{TEAMS[t].name}</td>
                    {[0, 1].map((i) => (
                      <td key={i} className="px-1 py-1.5">
                        <input
                          value={line[t][i]}
                          onChange={(e) => setLine({ ...line, [t]: line[t].map((v, k) => (k === i ? e.target.value.replace(/[^0-9]/g, "").slice(0, 2) : v)) })}
                          inputMode="numeric"
                          aria-label={`${TEAMS[t].name} runs, inning ${i + 1}`}
                          className={`${inputClass} text-center`}
                        />
                      </td>
                    ))}
                    <td className="py-1.5 text-center font-display text-lg font-bold text-highlight tabular-nums">{total(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lineWrong && <p className="mt-3 text-sm text-pink-soft">That doesn&apos;t match the book. Recount the shaded diamonds, inning by inning.</p>}
            <button type="button" onClick={finish} disabled={!canEdit || pending} className={`${buttonClass} mt-4`}>
              {pending ? "Checking…" : "Final"}
            </button>
            <div className="mt-2">{errorLine}</div>
          </div>
          {book}
        </div>
      </div>
    );
  }

  // ---- a batter ----------------------------------------------------------------------
  if (!call || !batter) return null;
  const batterNo = TEAMS[call.team].lineup[call.batter - 1].no;
  const wrongBy = new Map<string, Set<string>>();
  for (const w of feedback && !feedback.correct ? feedback.wrong : []) {
    const [id, field] = w.split(":");
    wrongBy.set(id, (wrongBy.get(id) ?? new Set()).add(field));
  }
  const endedHalf = feedback?.correct && involved.some((id) => run.book[id]?.lastOut);
  const lastBatter = feedback?.correct && run.nextPlay > GAME_PLAYS;
  return (
    <div className="flex flex-col gap-5">
      {header}
      {status}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-navy-600 bg-navy-950/50 p-4 sm:p-5">
            <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">
              {halfLabel(call.team, call.inning)} · {TEAMS[call.team].name} batting · batter {call.n} of {GAME_PLAYS}
            </p>
            {call.call.map((line, i) => (
              <p key={i} className={`mt-2 ${i === 0 ? "text-lg font-semibold" : "text-ink/90"}`}>
                {line}
              </p>
            ))}
          </div>

          {feedback?.correct ? (
            <div className="rounded-xl border border-neon bg-neon/10 p-4" aria-live="polite">
              <p className="font-bold text-highlight">In the book.</p>
              <p className="mt-1 text-sm">
                {lastBatter
                  ? "That's the ballgame. Time for the line score."
                  : endedHalf
                    ? `Three outs. Turn to the ${TEAMS[call.team === "V" ? "H" : "V"].name} page.`
                    : "Next batter's up."}
              </p>
              <button type="button" onClick={nextBatter} className={`${buttonClass} mt-3`}>
                {lastBatter ? "Line score →" : "Next batter →"}
              </button>
            </div>
          ) : (
            <>
              {involved.map((id) => (
                <BoxEditor
                  key={id}
                  id={id}
                  teams={TEAMS}
                  role={id === batter ? "Batting" : `Runner · was on ${BASES[run.book[id]?.path ?? 0]}`}
                  draft={drafts[id] ?? draftFrom(undefined)}
                  onChange={(d) => setDrafts({ ...drafts, [id]: d })}
                  batterNo={batterNo}
                  flagged={wrongBy.get(id) ?? new Set()}
                  disabled={!canEdit || pending}
                />
              ))}
              {feedback && !feedback.correct && (
                <div className="rounded-xl border border-pink/60 bg-pink/5 p-4 text-sm" aria-live="polite">
                  <p className="font-bold text-pink-soft">Not quite. This batter won&apos;t count as first try.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {[...wrongBy].map(([id, fields]) => (
                      <li key={id}>
                        Check {playerOf(id, TEAMS) ? `${playerOf(id, TEAMS)!.last}'s box` : "the book"}: {[...fields].map((f) => FIELD_NAME[f] ?? f).join(", ")}.
                      </li>
                    ))}
                  </ul>
                  {feedback.answer && (
                    <div className="mt-3">
                      <p>Here&apos;s how it&apos;s scored. Copy it into the book and record it.</p>
                      <button
                        type="button"
                        onClick={() => setDrafts(Object.fromEntries(involved.map((id) => [id, draftFrom(feedback.answer![id])])))}
                        className={`${secondaryButtonClass} mt-2`}
                      >
                        Show me
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button type="button" onClick={record} disabled={!canEdit || pending} className={`${buttonClass} self-start`}>
                {pending ? "Checking…" : "Record it"}
              </button>
            </>
          )}
          {errorLine}
        </div>
        {book}
      </div>
    </div>
  );
}
