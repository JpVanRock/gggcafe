// Fictional sample data for sample-data mode (page smoke tests, screenshots). A made-up team,
// twelve made-up players and five made-up games. Never real people.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Row = Record<string, any>;

const id = (prefix: string, n: number) => `${prefix}00-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const U = { admin: id("aaaaaa", 1), coach: id("aaaaaa", 2), assistant: id("aaaaaa", 3), mentor: id("aaaaaa", 4) };
const T = { us: id("bbbbbb", 1), storm: id("bbbbbb", 2), venom: id("bbbbbb", 3), rebels: id("bbbbbb", 4) };
const S = { fall: id("cccccc", 1) };
const G = { g1: id("dddddd", 1), g2: id("dddddd", 2), g3: id("dddddd", 3), opener: id("dddddd", 4), scrim: id("dddddd", 5) };

const PLAYERS: [string, string, string, string, string[]][] = [
  ["Maya", "Torres", "2", "SS", ["2B"]],
  ["Kendall", "Brooks", "7", "CF", ["LF"]],
  ["Avery", "Lopez", "11", "C", ["1B"]],
  ["Jordan", "Kim", "21", "P", ["1B"]],
  ["Riley", "Chen", "5", "3B", ["P"]],
  ["Sofia", "Ramirez", "9", "1B", []],
  ["Harper", "Davis", "14", "2B", ["SS"]],
  ["Quinn", "Walker", "17", "LF", ["RF"]],
  ["Tessa", "Morgan", "23", "RF", ["CF"]],
  ["Emma", "Nguyen", "3", "P", ["CF"]],
  ["Lila", "Park", "8", "2B", ["3B"]],
  ["Nora", "Bennett", "27", "C", ["3B"]],
];
const P = PLAYERS.map((_, i) => id("eeeeee", i + 1));
const [maya, kendall, avery, jordan, riley, sofia, harper, quinn, tessa, emma, lila, nora] = P;

const players: Row[] = PLAYERS.map(([first, last, , pos, sec], i) => ({
  id: P[i], first_name: first, last_name: last, preferred_name: null, bats: i % 3 === 1 ? "L" : "R", throws: "R", grad_year: 2030 + (i % 2),
  primary_position: pos, secondary_positions: sec, is_slapper: i === 1, notes: null, goal_method: "harada", birth_date: null, photo_path: null,
  walk_up_songs: [], created_at: "2026-08-15T00:00:00Z", updated_at: "2026-08-15T00:00:00Z",
}));
const teams: Row[] = [
  { id: T.us, name: "GGG Sample 14U", short_name: "GGG", organization: "GGG.Cafe", age_group: "14U", is_own_team: true, format: "fastpitch", logo_path: `${id("bbbbbb", 1)}/1731300000000.png`, welcome_message: null, team_code: "GGG234", home_field: null, notes: null },
  { id: T.storm, name: "Lakeside Storm", short_name: "Storm", is_own_team: false, age_group: "14U", format: "fastpitch" },
  { id: T.venom, name: "Valley Venom", short_name: "Venom", is_own_team: false, age_group: "14U", format: "fastpitch" },
  { id: T.rebels, name: "Ridgeline Rebels", short_name: "Rebels", is_own_team: false, age_group: "14U", format: "fastpitch" },
];
const seasons: Row[] = [{ id: S.fall, name: "Fall 2026", start_date: "2026-08-15", end_date: "2027-07-31", created_at: "2026-08-01T00:00:00Z" }];
const roster_entries: Row[] = PLAYERS.map((p, i) => ({ id: id("ffffff", i + 1), team_id: T.us, season_id: S.fall, player_id: P[i], jersey_number: p[2], active: true, created_at: "2026-08-15T00:00:00Z" }));
const staff: Row[] = [
  { user_id: U.admin, display_name: "Coach Sample", role: "admin" },
  { user_id: U.coach, display_name: "Coach Dana Ruiz", role: "coach" },
  { user_id: U.assistant, display_name: "Coach Sam Patel", role: "assistant" },
];

const game = (gid: string, date: string, home: string, away: string, hs: number | null, as: number | null, status: string, event: string | null) => ({
  id: gid, season_id: S.fall, game_date: date, start_time: "10:00:00", home_team_id: home, away_team_id: away, home_score: hs, away_score: as,
  status, venue: "Riverside Park, Field 2", event_name: event, game_type: "tournament", scheduled_innings: 7,
});
const games: Row[] = [
  game(G.g1, "2026-10-10", T.us, T.storm, 6, 2, "final", "Fall Classic"),
  game(G.g2, "2026-10-11", T.venom, T.us, 4, 3, "final", "Fall Classic"),
  game(G.g3, "2026-10-24", T.us, T.rebels, 8, 1, "final", "Harvest Cup"),
  game(G.scrim, "2026-11-14", T.us, T.venom, null, null, "scheduled", "Fall scrimmage"),
  game(G.opener, "2027-02-27", T.us, T.storm, null, null, "scheduled", "Season opener"),
];

const bat = (pid: string, pa: number, ab: number, r: number, h: number, d: number, hr: number, rbi: number, bb: number, so: number, sb: number) => ({
  game_id: G.g1, team_id: T.us, player_id: pid, pa, ab, r, h, d, t: 0, hr, rbi, bb, so, hbp: 0, sac: 0, sf: 0, sb, cs: 0,
  plate_appearances: pa, at_bats: ab, runs: r, hits: h, doubles: d, triples: 0, home_runs: hr, walks: bb, strikeouts: so, hit_by_pitch: 0, sac_bunts: 0, sac_flies: 0, stolen_bases: sb, caught_stealing: 0,
});
const batting_lines: Row[] = [
  bat(maya, 4, 3, 2, 2, 1, 0, 1, 1, 0, 2), bat(kendall, 4, 4, 1, 2, 0, 0, 0, 0, 1, 1), bat(avery, 4, 3, 1, 1, 0, 1, 2, 1, 1, 0),
  bat(jordan, 3, 3, 0, 1, 1, 0, 1, 0, 0, 0), bat(riley, 3, 3, 1, 1, 0, 0, 1, 0, 1, 0), bat(sofia, 3, 2, 0, 0, 0, 0, 0, 1, 1, 0),
  bat(harper, 3, 3, 1, 1, 0, 0, 0, 0, 0, 1), bat(quinn, 3, 3, 0, 1, 0, 0, 1, 0, 1, 0), bat(tessa, 3, 3, 0, 0, 0, 0, 0, 0, 2, 0),
];
const pitching_lines: Row[] = [
  { game_id: G.g1, team_id: T.us, player_id: jordan, starter: true, is_starter: true, outs: 15, outs_recorded: 15, bf: 21, h: 3, r: 2, er: 1, bb: 2, so: 7, hbp: 0, hr: 0, wp: 1, pitches: 78, strikes: 51, decision: "W" },
  { game_id: G.g1, team_id: T.us, player_id: emma, starter: false, is_starter: false, outs: 6, outs_recorded: 6, bf: 7, h: 1, r: 0, er: 0, bb: 0, so: 3, hbp: 0, hr: 0, wp: 0, pitches: 24, strikes: 17, decision: "S" },
];
const fielding_lines: Row[] = [
  { game_id: G.g1, team_id: T.us, player_id: maya, po: 2, a: 5, e: 0, dp: 1, pb: 0, sba: 0, cs: 0 },
  { game_id: G.g1, team_id: T.us, player_id: avery, po: 9, a: 1, e: 0, dp: 0, pb: 1, sba: 2, cs: 1 },
  { game_id: G.g1, team_id: T.us, player_id: sofia, po: 7, a: 0, e: 1, dp: 1, pb: 0, sba: 0, cs: 0 },
];
const grades = [[maya, [5, 3, 4, 3]], [kendall, [4, 5, 1, 3]], [avery, [3, 5, 0, 3]], [jordan, [4, 2, 3]]] as const;
const pa_grades: Row[] = grades.flatMap(([pid, gs]) => gs.map((g, i) => ({ game_id: G.g1, team_id: T.us, player_id: pid, pa_no: i + 1, grade: g })));

const batting_season: Row[] = [
  { season_id: S.fall, team_id: T.us, player_id: maya, games: 14, pa: 52, ab: 44, r: 13, h: 18, doubles: 5, triples: 1, hr: 1, rbi: 11, bb: 7, so: 5, hbp: 1, sac: 0, sf: 0, sb: 9, cs: 1, tb: 28, avg: 0.409, obp: 0.5, slg: 0.636, ops: 1.136, iso: 0.227, babip: 0.447, k_pct: 9.6, bb_pct: 13.5 },
  { season_id: S.fall, team_id: T.us, player_id: kendall, games: 14, pa: 50, ab: 45, avg: 0.356, obp: 0.42, slg: 0.444, ops: 0.864, k_pct: 12.0, bb_pct: 8.0 },
];
const pitching_season: Row[] = [
  { season_id: S.fall, team_id: T.us, player_id: jordan, games: 8, games_started: 7, wins: 5, losses: 2, saves: 0, outs: 117, ip: "39.0", ip_decimal: 39, bf: 160, h: 28, r: 14, er: 9, bb: 12, so: 51, era: 1.62, whip: 1.026, k_per_7: 9.15, bb_per_7: 2.15, k_bb: 4.25, strike_pct: 64.8 },
];
const fielding_season: Row[] = [{ season_id: S.fall, team_id: T.us, player_id: maya, games: 14, po: 21, a: 38, e: 3, dp: 4, pb: 0, sb_allowed: 0, cs: 0, fpct: 0.952, cs_pct: null }];
const qab_season: Row[] = [{ season_id: S.fall, team_id: T.us, player_id: maya, graded: 40, quality: 27, qab_pct: 67.5, production: 3.18 }];

const hitting = ["contact", "gap", "power", "gap", "power", "contact", "contact", "gap", "contact", "contact", "gap", "power"];
const running = ["pure", "pure", "average", "average", "intelligent", "average", "intelligent", "pure", "intelligent", "average", "pure", "average"];
const gameday_profiles: Row[] = P.map((pid, i) => ({ team_id: T.us, season_id: S.fall, player_id: pid, hitting_type: hitting[i], base_running: running[i], avg: null, obp: null, k_pct: null }));
const order = [maya, kendall, avery, jordan, riley, sofia, harper, quinn, tessa];
const defense1 = { [maya]: "SS", [kendall]: "CF", [avery]: "C", [jordan]: "Sub", [riley]: "3B", [sofia]: "1B", [harper]: "2B", [quinn]: "LF", [tessa]: "RF", [emma]: "P", [lila]: "Sub", [nora]: "Sub" };
const defense2 = { ...defense1, [tessa]: "Sub", [lila]: "RF" };
const defense3 = { ...defense1, [avery]: "Sub", [riley]: "P", [emma]: "Sub", [lila]: "3B", [nora]: "C" };
const lineupBase = {
  team_id: T.us, season_id: S.fall, rotations: 3, batting_order: order, defense: { "1": defense1, "2": defense2, "3": defense3 },
  pitching: { "1": { primary: "Dropball", secondary: "Changeup", chase: ["Rise Ball"] }, "2": { primary: "Dropball", secondary: "Changeup", chase: ["Rise Ball"] }, "3": { primary: "Fastball", secondary: "Changeup", chase: ["Drop Curve"] } },
  dp_player_id: jordan, flex_player_id: emma, team: { id: T.us, name: "GGG Sample 14U" },
  jobs: [{ job: "Third-base coach", who: "Coach Dana Ruiz" }, { job: "First-base coach", who: "Coach Sam Patel" }, { job: "Keep the book", who: "Pat Lopez (parent)" }],
};
const gameday_lineups: Row[] = [
  { ...lineupBase, id: id("abab00", 1), game_id: G.opener, game_date: "2027-02-27", opponent: "Lakeside Storm", title: "Season opener", status: "final", finalized_at: "2027-02-26T20:00:00Z", shared_at: null, notes: "Attack the first pitch.",
    sub_log: [{ inning: 4, spot: 9, in: lila }, { inning: 5, spot: 3, in: nora }, { inning: 6, spot: 9, in: tessa }, { inning: 7, spot: 9, in: lila }], updated_at: "2027-02-27T12:00:00Z" },
  { ...lineupBase, id: id("abab00", 2), game_id: G.scrim, game_date: "2026-11-14", opponent: "Valley Venom", title: "Fall scrimmage", status: "draft", finalized_at: null, shared_at: null, notes: null, sub_log: [], updated_at: "2026-11-08T12:00:00Z" },
];
const depth_chart: Row[] = [
  ["P", [jordan, emma, riley]], ["C", [avery, nora]], ["1B", [sofia, jordan]], ["2B", [harper, lila]], ["3B", [riley, lila]],
  ["SS", [maya, harper]], ["LF", [quinn, kendall]], ["CF", [kendall, tessa]], ["RF", [tessa, quinn]],
].flatMap(([pos, ids]) => (ids as string[]).map((pid, i) => ({ team_id: T.us, position: pos, player_id: pid, rank: i + 1 })));
const staff_duties: Row[] = [
  ["practice", "Infield station", "Coach Dana Ruiz"], ["pregame", "Team warm-up", "Coach Dana Ruiz"], ["game", "Third-base coach", "Coach Dana Ruiz"],
  ["game", "Keep the book", "Parents (rotating)"], ["postgame", "Box score into GGG.Cafe", "Coach Sample"], ["season", "Team meals", "Parents (rotating)"],
].map(([phase, duty, owner], i) => ({ id: id("acac00", i + 1), team_id: T.us, phase, duty, owner, position: i }));
const staff_standards: Row[] = [{ team_id: T.us, commitment: ["We are on the field before the players."], pre_practice: ["Field checked: holes, wet spots, loose gear"] }];

const play = (n: number, name: string, category: string, situation: string | null, description: string, call_sheet = true, team: string | null = T.us) => ({
  id: id("adad00", n), team_id: team, name, category, situation, description, call_sheet, active: true, diagram_url: null,
});
const playbook_plays: Row[] = [
  play(1, "Wheel", "bunt_defense", "Runners on 1st and 2nd", "Third crashes, short rotates to third, second covers first."),
  play(2, "Short", "first_and_third", "Runner breaks from first", "Catcher throws through; short cuts and reads the runner at third."),
  play(3, "Box", "defensive_alignment", "Slapper up", "Corners in on the grass, short shades the hole.", true, null),
];
const play_effectiveness: Row[] = [{ play_id: playbook_plays[0].id, team_id: T.us, name: "Wheel", category: "bunt_defense", times_called: 6, successes: 4, partials: 1, failures: 1, last_called: "2026-10-24" }];
const QZ = id("aeae00", 1);
const team_quiz_questions: Row[] = [
  ["We call Wheel. Who covers third?", ["Third baseman", "Shortstop", "Pitcher"], 1, "Third crashes, so the shortstop rotates over."],
  ["Slapper up. What's the call?", ["Wheel", "Short", "Box"], 2, "Box brings the corners in."],
].map(([q, choices, correct, why], i) => ({ id: id("afaf00", i + 1), quiz_id: QZ, position: i, question: q, choices, correct_index: correct, explanation: why, play_id: null }));
const team_quizzes: Row[] = [{ id: QZ, team_id: T.us, title: "Bunt & slap defense calls", published_at: "2026-11-03T18:00:00Z", created_at: "2026-11-02T18:00:00Z", team: { name: "GGG Sample 14U" } }];
const team_quiz_answers: Row[] = [{ player_id: maya, question_id: team_quiz_questions[0].id, chosen_index: 1, is_correct: true, first_correct: true, tries: 1 }];
const scouting_reports: Row[] = [
  { id: id("baba00", 1), subject_team_id: T.storm, subject_player_id: null, game_id: G.g1, category: "hitter_tendencies", title: "Slappers", body: "Two lefty slappers at the top.", confidence: 5, tags: ["checklist", "slappers"], observed_on: "2026-10-10", created_at: "2026-10-10T20:00:00Z" },
];

const PL = id("bcbc00", 1);
const practice_plans: Row[] = [
  { id: PL, team_id: T.us, practice_date: "2026-11-10", start_time: "17:30", setting: "indoor", total_minutes: 120, location: "Westside Fieldhouse", focus: "Bunt defense", status: "final", finalized_at: "2026-11-09T20:00:00Z", shared_at: null, created_by: U.admin,
    team: { id: T.us, name: "GGG Sample 14U" }, objective: "Every bunt-defense call", rule_of_day: "Sprint on and off", announcements: "Bring turf shoes.", coach_notes: "Watch Jordan's arm.",
    blocks: [{ drill_id: null, name: "Bunt defense: Wheel", description: "Live bunts.", tags: ["defense"], minutes: 30, coaches: ["Coach Sample"], equipment: null, video_url: null, position: 0 }],
    spots: [{ position: "SS", player_id: maya, sort: 0 }], drills: [{ count: 1 }], installs: [] },
];
const practice_plan_cues: Row[] = [{ plan_id: PL, player_id: maya, cue: "Call the base loud and early" }];
const install_items: Row[] = [
  { id: id("bdbd00", 1), team_id: T.us, category: "situation", group_name: "Bunt defense", title: "Wheel play", iq_track: "defense", status: "repped", position: 0, play_id: null, plans: [{ plan: { id: PL, practice_date: "2026-11-10" } }] },
  { id: id("bdbd00", 2), team_id: T.us, category: "position", group_name: "SS", title: "Covering second on steals", iq_track: "position", status: "taught", position: 1, play_id: null, plans: [] },
];
const install_item_plans: Row[] = [{ item_id: install_items[0].id, plan_id: PL }];
const team_events: Row[] = [
  { id: id("bebe00", 1), team_id: T.us, kind: "practice", title: "Team practice", event_date: "2026-11-10", start_time: "17:30:00", end_time: "19:30:00", location: "Westside Fieldhouse", series_id: null },
  // a repeating event (one series), so the calendar's "only this one / this and later" choices render
  ...["2026-11-12", "2026-11-19", "2026-11-26"].map((event_date, i) => ({
    id: id("bebe00", 2 + i), team_id: T.us, kind: "workout", title: "Speed and agility", event_date, start_time: "16:00:00", end_time: "17:00:00",
    location: "Westside Fieldhouse", series_id: id("bebf00", 1),
  })),
];
const training_phases: Row[] = [{ id: id("bfbf00", 1), team_id: T.us, kind: "build", name: "Build", starts_on: "2026-11-02", ends_on: "2026-12-20", focus: "Strength and speed." }];
const team_offseason: Row[] = [{ team_id: T.us, starts_on: "2026-11-01", ends_on: "2027-02-26" }];
const bp_rounds: Row[] = [
  { id: id("cbcb00", 1), player_id: maya, round_date: "2026-11-05", grades: [5, 4, 4, 3, 5, 4, 2, 5, 4, 3, 4, 5, 3, 4, 5, 4, 3, 4, 5, 4, 3], note: "Front toss", created_at: "2026-11-05T19:00:00Z" },
];
const bullpen_scripts: Row[] = [{ id: id("cdcd00", 1), team_id: T.us, name: "Command day", notes: null, pitches: [{ pitch: "Drop", zone: 8, intent: "strike" }, { pitch: "Rise", zone: 2, intent: "up", count: "0-2" }] }];
const player_spotlights: Row[] = [{ id: id("cece00", 1), team_id: T.us, player_id: maya, player_name: "Maya Torres", jersey: "2", headline: "Engine of the infield", body: "Leads the team in steals.", published_on: "2026-11-02" }];
const team_culture: Row[] = [{ team_id: T.us, headline: "Compete. Connect. Elevate.", statement: "We show up for each other.", motto: "Every pitch" }];
const team_standards: Row[] = [{ team_id: T.us, title: "Be early", detail: null, position: 0 }];
// Maya has G3 Advanced and the Full Leadership Program, and Lila is in Leadership Light,
// so both programs' pages render too.
const player_advanced_access: Row[] = [
  { player_id: maya, source: "admin", granted_at: "2026-11-01T00:00:00Z" },
  { player_id: lila, source: "admin", granted_at: "2026-11-01T00:00:00Z" },
];
const player_leadership_access: Row[] = [
  { player_id: maya, program: "full", granted_at: "2026-11-01T00:00:00Z" },
  { player_id: lila, program: "light", granted_at: "2026-11-08T00:00:00Z" },
];
const player_leadership_certificates: Row[] = [
  { player_id: maya, program: "full", team_id: T.us, awarded_at: "2026-11-06T18:00:00Z", coach_name: "Coach Sample" },
];

// Measurements by season on Maya's Pop Report (fall and winter of 2026-27, one from last year).
const measurements: Row[] = [
  { id: id("dede00", 1), player_id: maya, metric_key: "home_to_first", value: 3.21, measured_on: "2026-09-18", created_at: "2026-09-18T20:00:00Z" },
  { id: id("dede00", 2), player_id: maya, metric_key: "home_to_first", value: 3.12, measured_on: "2026-10-30", created_at: "2026-10-30T20:00:00Z" },
  { id: id("dede00", 3), player_id: maya, metric_key: "first_to_second", value: 3.05, measured_on: "2026-10-30", created_at: "2026-10-30T20:05:00Z" },
  { id: id("dede00", 4), player_id: maya, metric_key: "throw_velo_overhand", value: 54, measured_on: "2026-11-04", created_at: "2026-11-04T20:00:00Z" },
  { id: id("dede00", 5), player_id: maya, metric_key: "connection_score", value: 61, measured_on: "2026-11-04", created_at: "2026-11-04T20:10:00Z" },
  { id: id("dede00", 6), player_id: maya, metric_key: "home_to_first", value: 3.3, measured_on: "2026-04-12", created_at: "2026-04-12T20:00:00Z" },
];

// Mentors: the sample admin is also a mentor for the whole team (so the mentor pages render
// with her players, focus areas, notes and training); a second mentor waits for approval.
const mentors: Row[] = [
  { user_id: U.admin, display_name: "Coach Sample", specialty: "Pitching", created_at: "2026-11-01T00:00:00Z" },
  { user_id: U.mentor, display_name: "Jess Moreno", specialty: "Hitting", created_at: "2026-11-09T00:00:00Z" },
];
const mentor_links: Row[] = [
  { id: id("acac00", 1), mentor_id: U.admin, team_id: T.us, player_id: null, player_name: null, status: "approved", requested_at: "2026-11-01T00:00:00Z" },
  { id: id("acac00", 2), mentor_id: U.admin, team_id: T.us, player_id: jordan, player_name: "Jordan Kim", status: "approved", requested_at: "2026-11-02T00:00:00Z" },
  { id: id("acac00", 3), mentor_id: U.mentor, team_id: T.us, player_id: null, player_name: null, status: "pending", requested_at: "2026-11-09T00:00:00Z" },
  { id: id("acac00", 4), mentor_id: U.mentor, team_id: T.us, player_id: emma, player_name: "Emma Nguyen", status: "pending", requested_at: "2026-11-09T00:00:00Z" },
];
const mentor_messages: Row[] = [
  { id: id("adad00", 1), player_id: maya, sender_id: U.admin, sender_name: "Coach Sample", body: "Great pen today. Keep your front side closed on the drop.", photo_path: null, drill_id: null, drill_name: "Towel drill", drill_video_url: "https://example.com/towel", created_at: "2026-11-09T18:00:00Z", read_at: null, shared_with_coaches: true },
  { id: id("adad00", 2), player_id: maya, sender_id: U.admin, sender_name: "Coach Sample", body: "Proud of how you bounced back after the second inning.", photo_path: null, drill_id: null, drill_name: null, drill_video_url: null, created_at: "2026-11-10T18:00:00Z", read_at: "2026-11-10T20:00:00Z", shared_with_coaches: false },
];
const mentor_focus: Row[] = [
  { id: id("aeae00", 1), mentor_id: U.admin, player_id: maya, team_id: null, title: "Drive the drop ball down", details: "Towel drill, then 15 drops to a low target each pen.", status: "working_on", created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-09T00:00:00Z" },
  { id: id("aeae00", 2), mentor_id: U.admin, player_id: maya, team_id: null, title: "Reset breath between pitches", details: null, status: "working", created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-10T00:00:00Z" },
  { id: id("aeae00", 3), mentor_id: U.admin, player_id: null, team_id: T.us, title: "Two-strike approach", details: "Choke up, widen, battle.", status: "working_on", created_at: "2026-11-03T00:00:00Z", updated_at: "2026-11-03T00:00:00Z" },
];
const mentor_notes: Row[] = [
  { id: id("afaf00", 1), mentor_id: U.admin, player_id: maya, team_id: null, kind: "summary", discussed_on: "2026-11-09", body: "Talked with Coach Ruiz after practice: her drop ball is landing low. Next: same drill, add a target.", author_id: U.admin, author_name: "Coach Sample", author_role: "mentor", created_at: "2026-11-09T19:00:00Z" },
  { id: id("afaf00", 2), mentor_id: U.admin, player_id: maya, team_id: null, kind: "note", discussed_on: null, body: "Agreed. We'll chart her drops at the scrimmage.", author_id: U.coach, author_name: "Coach Dana Ruiz", author_role: "coach", created_at: "2026-11-10T08:00:00Z" },
  { id: id("afaf00", 3), mentor_id: U.admin, player_id: null, team_id: T.us, kind: "note", discussed_on: null, body: "Two-strike approach is the team focus through December.", author_id: U.admin, author_name: "Coach Sample", author_role: "mentor", created_at: "2026-11-03T19:00:00Z" },
];
const player_activities: Row[] = [
  { id: id("abac00", 1), player_id: maya, title: "Pitching lesson", details: "From Coach Sample", days: [2], starts_on: "2026-11-10", ends_on: "2027-01-26", pillar_id: null, created_by: U.admin, source: "mentor", created_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z" },
  { id: id("abac00", 2), player_id: jordan, title: "Pitching lesson", details: "From Coach Sample", days: [2], starts_on: "2026-11-10", ends_on: "2027-01-26", pillar_id: null, created_by: U.admin, source: "mentor", created_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z" },
];

// Team Budget: a fee, a few payments, income and expenses, tournament credit won and used, and the
// coaches' out-of-pocket ledger (one item repaid from team money), so every budget card renders.
const budget_fees: Row[] = [{ id: id("bdbd00", 1), team_id: T.us, season_id: S.fall, position: 1, name: "Registration", amount: 450 }];
const budgetEntry = (n: number, kind: string, entry_date: string, amount: number, extra: Row = {}): Row => ({
  id: id("bdbe00", n), team_id: T.us, season_id: S.fall, kind, entry_date, amount, player_id: null, category: null, method: null, description: null, ...extra,
});
const budget_entries: Row[] = [
  budgetEntry(1, "payment", "2026-09-02", 450, { player_id: maya, method: "Venmo", category: "Registration" }),
  budgetEntry(2, "payment", "2026-09-03", 200, { player_id: kendall, method: "Check", category: "Registration", description: "Check #1042" }),
  budgetEntry(9, "payment", "2026-09-15", 45, { player_id: avery, method: "Cash", category: "Equipment", description: "Batting gloves" }),
  budgetEntry(3, "income", "2026-09-10", 300, { category: "Fundraiser", description: "Car wash" }),
  budgetEntry(4, "expense", "2026-09-12", 650, { category: "Tournament fees", description: "Fall Classic entry" }),
  budgetEntry(7, "expense", "2026-10-08", 89.99, { category: "Out-of-pocket reimbursement", description: "Out-of-pocket reimbursement (1 item)" }),
  budgetEntry(8, "income", "2026-10-12", 40, { category: "Reimbursement", description: "Refunded umpire deposit" }),
];
// tournament credit lives apart from the team ledger (user, 2026-11-12)
const budget_credits: Row[] = [
  { id: id("bdbc00", 1), team_id: T.us, season_id: S.fall, entry_date: "2026-09-28", kind: "won", amount: 250, description: "Fall Classic champions" },
  { id: id("bdbc00", 2), team_id: T.us, season_id: S.fall, entry_date: "2026-10-05", kind: "used", amount: 150, description: "Halloween Bash entry" },
];
/** What team_budget_summary() returns for the sample team: the parents' view and the coaches' summary. */
const budgetSummary = () => {
  const sum = (rows: Row[]) => rows.reduce((t, e) => t + Number(e.amount), 0);
  const pays = budget_entries.filter((e) => e.kind === "payment");
  const players = new Set(roster_entries.filter((r) => r.team_id === T.us && r.season_id === S.fall && r.active).map((r) => r.player_id)).size;
  // daily totals per kind of payment, no names (as the database does)
  const byDay = new Map<string, Row[]>();
  for (const p of pays) {
    const key = `${p.entry_date}|${p.category ?? "Registration"}`;
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const noun: Record<string, string> = { Registration: "player payment", Equipment: "equipment payment", Other: "other player payment" };
  return {
    team: "GGG Sample 14U", season: "Fall 2026", season_id: S.fall, updated_at: "2026-11-10T21:30:00Z", players,
    fees: [{ name: "Registration", amount: 450 }], fee_per_player: 450, expected: players * 450,
    collected: sum(pays.filter((e) => (e.category ?? "Registration") === "Registration")),
    other_income: sum(budget_entries.filter((e) => e.kind === "income" || (e.kind === "payment" && (e.category ?? "Registration") !== "Registration"))),
    expenses: sum(budget_entries.filter((e) => e.kind === "expense")),
    entries: [
      ...budget_entries.filter((e) => e.kind !== "payment").map((e) => ({ date: e.entry_date, kind: e.kind, category: e.category, description: e.description, amount: e.amount })),
      ...[...byDay].map(([key, rows]) => {
        const [date, bucket] = key.split("|");
        return { date, kind: "payment", category: bucket === "Registration" ? null : bucket, description: `${rows.length} ${noun[bucket]}${rows.length === 1 ? "" : "s"}`, amount: sum(rows) };
      }),
    ],
    credits: budget_credits.map((c) => ({ date: c.entry_date, kind: c.kind, amount: c.amount, description: c.description })),
  };
};
const budget_coach_expenses: Row[] = [
  { id: id("bdbf00", 1), team_id: T.us, season_id: S.fall, entry_date: "2026-09-04", paid_by: "Coach Sample", paid_by_role: "coach", category: "Equipment", description: "Practice balls", amount: 89.99, reimbursed_on: "2026-10-08", reimbursement_id: id("bdbe00", 7) },
  { id: id("bdbf00", 2), team_id: T.us, season_id: S.fall, entry_date: "2026-10-01", paid_by: "Coach Sample", paid_by_role: "coach", category: "Team events", description: "Team pizza after practice", amount: 64.5, reimbursed_on: null, reimbursement_id: null },
  { id: id("bdbf00", 3), team_id: T.us, season_id: S.fall, entry_date: "2026-10-03", paid_by: "Pat Torres", paid_by_role: "parent", category: "Other", description: "Ice and sports drinks", amount: 32, reimbursed_on: null, reimbursement_id: null },
];

// Mental GP lessons and the coaches' Mental Game course (user, 2026-11-12)
// Lessons 1, 2, 4 and 8 keep their answers in her Mental Game Plan (the plan-field lessons).
const player_mental_lessons: Row[] = [
  { player_id: P[0], lesson: "between-pitches", answer: null, completed_at: "2026-11-02T18:00:00Z", updated_at: "2026-11-02T18:00:00Z" },
  { player_id: P[0], lesson: "nerves", answer: "Shaky legs and I rush. I tell myself: I'm ready, this is my body getting going.", completed_at: "2026-11-05T18:00:00Z", updated_at: "2026-11-05T18:00:00Z" },
  { player_id: P[0], lesson: "after-the-error", answer: null, completed_at: "2026-11-08T18:00:00Z", updated_at: "2026-11-08T18:00:00Z" },
  { player_id: P[1], lesson: "between-pitches", answer: null, completed_at: "2026-11-03T18:00:00Z", updated_at: "2026-11-03T18:00:00Z" },
];
const mental_game_plans: Row[] = [
  {
    id: id("abcd00", 1), player_id: P[0], focus_words: "See it early. Drive.", pre_game_routine: null,
    pre_pitch_routine: "Front foot in, back foot out. Re-strap my gloves, look at Coach for the sign, one long breath, \"see it early,\" back in.",
    reset_routine: "Errors that score a run. Smooth the dirt with my cleat, \"hit it to me,\" call the outs.",
    confidence_statements: null, pressure_plan: null, notes: null, green_signs: "Loose hands, clear head.", yellow_signs: "Gripping tight, rushing.",
    red_signs: null, yellow_release: "Long breath out, \"see it early.\"", red_release: null, zone_low: 6, zone_high: 8,
    updated_by: null, created_at: "2026-11-02T18:00:00Z", updated_at: "2026-11-08T18:00:00Z",
  },
  {
    id: id("abcd00", 2), player_id: P[1], focus_words: null, pre_game_routine: null, pre_pitch_routine: "Ball in the glove, breathe, onto the plate, sign, see the mitt.",
    reset_routine: null, confidence_statements: null, pressure_plan: null, notes: null, green_signs: null, yellow_signs: null, red_signs: null,
    yellow_release: null, red_release: null, zone_low: null, zone_high: null, updated_by: null, created_at: "2026-11-03T18:00:00Z", updated_at: "2026-11-03T18:00:00Z",
  },
];
const coach_mental_lessons: Row[] = [
  { user_id: U.admin, lesson: "your-words", notes: "Cue words: \"see it early,\" \"glove down,\" \"hit the mitt.\"", completed_at: "2026-11-06T18:00:00Z", updated_at: "2026-11-06T18:00:00Z" },
  { user_id: U.admin, lesson: "after-mistakes", notes: "Team reset: catcher calls \"next one,\" gloves up.", completed_at: "2026-11-09T18:00:00Z", updated_at: "2026-11-09T18:00:00Z" },
  { user_id: U.coach, lesson: "your-words", notes: null, completed_at: "2026-11-07T18:00:00Z", updated_at: "2026-11-07T18:00:00Z" },
];

// the head coach's Team Hitting Philosophy and Throwing Program (user, 2026-11-12); Maya (SS) is an Innie
const team_hitting_philosophy: Row[] = [
  {
    team_id: T.us, updated_at: "2026-11-10T18:00:00Z",
    statement: "On time, on the attack, hard to get out.",
    sections: [
      { title: "Hunt your pitch early", body: "Ahead or even, look for one pitch in one zone and drive it." },
      { title: "With two strikes, we battle", body: "Choke up, protect the plate, make her throw one more." },
    ],
  },
];
const team_throwing_programs: Row[] = [
  {
    team_id: T.us, grp: "innies", updated_at: "2026-11-10T18:00:00Z", intro: "Quick exchange, accurate ball.",
    steps: [
      { name: "Wrist flicks", dose: "10 throws · 10 ft", cue: "Elbow up, snap the wrist." },
      { name: "Quick exchange", dose: "10 reps · 30 ft", cue: null },
    ],
  },
];

// My Journal (user, 2026-11-12): Maya's notes from sessions with the sample admin (a mentor); one is shared
const player_journal_entries: Row[] = [
  {
    id: id("ajaj00", 1), player_id: maya, mentor_id: U.admin, mentor_name: null, session_date: "2026-11-09", topic: "Backhand footwork",
    notes: "Plant the right foot, gather, throw through first. Cue: \"low and through.\"", audio_path: null, audio_seconds: null,
    shared_with_mentor: true, created_at: "2026-11-09T20:00:00Z", updated_at: "2026-11-09T20:00:00Z",
  },
  {
    id: id("ajaj00", 2), player_id: maya, mentor_id: null, mentor_name: "Hitting lesson", session_date: "2026-11-05", topic: "Load early",
    notes: "Get the load started early so I am never rushed.", audio_path: null, audio_seconds: null,
    shared_with_mentor: false, created_at: "2026-11-05T20:00:00Z", updated_at: "2026-11-05T20:00:00Z",
  },
];

// the sample admin is also a parent of Maya and Emma (parent_home below): the Coach / Parent switch shows
const parent_links: Row[] = [maya, emma].map((pid, i) => ({
  id: id("agag00", i + 1), parent_id: U.admin, team_id: T.us, child_name: PLAYERS[P.indexOf(pid)].slice(0, 2).join(" "), player_id: pid, status: "approved",
  requested_at: "2026-11-01T00:00:00Z", decided_by: U.admin, decided_at: "2026-11-01T00:00:00Z",
}));

// the Switchboard (user, 2026-11-12): one feature off; the sample admin is also the team's team admin
const team_features_off: Row[] = [{ team_id: T.us, feature: "player.activity", turned_off_by: U.admin, turned_off_at: "2026-11-11T18:00:00Z" }];
const team_admins: Row[] = [{ team_id: T.us, user_id: U.admin, granted_by: U.admin, granted_at: "2026-11-11T18:00:00Z" }];

// video calls (user, 2026-11-12): on for the sample team and its mentors; the sample admin (a mentor
// there too) booked one with Maya, a head coach one with Emma, and one was cancelled
const team_video_access: Row[] = [
  { team_id: T.us, allowed_by: U.admin, allowed_at: "2026-11-12T18:00:00Z", mentors_on: true, mentors_set_by: U.admin, mentors_set_at: "2026-11-12T18:05:00Z" },
];
const video_calls: Row[] = [
  { id: id("a0ca11", 1), team_id: T.us, player_id: maya, host_id: U.admin, host_kind: "mentor", host_name: "Coach Sample", topic: "Changeup grip and release", starts_at: "2027-01-12T00:00:00Z", minutes: 30, zoom_meeting_id: "81000000101", cancelled_at: null, cancelled_by: null, created_at: "2026-11-12T19:00:00Z" },
  { id: id("a0ca11", 2), team_id: T.us, player_id: emma, host_id: U.admin, host_kind: "coach", host_name: "Pat Torres", topic: "Winter plan check-in", starts_at: "2027-01-14T23:30:00Z", minutes: 45, zoom_meeting_id: "81000000102", cancelled_at: null, cancelled_by: null, created_at: "2026-11-12T19:10:00Z" },
  { id: id("a0ca11", 3), team_id: T.us, player_id: maya, host_id: U.admin, host_kind: "mentor", host_name: "Coach Sample", topic: "Spin drills", starts_at: "2026-12-02T00:00:00Z", minutes: 30, zoom_meeting_id: "81000000103", cancelled_at: "2026-11-12T20:00:00Z", cancelled_by: U.admin, created_at: "2026-11-12T19:20:00Z" },
];

export const TABLES: Record<string, Row[]> = {
  players, teams, seasons, roster_entries, staff, games, batting_lines, pitching_lines, fielding_lines, pa_grades,
  batting_season, pitching_season, fielding_season, qab_season, gameday_profiles, gameday_lineups, depth_chart, staff_duties, staff_standards,
  playbook_plays, play_effectiveness, team_quizzes, team_quiz_questions, team_quiz_answers, scouting_reports, practice_plans, practice_plan_cues,
  install_items, install_item_plans, team_events, training_phases, team_offseason, bp_rounds, bullpen_scripts, player_spotlights,
  team_culture, team_standards, player_advanced_access, player_leadership_access, player_leadership_certificates, measurements,
  mentors, mentor_links, mentor_messages, mentor_focus, mentor_notes, player_activities,
  budget_fees, budget_entries, budget_credits, budget_coach_expenses, player_mental_lessons, coach_mental_lessons, mental_game_plans,
  team_hitting_philosophy, team_throwing_programs, player_journal_entries, parent_links, team_features_off, team_admins,
  team_video_access, video_calls,
};

/** table -> the column other tables use to point at it (for embedded selects) */
export const FK: Record<string, string> = {
  players: "player_id", teams: "team_id", seasons: "season_id", practice_plans: "plan_id", playbook_plays: "play_id", games: "game_id",
  team_quizzes: "quiz_id", team_quiz_questions: "question_id", install_items: "item_id", team_routines: "team_routine_id",
  harada_pillars: "pillar_id", drills: "drill_id",
};

const leaderboard = () => {
  const pts = [86, 74, 71, 63, 60, 58, 52, 47, 44, 39, 35, 30];
  return {
    offseason: { starts_on: "2026-11-01", ends_on: "2027-02-26" },
    today: "2026-11-08",
    week_start: "2026-11-02",
    players: P.map((pid, i) => ({
      player_id: pid, jersey_number: PLAYERS[i][2], first_name: PLAYERS[i][0], last_name: PLAYERS[i][1],
      training: Math.round(pts[i] / 6), workouts: Math.round(pts[i] / 15), lessons: i % 3, unlocks: i % 4, points: pts[i], week_points: Math.round(pts[i] / 3), times_named: 0, last_named: null,
    })),
    weeks: [],
  };
};

const playerFull = (pid: string) => {
  const i = P.indexOf(pid);
  return `${PLAYERS[i][0]} ${PLAYERS[i][1]}`;
};

const viewAccount = (as: string) => ({
  id: U.admin, email: "coach@sample.test", created_at: "2026-11-01T00:00:00Z", confirmed_at: "2026-11-01T00:05:00Z",
  last_sign_in_at: "2026-11-10T21:00:00Z", display_name: "Pat Torres", signed_up_as: as,
});

/** RPC results by function name (anything not listed returns null). */
export function sampleRpc(name: string, args: Row = {}): unknown {
  switch (name) {
    case "team_current_season": return S.fall;
    // admins' "View as" (user, 2026-11-12): the sample admin seen as a parent of Maya and Emma, and as a mentor
    case "admin_view_parent": return {
      account: viewAccount("parent"),
      profile: { display_name: "Pat Torres" },
      links: (sampleRpc("parent_home") as Row[]),
      daughters: (sampleRpc("parent_player_logins") as Row[]).map((d) => ({ ...d, questionnaire: null, medical: null })),
      consent: [],
      packet: [],
      packet_read: [],
      mentor_links: mentor_links.map((l) => ({ mentor_id: l.mentor_id, team_id: l.team_id, player_id: l.player_id, status: l.status })),
      mentors: mentors.map((m) => ({ user_id: m.user_id, display_name: m.display_name, specialty: m.specialty })),
      budgets: [sampleRpc("team_budget_summary")],
      yearbook_teams: [],
      logos: sampleRpc("parent_team_logos"),
    };
    case "admin_view_mentor": return {
      account: viewAccount("mentor"),
      mentor: { display_name: "Coach Sample", specialty: "Pitching", approved_at: "2026-11-01T00:00:00Z" },
      links: sampleRpc("my_mentor_links"),
      players: [maya, emma].map((pid) => ({ id: pid, name: playerFull(pid), position: "SS", team: "GGG Sample 14U", jersey: "2" })),
      messages: mentor_messages.slice(0, 3).map((m) => ({ player_id: m.player_id, body: m.body, drill_name: m.drill_name ?? null, has_photo: !!m.photo_path, created_at: m.created_at, read_at: m.read_at ?? null, shared_with_coaches: !!m.shared_with_coaches })),
      training: [],
      notes: 2,
      focus: 1,
    };
    case "parent_team_logos": return [{ team_id: T.us, team_name: "GGG Sample 14U", logo_path: `${id("bbbbbb", 1)}/1731300000000.png` }];
    case "team_budget_summary": return budgetSummary();
    case "signup_team": return String(args.p_code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "") === "GGG234" ? [{ id: T.us, name: "GGG Sample 14U" }] : [];
    case "team_bp_leaders": return [{ player_id: maya, first_name: "Maya", last_name: "Torres", jersey_number: "2", swings: 21, production: 3.95 }];
    case "team_leaderboard": return leaderboard();
    case "team_squads": return [];
    case "unread_notifications": return 2;
    case "pending_approvals": return [];
    case "player_mentors": return [{ mentor_id: U.admin, display_name: "Coach Sample", specialty: "Pitching" }];
    case "my_admin_team_ids": return [T.us];
    case "video_call_team": return T.us;
    case "video_call_role": return video_calls.find((c) => c.id === args.p_call_id)?.cancelled_at ? "cancelled" : "host";
    // the Parents tab's approved parents (the sample admin, for Maya and Emma; a team admin)
    case "team_parent_links":
      return [maya, emma].map((pid, i) => ({ link_id: id("agag00", i + 1), parent_name: "Pat Torres", email: "coach@sample.test", child_name: playerFull(pid), player_id: pid, status: "approved", requested_at: "2026-11-01T00:00:00Z" }));
    case "staff_requests_to_decide": return [];
    // the sample admin is also a parent of Maya (a whole-team mentor) and Emma (a mentor asks), so the family page's mentor cards render
    case "parent_home":
      return [maya, emma].map((pid, i) => ({ link_id: id("agag00", i + 1), team_id: T.us, team_name: "GGG Sample 14U", child_name: playerFull(pid), player_name: playerFull(pid), status: "approved" }));
    case "parent_player_logins":
      // Emma has no account yet: she's under 13, so the family page shows the parental-consent steps
      return [maya, emma].map((pid) => ({ player_id: pid, player_name: playerFull(pid), team_name: "GGG Sample 14U", on_roster: true, username: null, has_account: pid === maya }));
    case "parent_consent_status":
      return [
        { player_id: maya, birth_date: "2010-03-14", under_13: false, consent_id: null, status: null, method: null, parent_name: null, submitted_at: null, reviewed_at: null, review_note: null },
        { player_id: emma, birth_date: "2014-06-02", under_13: true, consent_id: null, status: null, method: null, parent_name: null, submitted_at: null, reviewed_at: null, review_note: null },
      ];
    // two parents waiting for an admin to check their consent (the Roster tab's "Waiting for approval")
    case "pending_parental_consents":
      return [
        { id: id("acac00", 1), player_id: lila, player_name: playerFull(lila), birth_date: "2014-09-20", team_name: "GGG Sample 14U", parent_name: "Dana Park", parent_account: "Dana Park", parent_email: "dana@sample.test", relationship: "parent", method: "signed_form", form_path: `${U.admin}/1762900000000.jpg`, submitted_at: "2026-11-10T15:00:00Z" },
        { id: id("acac00", 2), player_id: nora, player_name: playerFull(nora), birth_date: "2014-02-11", team_name: "GGG Sample 14U", parent_name: "Chris Bennett", parent_account: "Chris Bennett", parent_email: "chris@sample.test", relationship: "guardian", method: "video_call", form_path: null, submitted_at: "2026-11-11T13:30:00Z" },
      ];
    case "mentor_requests_waiting": return mentor_links.filter((l) => l.status === "pending" && !l.player_id).length;
    case "my_mentor_links":
      return mentor_links
        .filter((l) => l.mentor_id === U.admin)
        .map((l) => ({ id: l.id, team_id: l.team_id, team_name: "GGG Sample 14U", player_id: l.player_id, player_name: l.player_name, status: l.status, requested_at: l.requested_at }));
    case "coaching_staff": return staff.map((s) => ({ user_id: s.user_id, display_name: s.display_name, email: "coach@sample.test" }));
    case "my_practice_notes":
      return practice_plans
        .filter((p) => p.practice_date >= args.p_from && p.practice_date <= args.p_to)
        .map((p) => ({ practice_date: p.practice_date, start_time: p.start_time, team_name: "GGG Sample 14U", objective: p.objective, rule_of_day: p.rule_of_day, announcements: p.announcements, cue: practice_plan_cues.find((c) => c.player_id === args.p_player_id)?.cue ?? null }));
    case "team_quizzes_for":
      return [{ id: QZ, title: "Bunt & slap defense calls", team_name: "GGG Sample 14U", published_at: "2026-11-03T18:00:00Z", total: 2, answered: 1, first_try: 1, to_fix: 0 }];
    case "team_quiz_for":
      return team_quiz_questions.map((q, i) => ({ id: q.id, sort: i, question: q.question, choices: q.choices, chosen_index: i === 0 ? 1 : null, is_correct: i === 0 ? true : null, first_correct: i === 0 ? true : null, correct_index: i === 0 ? q.correct_index : null, explanation: i === 0 ? q.explanation : null }));
    default: return null;
  }
}

/** Ids the page smoke test uses for dynamic routes. */
export const SAMPLE_IDS = {
  player: maya, lightLeader: lila, team: T.us, opponent: T.storm, lineup: id("abab00", 1), game: G.g1, quiz: QZ, plan: PL,
  bullpenScript: bullpen_scripts[0].id, spotlight: player_spotlights[0].id, mentor: U.admin, consentPlayer: emma,
  call: id("a0ca11", 1),
};
