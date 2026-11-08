// How to Keep the Book, extra credit: games she scores herself. Ten two-inning
// games between six made-up teams, 15 batters each. This file holds the league
// and the play-by-play only; the answer keys live in
// supabase/iq/scorebook-games.json and in the database (private.scorebook_game_key),
// which grades every play. Rewards are surprises: nothing on the site names them
// until they're earned (a clean book in any game, then clean books in all ten).
// Type-only imports, so it runs in unit tests.
import type { BoxMarks } from "./scorebook";

/** Box ids use V for the visiting team and H for the home team in each game. */
export type Team = "V" | "H";
export type TeamId = "blaze" | "storm" | "rockets" | "lightning" | "comets" | "heat";
export type Club = { name: string; short: string; lineup: { no: string; name: string }[] };

const lineup = (...players: [string, string][]) => players.map(([no, name]) => ({ no, name }));

export const LEAGUE: Record<TeamId, Club> = {
  blaze: {
    name: "Bayside Blaze",
    short: "Blaze",
    lineup: lineup(["2", "Rivera, A."], ["14", "Okafor, J."], ["21", "Lindqvist, E."], ["8", "Nakamura, R."], ["17", "Delgado, S."], ["5", "Whitfield, C."], ["30", "Brennan, K."], ["11", "Patel, D."], ["6", "Moss, H."]),
  },
  storm: {
    name: "Summit Storm",
    short: "Storm",
    lineup: lineup(["1", "Castillo, B."], ["10", "Harper, Q."], ["23", "Yoon, M."], ["9", "Ferreira, L."], ["16", "Sato, A."], ["44", "Bishop, T."], ["12", "Vance, P."], ["3", "Ellis, N."], ["19", "Kowalski, R."]),
  },
  rockets: {
    name: "Riverside Rockets",
    short: "Rockets",
    lineup: lineup(["4", "Bell, A."], ["13", "Navarro, G."], ["20", "Okoro, T."], ["7", "Lindgren, M."], ["33", "Price, J."], ["15", "Tanaka, E."], ["2", "Dubois, C."], ["18", "Monroe, K."], ["9", "Quinn, L."]),
  },
  lightning: {
    name: "Lakeshore Lightning",
    short: "Lightning",
    lineup: lineup(["1", "Hart, S."], ["11", "Alvarez, N."], ["24", "Osei, R."], ["5", "Fontaine, J."], ["17", "Mendez, I."], ["8", "Carver, D."], ["22", "Ivanova, P."], ["3", "Walsh, B."], ["14", "Greene, M."]),
  },
  comets: {
    name: "Canyon Comets",
    short: "Comets",
    lineup: lineup(["6", "Reed, T."], ["12", "Sorensen, K."], ["21", "Abara, N."], ["10", "Calloway, J."], ["27", "Marsh, E."], ["4", "Duarte, R."], ["19", "Fischer, H."], ["31", "Nwosu, A."], ["2", "Pike, L."]),
  },
  heat: {
    name: "Harbor Heat",
    short: "Heat",
    lineup: lineup(["9", "Santos, M."], ["16", "Holt, R."], ["23", "Achebe, Z."], ["44", "Lund, K."], ["7", "Barros, F."], ["12", "Wren, A."], ["30", "Ito, S."], ["5", "Costa, V."], ["21", "Dale, P."]),
  },
};

export type GameCall = { n: number; team: Team; inning: 1 | 2; batter: number; call: string[] };
export type Game = { n: number; visitors: TeamId; home: TeamId; calls: GameCall[] };

/** Builds a game's calls: [team, inning, lineup spot, lines of the call]. Batter numbers count from 1. */
function calls(list: [Team, 1 | 2, number, ...string[]][]): GameCall[] {
  return list.map(([team, inning, batter, ...call], i) => ({ n: i + 1, team, inning, batter, call }));
}

