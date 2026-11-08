// "How it's figured": every stat the site shows, in plain words. Tap a stat's
// abbreviation to read it (components/stat-term.tsx). Softball: ERA and per-7 rates
// use 7-inning games. No imports: unit-tested with node --test.

export type StatInfo = { abbr: string; name: string; formula: string; note?: string };

export const STAT_INFO = {
  AVG: { abbr: "AVG", name: "Batting average", formula: "Hits ÷ at-bats.", note: "Walks, HBP and sacrifices aren't at-bats, so they don't count for or against it." },
  OBP: { abbr: "OBP", name: "On-base percentage", formula: "(Hits + walks + hit by pitch) ÷ (at-bats + walks + hit by pitch + sac flies).", note: "How often she gets on base. Sac bunts don't count." },
  SLG: { abbr: "SLG", name: "Slugging", formula: "Total bases ÷ at-bats. A single is 1 base, a double 2, a triple 3, a home run 4." },
  OPS: { abbr: "OPS", name: "On-base plus slugging", formula: "OBP + SLG.", note: "Getting on base and hitting for power in one number." },
  "K%": { abbr: "K%", name: "Strikeout rate", formula: "Strikeouts ÷ plate appearances × 100." },
  "BB%": { abbr: "BB%", name: "Walk rate", formula: "Walks ÷ plate appearances × 100." },
  ERA: { abbr: "ERA", name: "Earned run average", formula: "Earned runs × 7 ÷ innings pitched.", note: "Earned runs per 7-inning game. Runs that score because of an error aren't earned." },
  WHIP: { abbr: "WHIP", name: "Walks + hits per inning", formula: "(Walks + hits allowed) ÷ innings pitched." },
  "K/7": { abbr: "K/7", name: "Strikeouts per 7", formula: "Strikeouts × 7 ÷ innings pitched." },
  "BB/7": { abbr: "BB/7", name: "Walks per 7", formula: "Walks × 7 ÷ innings pitched." },
  IP: { abbr: "IP", name: "Innings pitched", formula: "Outs recorded ÷ 3, written whole innings . outs.", note: "4.2 means 4 innings and 2 outs (14 outs), not 4.2 innings." },
  "STR%": { abbr: "STR%", name: "Strike percentage", formula: "Strikes ÷ pitches × 100." },
  FPCT: { abbr: "FPCT", name: "Fielding percentage", formula: "(Putouts + assists) ÷ (putouts + assists + errors)." },
  "CS%": { abbr: "CS%", name: "Caught-stealing rate", formula: "Runners caught stealing ÷ steal attempts against her × 100.", note: "For catchers." },
  "QAB%": { abbr: "QAB%", name: "Quality at-bat rate", formula: "Plate appearances graded 3 or better ÷ graded plate appearances × 100.", note: "Coaches grade each at-bat 0-5: hard contact, an executed slap or bunt, a walk or moving a runner all count as quality." },
  PROD: { abbr: "PROD", name: "Production average", formula: "Total of the 0-5 grades ÷ number graded.", note: "For game at-bats and for BP swings. 5 = hard-hit, 0 = no competitive swing." },
} as const satisfies Record<string, StatInfo>;

export type StatKey = keyof typeof STAT_INFO;

/** Rate display: ".412" for averages, "1.050" for OPS above 1, "–" when unknown. */
export function rateLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return value >= 1 ? value.toFixed(3) : value.toFixed(3).replace(/^0/, "");
}
