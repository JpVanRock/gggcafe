// How to Keep the Book, extra credit: a two-inning game she scores herself.
// Bayside Blaze (visitors) at Summit Storm (home), 15 batters, a walk-off in the
// bottom of the 2nd. This file holds the teams and the play-by-play only; the
// answer key lives in supabase/iq/scorebook-game.json and in the database
// (private.scorebook_game_key), which grades every play. The reward is a
// surprise: nothing on the site names it until it's earned.
// Type-only imports, so it runs in unit tests.
import type { BoxMarks } from "./scorebook";

export type Team = "V" | "H";

export const TEAMS: Record<Team, { name: string; short: string; lineup: { no: string; name: string }[] }> = {
  V: {
    name: "Bayside Blaze",
    short: "Blaze",
    lineup: [
      { no: "2", name: "Rivera, A." },
      { no: "14", name: "Okafor, J." },
      { no: "21", name: "Lindqvist, E." },
      { no: "8", name: "Nakamura, R." },
      { no: "17", name: "Delgado, S." },
      { no: "5", name: "Whitfield, C." },
      { no: "30", name: "Brennan, K." },
      { no: "11", name: "Patel, D." },
      { no: "6", name: "Moss, H." },
    ],
  },
  H: {
    name: "Summit Storm",
    short: "Storm",
    lineup: [
      { no: "1", name: "Castillo, B." },
      { no: "10", name: "Harper, Q." },
      { no: "23", name: "Yoon, M." },
      { no: "9", name: "Ferreira, L." },
      { no: "16", name: "Sato, A." },
      { no: "44", name: "Bishop, T." },
      { no: "12", name: "Vance, P." },
      { no: "3", name: "Ellis, N." },
      { no: "19", name: "Kowalski, R." },
    ],
  },
};

export type GameCall = { n: number; team: Team; inning: 1 | 2; batter: number; call: string[] };

/** The play-by-play, one plate appearance at a time. */
export const CALLS: GameCall[] = [
  { n: 1, team: "V", inning: 1, batter: 1, call: ["Leading off for the Blaze, #2 Ari Rivera.", "She lines the first pitch into left field for a single."] },
  { n: 2, team: "V", inning: 1, batter: 2, call: ["#14 Jo Okafor works a full count, then swings through strike three.", "Rivera holds at first."] },
  {
    n: 3,
    team: "V",
    inning: 1,
    batter: 3,
    call: ["#21 Emma Lindqvist drives one into the right-center gap and pulls into second with a double.", "Rivera never stops running and scores from first."],
  },
  {
    n: 4,
    team: "V",
    inning: 1,
    batter: 4,
    call: ["#8 Rei Nakamura grounds to the shortstop, who throws to first for the out.", "Lindqvist moves up to third on the throw."],
  },
  {
    n: 5,
    team: "V",
    inning: 1,
    batter: 5,
    call: ["#17 Sofia Delgado lifts a fly ball to center. The center fielder settles under it.", "Three outs. Lindqvist is left standing on third."],
  },
  { n: 6, team: "H", inning: 1, batter: 1, call: ["Leading off for the Storm, #1 Bree Castillo.", "Ball four. She walks."] },
  {
    n: 7,
    team: "H",
    inning: 1,
    batter: 2,
    call: [
      "#10 Quinn Harper hits a ground ball to the shortstop.",
      "She flips to the second baseman, who steps on second to force Castillo and fires to first in time to get Harper. Double play.",
    ],
  },
  { n: 8, team: "H", inning: 1, batter: 3, call: ["#23 Mina Yoon takes a pitch on the outside corner.", "Called strike three. The side is retired."] },
  { n: 9, team: "V", inning: 2, batter: 6, call: ["Top of the 2nd. #5 Cam Whitfield grounds to the second baseman, who throws to first. One out."] },
  { n: 10, team: "V", inning: 2, batter: 7, call: ["#30 Kat Brennan smokes a line drive right at the third baseman, who snags it in the air. Two outs."] },
  { n: 11, team: "V", inning: 2, batter: 8, call: ["#11 Dev Patel swings through strike three. Three outs."] },
  {
    n: 12,
    team: "H",
    inning: 2,
    batter: 4,
    call: ["Bottom of the 2nd, Storm down a run. #9 Lu Ferreira hits a routine grounder to short, but the shortstop boots it.", "Ferreira is safe at first."],
  },
  {
    n: 13,
    team: "H",
    inning: 2,
    batter: 5,
    call: ["#16 Aiko Sato squares and bunts. The third baseman fields it and throws to first for the out.", "Ferreira moves up to second."],
  },
  { n: 14, team: "H", inning: 2, batter: 6, call: ["#44 Tess Bishop singles to left field. Ferreira rounds third and scores.", "Tie game."] },
  {
    n: 15,
    team: "H",
    inning: 2,
    batter: 7,
    call: [
      "#12 Paige Vance drives a ball into the right-center gap.",
      "Bishop races around from first and scores standing up, and Vance pulls into second with a double.",
      "Ballgame. The Storm walk it off.",
    ],
  },
];