export const GAMES: Game[] = [
  {
    n: 1,
    visitors: "blaze",
    home: "storm",
    calls: calls([
      ["V", 1, 1, "Leading off for the Blaze, #2 Ari Rivera.", "She lines the first pitch into left field for a single."],
      ["V", 1, 2, "#14 Jo Okafor works a full count, then swings through strike three.", "Rivera holds at first."],
      ["V", 1, 3, "#21 Emma Lindqvist drives one into the right-center gap and pulls into second with a double.", "Rivera never stops running and scores from first."],
      ["V", 1, 4, "#8 Rei Nakamura grounds to the shortstop, who throws to first for the out.", "Lindqvist moves up to third on the throw."],
      ["V", 1, 5, "#17 Sofia Delgado lifts a fly ball to center. The center fielder settles under it.", "Three outs. Lindqvist is left standing on third."],
      ["H", 1, 1, "Leading off for the Storm, #1 Bree Castillo.", "Ball four. She walks."],
      [
        "H", 1, 2,
        "#10 Quinn Harper hits a ground ball to the shortstop.",
        "She flips to the second baseman, who steps on second to force Castillo and fires to first in time to get Harper. Double play.",
      ],
      ["H", 1, 3, "#23 Mina Yoon takes a pitch on the outside corner.", "Called strike three. The side is retired."],
      ["V", 2, 6, "Top of the 2nd. #5 Cam Whitfield grounds to the second baseman, who throws to first. One out."],
      ["V", 2, 7, "#30 Kat Brennan smokes a line drive right at the third baseman, who snags it in the air. Two outs."],
      ["V", 2, 8, "#11 Dev Patel swings through strike three. Three outs."],
      ["H", 2, 4, "Bottom of the 2nd, Storm down a run. #9 Lu Ferreira hits a routine grounder to short, but the shortstop boots it.", "Ferreira is safe at first."],
      ["H", 2, 5, "#16 Aiko Sato squares and bunts. The third baseman fields it and throws to first for the out.", "Ferreira moves up to second."],
      ["H", 2, 6, "#44 Tess Bishop singles to left field. Ferreira rounds third and scores.", "Tie game."],
      [
        "H", 2, 7,
        "#12 Paige Vance drives a ball into the right-center gap.",
        "Bishop races around from first and scores standing up, and Vance pulls into second with a double.",
        "Ballgame. The Storm walk it off.",
      ],
    ]),
  },
  {
    n: 2,
    visitors: "rockets",
    home: "lightning",
    calls: calls([
      ["V", 1, 1, "Leading off for the Rockets, #4 Addie Bell turns on the first pitch.", "It sails over the left-field fence. Home run."],
      ["V", 1, 2, "#13 Gabi Navarro grounds to second. The throw to first beats her."],
      ["V", 1, 3, "#20 Tobi Okoro works a walk."],
      ["V", 1, 4, "#7 Maddie Lindgren grounds to short. The shortstop flips to second to force Okoro.", "No time for the throw to first: Lindgren is safe."],
      ["V", 1, 5, "#33 Jules Price flies out to right field. Three outs."],
      ["H", 1, 1, "Bottom of the 1st. #1 Sage Hart lines a single into center."],
      ["H", 1, 2, "#11 Nina Alvarez bunts back to the pitcher, who throws to first for the out.", "Hart moves up to second."],
      ["H", 1, 3, "#24 Rae Osei doubles down the left-field line.", "Hart scores."],
      ["H", 1, 4, "#5 Josie Fontaine strikes out swinging. Osei stays at second."],
      ["H", 1, 5, "#17 Izzy Mendez grounds to third, and the throw to first is in time. Three outs."],
      ["V", 2, 6, "Top of the 2nd. #15 Emi Tanaka is caught looking at strike three."],
      ["V", 2, 7, "#2 Celine Dubois singles to right."],
      ["V", 2, 8, "#18 Kai Monroe lines one right at the shortstop. Two outs. Dubois holds."],
      ["V", 2, 9, "#9 Lexi Quinn flies out to left. Three outs."],
      ["H", 2, 6, "Bottom of the 2nd, tie game. #8 Dani Carver hammers the first pitch over the center-field wall.", "Walk-off home run. The Lightning win it."],
    ]),
  },
  {
    n: 3,
    visitors: "comets",
    home: "heat",
    calls: calls([
      ["V", 1, 1, "#6 Tia Reed leads off with a double into the left-center gap."],
      ["V", 1, 2, "#12 Kaia Sorensen grounds to second and is thrown out at first.", "Reed moves up to third."],
      ["V", 1, 3, "#21 Nia Abara lifts a deep fly ball to center. It's caught.", "Reed tags up and scores."],
      ["V", 1, 4, "#10 Jaz Calloway strikes out swinging. Three outs."],
      ["H", 1, 1, "Bottom of the 1st. #9 Mari Santos strikes out swinging."],
      ["H", 1, 2, "#16 Remi Holt flies out to right."],
      ["H", 1, 3, "#23 Zara Achebe grounds to third, and the throw to first gets her. Three up, three down."],
      ["V", 2, 5, "Top of the 2nd. #27 Ellie Marsh singles up the middle."],
      ["V", 2, 6, "#4 Rosa Duarte bunts. The pitcher fields it and throws to first.", "Marsh moves up to second."],
      ["V", 2, 7, "#19 Hana Fischer singles to center, and Marsh scores."],
      [
        "V", 2, 8,
        "#31 Ada Nwosu grounds to the second baseman.",
        "She throws to the shortstop covering second to force Fischer, and the relay to first gets Nwosu. Double play.",
      ],
      ["H", 2, 4, "Bottom of the 2nd, Heat down two. #44 Kit Lund launches one over the left-field fence. Home run."],
      ["H", 2, 5, "#7 Flor Barros takes a called third strike."],
      ["H", 2, 6, "#12 Abby Wren flies out to center."],
      ["H", 2, 7, "#30 Saki Ito grounds to second and is thrown out at first.", "Ballgame. The Comets hang on."],
    ]),
  },
  {
    n: 4,
    visitors: "storm",
    home: "rockets",
    calls: calls([
      ["V", 1, 1, "#1 Bree Castillo is hit by a pitch and takes first."],
      [
        "V", 1, 2,
        "#10 Quinn Harper grounds to the shortstop.",
        "Shortstop to the second baseman to force Castillo, then on to first to get Harper. Double play.",
      ],
      ["V", 1, 3, "#23 Mina Yoon flies out to center. Three outs."],
      ["H", 1, 1, "Bottom of the 1st. #4 Addie Bell drives one into the right-field corner and slides into third.", "A triple."],
      ["H", 1, 2, "#13 Gabi Navarro grounds to short. The throw to first gets her.", "Bell scores from third."],
      ["H", 1, 3, "#20 Tobi Okoro lines out to the second baseman."],
      ["H", 1, 4, "#7 Maddie Lindgren strikes out swinging. Three outs."],
      ["V", 2, 4, "Top of the 2nd. #9 Lu Ferreira singles to left."],
      ["V", 2, 5, "#16 Aiko Sato rips a triple into the right-center gap.", "Ferreira scores. Tie game."],
      ["V", 2, 6, "#44 Tess Bishop flies out deep to right. Sato tags up and scores.", "Storm lead."],
      ["V", 2, 7, "#12 Paige Vance takes a called third strike."],
      ["V", 2, 8, "#3 Nora Ellis grounds to first. The first baseman steps on the bag herself. Three outs."],
      ["H", 2, 5, "Bottom of the 2nd, Rockets down one. #33 Jules Price flies out to left."],
      ["H", 2, 6, "#15 Emi Tanaka grounds to third and is thrown out at first."],
      ["H", 2, 7, "#2 Celine Dubois flies out to center.", "Ballgame. The Storm win it."],
    ]),
  },
  {
    n: 5,
    visitors: "lightning",
    home: "blaze",
    calls: calls([
      ["V", 1, 1, "#1 Sage Hart hits a ground ball to the second baseman, who lets it skip under her glove.", "Hart is safe at first on the error."],
      ["V", 1, 2, "#11 Nina Alvarez singles to right. Hart moves up to second."],
      ["V", 1, 3, "#24 Rae Osei singles to left. Hart scores, and Alvarez goes to second."],
      [
        "V", 1, 4,
        "#5 Josie Fontaine grounds to the shortstop.",
        "Shortstop to the second baseman to force Osei, then on to first. Double play. Alvarez moves up to third.",
      ],
      ["V", 1, 5, "#17 Izzy Mendez flies out to right. Three outs. Alvarez is stranded at third."],
      ["H", 1, 1, "Bottom of the 1st. #2 Ari Rivera is caught looking at strike three."],
      ["H", 1, 2, "#14 Jo Okafor lines out to the third baseman."],
      ["H", 1, 3, "#21 Emma Lindqvist grounds to second and is thrown out. Three outs."],
      ["V", 2, 6, "Top of the 2nd. #8 Dani Carver flies out to center."],
      ["V", 2, 7, "#22 Pia Ivanova strikes out swinging."],
      ["V", 2, 8, "#3 Brynn Walsh grounds to short and is thrown out. Three outs."],
      ["H", 2, 4, "Bottom of the 2nd, Blaze down one. #8 Rei Nakamura walks."],
      ["H", 2, 5, "#17 Sofia Delgado is hit by a pitch. Nakamura moves up to second."],
      ["H", 2, 6, "#5 Cam Whitfield strikes out swinging. The runners hold."],
      [
        "H", 2, 7,
        "#30 Kat Brennan drives a ball into the left-center gap.",
        "Nakamura scores, Delgado scores all the way from first, and Brennan stands on second with a double.",
        "The Blaze walk it off.",
      ],
    ]),
  },
  {
    n: 6,
    visitors: "heat",
    home: "comets",
    calls: calls([
      ["V", 1, 1, "#9 Mari Santos singles to left."],
      ["V", 1, 2, "#16 Remi Holt flies out to left. Santos holds."],
      ["V", 1, 3, "#23 Zara Achebe crushes one over the right-field fence.", "A two-run home run."],
      ["V", 1, 4, "#44 Kit Lund strikes out swinging."],
      ["V", 1, 5, "#7 Flor Barros grounds to third and is thrown out at first. Three outs."],
      ["H", 1, 1, "Bottom of the 1st. #6 Tia Reed doubles down the left-field line."],
      ["H", 1, 2, "#12 Kaia Sorensen singles to right. Reed stops at third."],
      [
        "H", 1, 3,
        "#21 Nia Abara grounds to the second baseman, who throws to the shortstop covering second to force Sorensen.",
        "No play at first, so Abara is safe. Reed scores from third.",
      ],
      ["H", 1, 4, "#10 Jaz Calloway lines out to the shortstop. Abara holds."],
      ["H", 1, 5, "#27 Ellie Marsh flies out to right. Three outs."],
      ["V", 2, 6, "Top of the 2nd. #12 Abby Wren takes a called third strike."],
      ["V", 2, 7, "#30 Saki Ito grounds to second and is thrown out."],
      ["V", 2, 8, "#5 Vi Costa flies out to center. Three outs."],
      ["H", 2, 6, "Bottom of the 2nd, Comets down one. #4 Rosa Duarte singles to center."],
      ["H", 2, 7, "#19 Hana Fischer launches the first pitch over the left-field fence.", "A two-run, walk-off home run. The Comets win."],
    ]),
  },
  {
    n: 7,
    visitors: "blaze",
    home: "heat",
    calls: calls([
      ["V", 1, 1, "#2 Ari Rivera draws a walk."],
      ["V", 1, 2, "#14 Jo Okafor bunts toward third. The third baseman throws to first for the out.", "Rivera moves up to second."],
      ["V", 1, 3, "#21 Emma Lindqvist singles to center. Rivera scores."],
      [
        "V", 1, 4,
        "#8 Rei Nakamura grounds to the shortstop.",
        "Shortstop to second to force Lindqvist, then on to first. Double play. Three outs.",
      ],
      ["H", 1, 1, "Bottom of the 1st. #9 Mari Santos singles to right."],
      ["H", 1, 2, "#16 Remi Holt strikes out swinging. Santos holds."],
      ["H", 1, 3, "#23 Zara Achebe flies out to right."],
      ["H", 1, 4, "#44 Kit Lund grounds to second and is thrown out. Three outs."],
      ["V", 2, 5, "Top of the 2nd. #17 Sofia Delgado doubles into the right-center gap."],
      ["V", 2, 6, "#5 Cam Whitfield grounds to second and is thrown out. Delgado moves up to third."],
      ["V", 2, 7, "#30 Kat Brennan flies out to left. Delgado tags up and scores."],
      ["V", 2, 8, "#11 Dev Patel is caught looking at strike three. Three outs."],
      ["H", 2, 5, "Bottom of the 2nd, Heat down two. #7 Flor Barros is hit by a pitch."],
      ["H", 2, 6, "#12 Abby Wren flies out to center. Barros holds."],
      [
        "H", 2, 7,
        "#30 Saki Ito grounds to the shortstop.",
        "Shortstop to second to force Barros, then on to first. Double play.",
        "Ballgame. The Blaze win it.",
      ],
    ]),
  },
  {
    n: 8,
    visitors: "rockets",
    home: "comets",
    calls: calls([
      ["V", 1, 1, "#4 Addie Bell flies out to center."],
      ["V", 1, 2, "#13 Gabi Navarro strikes out swinging."],
      ["V", 1, 3, "#20 Tobi Okoro grounds to short and is thrown out. Three outs."],
      ["H", 1, 1, "Bottom of the 1st. #6 Tia Reed hits one into the right-field corner and slides into third.", "A triple."],
      ["H", 1, 2, "#12 Kaia Sorensen grounds to second and is thrown out. Reed scores."],
      ["H", 1, 3, "#21 Nia Abara strikes out swinging."],
      ["H", 1, 4, "#10 Jaz Calloway lines out to the second baseman. Three outs."],
      ["V", 2, 4, "Top of the 2nd. #7 Maddie Lindgren doubles down the left-field line."],
      ["V", 2, 5, "#33 Jules Price grounds to short and is thrown out. Lindgren moves up to third."],
      ["V", 2, 6, "#15 Emi Tanaka flies out deep to center. Lindgren tags up and scores.", "Tie game."],
      ["V", 2, 7, "#2 Celine Dubois strikes out swinging. Three outs."],
      ["H", 2, 5, "Bottom of the 2nd, tie game. #27 Ellie Marsh walks."],
      ["H", 2, 6, "#4 Rosa Duarte bunts back to the pitcher, who throws to first for the out.", "Marsh moves up to second."],
      ["H", 2, 7, "#19 Hana Fischer takes a called third strike."],
      ["H", 2, 8, "#31 Ada Nwosu lines a single into left field. Marsh scores.", "Walk-off. The Comets win."],
    ]),
  },
  {
    n: 9,
    visitors: "lightning",
    home: "storm",
    calls: calls([
      ["V", 1, 1, "#1 Sage Hart singles to left."],
      [
        "V", 1, 2,
        "#11 Nina Alvarez grounds to third. The third baseman throws to second to force Hart.",
        "No play at first. Alvarez is safe.",
      ],
      ["V", 1, 3, "#24 Rae Osei lifts one over the center-field fence.", "A two-run home run."],
      ["V", 1, 4, "#5 Josie Fontaine strikes out swinging."],
      ["V", 1, 5, "#17 Izzy Mendez flies out to left. Three outs."],
      ["H", 1, 1, "Bottom of the 1st. #1 Bree Castillo lines out to the shortstop."],
      ["H", 1, 2, "#10 Quinn Harper grounds to first. The first baseman steps on the bag herself."],
      ["H", 1, 3, "#23 Mina Yoon flies out to right. Three outs."],
      ["V", 2, 6, "Top of the 2nd. #8 Dani Carver singles to center."],
      [
        "V", 2, 7,
        "#22 Pia Ivanova grounds to the shortstop.",
        "Shortstop to second to force Carver, then on to first. Double play.",
      ],
      ["V", 2, 8, "#3 Brynn Walsh doubles down the right-field line."],
      ["V", 2, 9, "#14 Mo Greene grounds to second and is thrown out. Three outs."],
      ["H", 2, 4, "Bottom of the 2nd, Storm down two. #9 Lu Ferreira takes a called third strike."],
      ["H", 2, 5, "#16 Aiko Sato flies out to center."],
      ["H", 2, 6, "#44 Tess Bishop grounds to third and is thrown out.", "Ballgame. The Lightning win."],
    ]),
  },
  {
    n: 10,
    visitors: "heat",
    home: "blaze",
    calls: calls([
      ["V", 1, 1, "The final. #9 Mari Santos is hit by a pitch."],
      ["V", 1, 2, "#16 Remi Holt walks. Santos moves up to second."],
      ["V", 1, 3, "#23 Zara Achebe doubles into the left-center gap.", "Santos scores, and Holt stops at third."],
      ["V", 1, 4, "#44 Kit Lund flies out to right. Holt tags up and scores, and Achebe tags and takes third."],
      ["V", 1, 5, "#7 Flor Barros strikes out swinging. Achebe holds."],
      ["V", 1, 6, "#12 Abby Wren grounds to short and is thrown out. Three outs."],
      ["H", 1, 1, "Bottom of the 1st. #2 Ari Rivera flies out to center."],
      ["H", 1, 2, "#14 Jo Okafor strikes out swinging."],
      ["H", 1, 3, "#21 Emma Lindqvist grounds to second and is thrown out. Three outs."],
      ["V", 2, 7, "Top of the 2nd. #30 Saki Ito lines out to the third baseman."],
      ["V", 2, 8, "#5 Vi Costa is caught looking at strike three."],
      ["V", 2, 9, "#21 Piper Dale flies out to left. Three outs."],
      [
        "H", 2, 4,
        "Bottom of the 2nd, Blaze down two. #8 Rei Nakamura hits a grounder to third.",
        "The third baseman's throw pulls the first baseman off the bag. Nakamura is safe on the error.",
      ],
      ["H", 2, 5, "#17 Sofia Delgado singles to right. Nakamura moves up to second."],
      ["H", 2, 6, "#5 Cam Whitfield sends one over the left-field fence.", "A three-run, walk-off home run. The Blaze win the final."],
    ]),
  },
];

export const GAME_COUNT = GAMES.length;
/** Every game has 15 batters. */
export const GAME_PLAYS = 15;
/** Batters scored right on the first try for a clean book (80%, the site's bar). */
export const CLEAN_BOOK = Math.ceil((GAME_PLAYS * 80) / 100);

export function gameAt(n: number): Game | null {
  return GAMES.find((g) => g.n === n) ?? null;
}

/** The two teams in a game, as V (visitors) and H (home). */
export function teamsOf(game: Game): Record<Team, Club> {
  return { V: LEAGUE[game.visitors], H: LEAGUE[game.home] };
}

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

// ---------------------------------------------------------------------------
// Where she stands in each game (game 1 opens once the course is done; each
// next game opens after a clean book in the one before it)
// ---------------------------------------------------------------------------

export type GameRunSummary = { game: number; next_play: number; first_try: number; finished_at: string | null; passed: boolean | null };
export type GameStatus = { n: number; status: "locked" | "open" | "playing" | "clean"; batter: number | null; best: number | null };

export function gameStatuses(runs: GameRunSummary[]): GameStatus[] {
  const clean = new Set(runs.filter((r) => r.passed).map((r) => r.game));
  return GAMES.map((g) => {
    const mine = runs.filter((r) => r.game === g.n);
    const open = mine.find((r) => !r.finished_at);
    const finished = mine.filter((r) => r.finished_at);
    const best = finished.length ? Math.max(...finished.map((r) => r.first_try)) : null;
    const unlocked = g.n === 1 || clean.has(g.n - 1);
    const status = clean.has(g.n) ? "clean" : open ? "playing" : unlocked ? "open" : "locked";
    return { n: g.n, status, batter: open ? Math.min(open.next_play, GAME_PLAYS) : null, best };
  });
}