export const GAME_PLAYS = CALLS.length;
/** Batters scored right on the first try needed for a clean book (80%, the site's bar). */
export const CLEAN_BOOK = Math.ceil((GAME_PLAYS * 80) / 100);

export function boxId(team: Team, row: number, inning: number) {
  return `${team}${row}-${inning}`;
}

export function parseBoxId(id: string): { team: Team; row: number; inning: number } | null {
  const m = /^([VH])(\d)-(\d)$/.exec(id);
  return m ? { team: m[1] as Team, row: Number(m[2]), inning: Number(m[3]) } : null;
}

// ---------------------------------------------------------------------------
// Writing the play: tokens from the keypad, e.g. ["6", "4", "3", "DP"] -> "6-4-3 DP"
// ---------------------------------------------------------------------------

export const PLAY_TOKENS = ["K", "Kc", "F", "L", "E", "FC", "U", "DP", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function formatPlay(tokens: string[]): string {
  let out = "";
  let prev = "";
  for (const t of tokens) {
    if (/^[1-9]$/.test(t)) out += /^[1-9]$/.test(prev) ? `-${t}` : t;
    else if (t === "U") out += "U";
    else if (t === "DP") out += out ? " DP" : "DP";
    else out += out && !/[FLE]$/.test(out) ? ` ${t}` : t;
    prev = t;
  }
  return out;
}

/** The keypad tokens that write a play (for editing a box that already has one). */
export function parsePlay(play: string | undefined): string[] {
  if (!play) return [];
  const tokens: string[] = [];
  for (const part of play.trim().split(/\s+/)) {
    if (part === "DP" || part === "K" || part === "Kc" || part === "FC") {
      tokens.push(part);
      continue;
    }
    let rest = part;
    const prefix = /^[FLE]/.exec(rest);
    if (prefix) {
      tokens.push(prefix[0]);
      rest = rest.slice(1);
    }
    for (const ch of rest.replace(/-/g, "")) tokens.push(ch);
  }
  return tokens;
}

/** A box as the database compares it: only the marks she made. */
export function canonicalMarks(m: BoxMarks): BoxMarks {
  const out: BoxMarks = {};
  if (m.hit) out.hit = m.hit;
  if (m.reached) out.reached = m.reached;
  const play = m.play?.trim().replace(/\s+/g, " ");
  if (play) out.play = play;
  if (m.out) out.out = m.out;
  if (m.path) out.path = m.path;
  if (m.rbi && m.path === 4) out.rbi = m.rbi.trim().replace(/^#/, "");
  if (m.lastOut) out.lastOut = true;
  return out;
}

/** Boxes of runners still on base in a half-inning: reached, not out, not home, inning not over. */
export function runnersOn(book: Record<string, BoxMarks>, team: Team, inning: number): string[] {
  const half = Object.entries(book).filter(([id]) => {
    const p = parseBoxId(id);
    return p?.team === team && p.inning === inning;
  });
  if (half.some(([, m]) => m.lastOut)) return [];
  return half
    .filter(([, m]) => (m.path ?? 0) >= 1 && (m.path ?? 0) <= 3 && !m.out)
    .sort((a, b) => (b[1].path ?? 0) - (a[1].path ?? 0))
    .map(([id]) => id);
}

/** Runs per inning for each team, counted from the shaded diamonds. */
export function lineFromBook(book: Record<string, BoxMarks>): Record<Team, number[]> {
  const line: Record<Team, number[]> = { V: [0, 0], H: [0, 0] };
  for (const [id, m] of Object.entries(book)) {
    const p = parseBoxId(id);
    if (p && m.path === 4) line[p.team][p.inning - 1] += 1;
  }
  return line;
}
