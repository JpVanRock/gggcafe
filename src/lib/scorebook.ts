// How to Keep the Book: the Softball IQ scorekeeping course. Six chapters of short
// lessons, written for GGG.Cafe from the user's scorekeeping guide for first-timers
// (original wording, adapted to fastpitch; Chapter 6 covers plays that guide leaves
// out). Each chapter ends with a 5-question quiz graded in the database (questions
// in supabase/iq/scorebook.json, track 'scorebook', level = chapter). Finishing a
// chapter's lessons and scoring 80%+ on its quiz earns a Manager of the Year award.
// No imports, so it runs in unit tests.

// ---------------------------------------------------------------------------
// Pictures: one at-bat box, a page of the book, or the field with position numbers
// ---------------------------------------------------------------------------

export type BoxPart = "pitches" | "reached" | "hits" | "diamond" | "rbi" | "out" | "play";

/** One box of the scorebook: one trip to the plate. */
export type BoxMarks = {
  balls?: number;
  strikes?: number;
  /** circled in the lower-left corner */
  reached?: "BB" | "HP" | "SAC";
  /** circled hit type: 1 single, 2 double, 3 triple, 4 home run */
  hit?: 1 | 2 | 3 | 4;
  /** how far around she got: 1 = first ... 4 = scored (the diamond is shaded) */
  path?: number;
  /** path segments drawn on this step, in pink: 1 = home to first ... 4 = third to home */
  fresh?: number[];
  /** the play in the middle: "6-3", "F8", "K", "Kc" (called third strike, drawn as a backwards K), "E6" */
  play?: string;
  /** which out of the inning she made */
  out?: 1 | 2 | 3;
  /** jersey number of the batter who drove her in */
  rbi?: string;
  /** slash across the corner: she made the last out of the inning */
  lastOut?: boolean;
  /** how she moved up along a segment: SB, WP, PB */
  notes?: { seg: number; text: string }[];
  highlight?: BoxPart;
};
export type BoxSpec = BoxMarks & { kind: "box" };

/** A page of the book: the lineup and a few inning columns. Rows and innings count from 1. */
export type SheetSpec = {
  kind: "sheet";
  innings: number;
  /** lineup rows shown (default 9) */
  rows?: number;
  /** false: a blank lineup (no names or numbers yet) */
  names?: boolean;
  /** the lineup to print (default: the lessons' sample lineup) */
  lineup?: { no: string; name: string }[];
  /** show the after-game stat columns on the right */
  stats?: boolean;
  /** key "row-inning", e.g. "3-1" */
  cells?: Record<string, BoxMarks>;
  highlight?: { lineup?: boolean; inning?: number; row?: number; cell?: [number, number]; stats?: boolean };
  /** squiggle down an inning column over the batters who didn't bat */
  squiggle?: { inning: number; fromRow: number; toRow?: number };
  /** the order flowing down a column */
  arrow?: { inning: number; fromRow: number; toRow: number };
  tag?: { row: number; inning: number; text: string };
};

/** The field. Fielders are numbered 1-9 (or labeled P, C, 1B... in quizzes, so the numbers aren't given away). */
export type FieldSpec = {
  kind: "field";
  labels?: "numbers" | "letters";
  highlight?: number[];
  ball?: { to: number; type?: "ground" | "fly" | "line" };
  throws?: [number, number][];
};

export type Visual = BoxSpec | SheetSpec | FieldSpec;

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export type Step = {
  title: string;
  body: string[];
  visual?: Visual;
  /** the batter's box, big, next to the sheet (the half-inning walk-through) */
  zoom?: BoxSpec;
  /** tap a part to light it up */
  explore?: { label: string; text: string; visual: Visual }[];
  /** a quick check with instant feedback (not graded) */
  check?: { question: string; choices: string[]; answer: number; why: string };
  /** tap the fielders in the order they handled the ball */
  tap?: { prompt: string; answer: number[] };
};

export type Chapter = {
  n: number;
  title: string;
  /** for chips, badges and the trophy shelf */
  short: string;
  blurb: string;
  steps: Step[];
};

export const POSITION_NUMBERS: { n: number; name: string; code: string }[] = [
  { n: 1, name: "Pitcher", code: "P" },
  { n: 2, name: "Catcher", code: "C" },
  { n: 3, name: "First base", code: "1B" },
  { n: 4, name: "Second base", code: "2B" },
  { n: 5, name: "Third base", code: "3B" },
  { n: 6, name: "Shortstop", code: "SS" },
  { n: 7, name: "Left field", code: "LF" },
  { n: 8, name: "Center field", code: "CF" },
  { n: 9, name: "Right field", code: "RF" },
];

/** The sample lineup used in the lessons. */
export const LINEUP: { no: string; name: string }[] = [
  { no: "3", name: "Cole, A." },
  { no: "11", name: "Reyes, J." },
  { no: "7", name: "Torres, M." },
  { no: "22", name: "Shaw, K." },
  { no: "15", name: "Park, L." },
  { no: "9", name: "Diaz, R." },
  { no: "18", name: "Grant, T." },
  { no: "4", name: "Moreno, S." },
  { no: "27", name: "Brooks, N." },
];

/** Notation for a play from the fielders who handled the ball: [6, 3] is "6-3"; one fielder alone is "3U". */
export function playNotation(fielders: number[]): string {
  if (fielders.length === 0) return "";
  return fielders.length === 1 ? `${fielders[0]}U` : fielders.join("-");
}

// A sample 1st inning used across chapters 1 and 2.
const FIRST_INNING: Record<string, BoxMarks> = {
  "1-1": { hit: 1, path: 1 },
  "2-1": { play: "F8", out: 1 },
  "3-1": { hit: 1, path: 2 },
  "4-1": { play: "4-3", out: 2 },
  "5-1": { reached: "BB", path: 1 },
  "6-1": { play: "K", out: 3, lastOut: true },
};

// The half-inning walk-through in Chapter 5, one batter at a time.
const HALF: Record<string, BoxMarks>[] = [
  {},
  { "1-1": { hit: 1, path: 1, fresh: [1] } },
  { "1-1": { hit: 1, path: 2, fresh: [2] }, "2-1": { hit: 1, path: 1, fresh: [1] } },
  {
    "1-1": { hit: 1, path: 4, rbi: "7", fresh: [3, 4] },
    "2-1": { hit: 1, path: 3, fresh: [3] },
    "3-1": { hit: 2, path: 2, fresh: [1, 2] },
  },
  {
    "1-1": { hit: 1, path: 4, rbi: "7" },
    "2-1": { hit: 1, path: 4, rbi: "22", fresh: [4] },
    "3-1": { hit: 2, path: 3, fresh: [3] },
    "4-1": { play: "F9", out: 1, reached: "SAC" },
  },
];
HALF.push({ ...HALF[4], "2-1": { hit: 1, path: 4, rbi: "22" }, "3-1": { hit: 2, path: 3 }, "5-1": { play: "6-3", out: 2 } });
HALF.push({ ...HALF[5], "6-1": { play: "K", out: 3, lastOut: true } });

const sheet = (extra: Omit<SheetSpec, "kind" | "innings"> & { innings?: number } = {}): SheetSpec => ({ kind: "sheet", innings: 3, ...extra });
const box = (marks: BoxMarks = {}): BoxSpec => ({ kind: "box", ...marks });

export const CHAPTERS: Chapter[] = [
  {
    n: 1,
    title: "The Scorebook Page",
    short: "The Page",
    blurb: "What the book is for and how a page is laid out: the lineup, inning columns and player rows.",
    steps: [
      {
        title: "The official record",
        body: [
          "The scorebook is the official record of the game. Every at-bat, every out and every run goes in it, in the order it happened.",
          "During the game it settles the questions that come up fast: who's up, how many outs there are, where the runners were before the last play. After the game, every stat on your player page starts here.",
        ],
        visual: sheet({ cells: FIRST_INNING }),
      },
      {
        title: "Two pages a game",
        body: [
          "Each team gets its own page: one for your team, one for your opponent.",
          "When three outs end a half-inning, turn to the other team's page and pick up where their lineup left off.",
        ],
        visual: sheet({ cells: FIRST_INNING, squiggle: { inning: 1, fromRow: 7 } }),
      },
      {
        title: "The lineup column",
        body: [
          "Down the left side is the lineup: each batting spot with the player's jersey number and name, in the order they hit.",
          "Most books leave extra lines under every spot. When a substitute comes in, she goes on the line under the player she replaced, so the spot keeps its place in the order.",
        ],
        visual: sheet({ highlight: { lineup: true } }),
      },
      {
        title: "Inning columns tell the story",
        body: ["Every inning has its own column. Read down a column and you watch that inning happen, batter by batter, in order."],
        visual: sheet({ cells: FIRST_INNING, highlight: { inning: 1 } }),
      },
      {
        title: "Player rows tell her game",
        body: ["Every batter has her own row. Read across it and you see each trip she made to the plate, inning by inning."],
        visual: sheet({ cells: { ...FIRST_INNING, "3-3": { play: "F7", out: 1 } }, highlight: { row: 3 } }),
        check: {
          question: "You want to see everything #7 did at the plate today. Where do you look?",
          choices: ["Down the 1st inning column", "Across #7's row", "The totals along the bottom", "The pitching lines"],
          answer: 1,
          why: "Her row runs across every inning, so all of her at-bats sit on one line.",
        },
      },
      {
        title: "The box",
        body: [
          "Where a row meets a column is a box: one trip to the plate, by one batter, in one inning. Almost everything you write goes in a box.",
          "Chapter 3 takes the box apart piece by piece.",
        ],
        visual: sheet({ cells: FIRST_INNING, highlight: { cell: [3, 1] } }),
      },
      {
        title: "What can wait",
        body: [
          "The columns on the far right (at-bats, runs, hits, RBIs) and the totals along the bottom get added up after the game. So do the pitching lines.",
          "While you're learning, keep your eyes on two things: the lineup and the boxes. Get those right and the rest can be counted later.",
        ],
        visual: sheet({ innings: 2, cells: FIRST_INNING, stats: true, highlight: { stats: true } }),
      },
      {
        title: "Find your way around",
        body: ["Tap each part of the page to light it up."],
        explore: [
          { label: "Lineup", text: "The batting order: spot, jersey number, name.", visual: sheet({ cells: FIRST_INNING, highlight: { lineup: true } }) },
          { label: "Inning column", text: "Read down: the story of one inning.", visual: sheet({ cells: FIRST_INNING, highlight: { inning: 1 } }) },
          { label: "Player row", text: "Read across: one batter's whole game.", visual: sheet({ cells: FIRST_INNING, highlight: { row: 5 } }) },
          { label: "A box", text: "One trip to the plate.", visual: sheet({ cells: FIRST_INNING, highlight: { cell: [4, 1] } }) },
          {
            label: "After-game columns",
            text: "Totals you add up once the game is over.",
            visual: sheet({ innings: 2, cells: FIRST_INNING, stats: true, highlight: { stats: true } }),
          },
        ],
      },
    ],
  },
  {
    n: 2,
    title: "Lineup and Batting Order",
    short: "The Lineup",
    blurb: "Writing the lineup, following the order down each column, and starting the next inning in the right box.",
    steps: [
      {
        title: "Lineup first",
        body: [
          "Before the first pitch, get the batting order from each coach and copy it into the lineup column of that team's page: spot, jersey number, name.",
        ],
        visual: sheet({ highlight: { lineup: true } }),
      },
      {
        title: "Numbers matter most",
        body: [
          "Jersey numbers are how you'll follow players all game, and the RBI spot in each box uses them too. Check every number against the players on the field.",
          "No lineup when the game starts? Write each batter's number as she steps in and fill in the names later.",
        ],
        visual: sheet({ highlight: { lineup: true } }),
      },
      {
        title: "One box per trip to the plate",
        body: [
          "The leadoff batter's first at-bat goes in the top box of the inning 1 column. Each batter after her takes the next box down.",
          "The box you use always comes down to two things: who's batting and what inning it is.",
        ],
        visual: sheet({ highlight: { cell: [1, 1] }, arrow: { inning: 1, fromRow: 1, toRow: 6 } }),
      },
      {
        title: "Third out: slash it",
        body: [
          "When the third out is made, finish that batter's box, then draw a short slash across its lower-right corner. The slash marks where the inning ended.",
          "Many scorekeepers also draw a squiggle down the rest of the column so nobody writes there by mistake.",
        ],
        visual: sheet({ cells: FIRST_INNING, highlight: { cell: [6, 1] }, squiggle: { inning: 1, fromRow: 7 } }),
      },
      {
        title: "New inning, new column",
        body: [
          "The next inning starts with the batter after the one who made the last out. Find her row, then move one column to the right.",
          "Here the 6th batter made the last out of the 1st, so the 7th batter leads off the 2nd.",
        ],
        visual: sheet({
          cells: FIRST_INNING,
          squiggle: { inning: 1, fromRow: 7 },
          highlight: { cell: [7, 2] },
          tag: { row: 7, inning: 2, text: "LEADS OFF" },
        }),
      },
      {
        title: "Batting around",
        body: [
          "If the whole order comes up in one inning, the top of the order bats again before the third out. Her box for that inning is already used, so her second trip goes in the next column over.",
          "Write the inning number above that box so the story still reads in order.",
        ],
      },
      {
        title: "Your turn: who leads off?",
        body: ["The 1st and 2nd innings are done. Read down the columns and find the last out of the 2nd."],
        visual: sheet({
          cells: {
            ...FIRST_INNING,
            "7-2": { play: "F9", out: 1 },
            "8-2": { hit: 1, path: 1 },
            "9-2": { play: "K", out: 2 },
            "1-2": { play: "6-3", out: 3, lastOut: true },
          },
          squiggle: { inning: 2, fromRow: 2, toRow: 6 },
        }),
        check: {
          question: "Who leads off the 3rd inning?",
          choices: ["#3 Cole", "#11 Reyes", "#18 Grant", "#27 Brooks"],
          answer: 1,
          why: "Cole, in the 1st spot, made the last out of the 2nd (the slash is in her box). The next spot, #11 Reyes, leads off the 3rd.",
        },
      },
    ],
  },
  {
    n: 3,
    title: "The Box",
    short: "The Box",
    blurb: "Every part of the box: the count, how she reached, her hit, the diamond, runs, RBIs and outs.",
    steps: [
      {
        title: "A lot in a little space",
        body: [
          "Every box is one trip to the plate. There isn't much room, so scorekeepers use shorthand: a few marks tell the whole at-bat.",
          "Here's an empty box. Each part has a job.",
        ],
        visual: box(),
      },
      {
        title: "Balls and strikes",
        body: [
          "The small squares in the top-left corner keep the count: the top row for balls, the bottom row for strikes. Mark one with every pitch.",
          "There are only three ball squares and two strike squares. Ball four is a walk and strike three is a strikeout, so those pitches end the at-bat instead of filling a square.",
        ],
        visual: box({ balls: 2, strikes: 1, highlight: "pitches" }),
      },
      {
        title: "BB · HP · SAC",
        body: [
          "The letters in the lower-left corner cover the ways a batter reaches base, or helps a runner, without a hit. Circle the one that happened.",
          "BB is a base on balls (a walk). HP is hit by pitch. SAC is a sacrifice: a bunt or fly ball that moves a runner up while the batter is put out.",
        ],
        visual: box({ balls: 3, strikes: 1, reached: "BB", path: 1, highlight: "reached" }),
      },
      {
        title: "1 · 2 · 3 · HR",
        body: ["The numbers across the top are for hits. Circle 1 for a single, 2 for a double, 3 for a triple, HR for a home run."],
        visual: box({ hit: 2, highlight: "hits" }),
      },
      {
        title: "The diamond",
        body: [
          "The dots in the middle of the box are the bases. Trace her path along them: home to first for a single, on to second for a double.",
          "Keep extending her line as she moves up later in the inning, so the box always shows how far she got.",
        ],
        visual: box({ hit: 2, path: 2, highlight: "diamond" }),
      },
      {
        title: "She scored",
        body: ["When she touches home, close the diamond and shade it in. A shaded diamond is a run, so the runs are easy to count at the end of the inning."],
        visual: box({ hit: 1, path: 4, highlight: "diamond" }),
      },
      {
        title: "The RBI spot",
        body: ["The small triangle under home holds the jersey number of the batter who drove her in. That's how the RBI gets credited to the right player."],
        visual: box({ hit: 1, path: 4, rbi: "22", highlight: "rbi" }),
        check: {
          question: "Avery scores on Kenzie's double. Kenzie wears #22. What goes in the triangle in Avery's box?",
          choices: ["Avery's jersey number", "22", "The inning number", "A 2, for the double"],
          answer: 1,
          why: "The triangle credits the RBI, so it gets the number of the batter who drove her in: Kenzie, #22.",
        },
      },
      {
        title: "The out corner",
        body: [
          "The curved corner at the bottom right is for outs. Write which out of the inning it was: 1, 2 or 3.",
          "Then write the play in the middle of the box. A ground ball to second, thrown to first for the first out, looks like this: 4-3 with a 1 in the corner. Chapter 4 explains the numbers.",
        ],
        visual: box({ play: "4-3", out: 1, highlight: "out" }),
      },
      {
        title: "Tap the box",
        body: ["Tap each part to see what it's for."],
        explore: [
          { label: "Count", text: "Balls on top, strikes underneath. One mark per pitch.", visual: box({ balls: 2, strikes: 2, highlight: "pitches" }) },
          { label: "BB · HP · SAC", text: "Circle how she reached (or helped a runner) without a hit.", visual: box({ reached: "HP", path: 1, highlight: "reached" }) },
          { label: "Hits", text: "Circle 1, 2, 3 or HR.", visual: box({ hit: 3, path: 3, highlight: "hits" }) },
          { label: "Diamond", text: "Her path around the bases. Shaded means she scored.", visual: box({ hit: 1, path: 4, highlight: "diamond" }) },
          { label: "RBI", text: "Number of the batter who drove her in.", visual: box({ hit: 1, path: 4, rbi: "15", highlight: "rbi" }) },
          { label: "Out", text: "Which out of the inning: 1, 2 or 3.", visual: box({ play: "6-3", out: 2, highlight: "out" }) },
        ],
      },
    ],
  },
  {
    n: 4,
    title: "Position Numbers and Outs",
    short: "Positions",
    blurb: "Why scorekeepers use numbers instead of names, and how to write ground outs, fly outs and strikeouts.",
    steps: [
      {
        title: "Numbers, not names",
        body: [
          "Fans follow names. Scorekeepers use numbers. Every position on the field has one, and it never changes, no matter who's playing there.",
          "That's how a whole play fits in a tiny box.",
        ],
        visual: { kind: "field" },
      },
      {
        title: "The nine numbers",
        body: [
          "1 pitcher · 2 catcher · 3 first base · 4 second base · 5 third base · 6 shortstop · 7 left field · 8 center field · 9 right field.",
          "The one that trips people up: the shortstop is 6, even though she plays between third (5) and second (4).",
          "Slowpitch adds a tenth fielder, usually numbered 10. Most books print a small field with the numbers on every page, so you never have to guess.",
        ],
        visual: { kind: "field", highlight: [6] },
        check: {
          question: "What number is the center fielder?",
          choices: ["7", "8", "9", "6"],
          answer: 1,
          why: "The outfield goes 7, 8, 9 from left to right, so center field is 8.",
        },
      },
      {
        title: "Ground outs",
        body: [
          "On a ground out, write the fielder who fielded the ball, a dash, then the fielder who caught the throw for the out.",
          "Ground ball to second, thrown to first: 4-3.",
        ],
        visual: { kind: "field", ball: { to: 4, type: "ground" }, throws: [[4, 3]] },
        zoom: box({ play: "4-3", out: 1 }),
      },
      {
        title: "Your turn: build the play",
        body: ["Ground ball to the shortstop, and she throws to first for the out."],
        tap: { prompt: "Tap the fielders in the order they handled the ball.", answer: [6, 3] },
      },
      {
        title: "Unassisted",
        body: [
          "When one fielder makes the out by herself, write her number and a U for unassisted.",
          "A grounder to the first baseman that she carries to the bag herself is 3U.",
        ],
        visual: { kind: "field", ball: { to: 3, type: "ground" }, highlight: [3] },
        zoom: box({ play: "3U", out: 2 }),
      },
      {
        title: "Caught in the air",
        body: [
          "A fly ball caught for an out is F and the fielder's number. A fly ball caught in center field is F8.",
          "A line drive caught is L and the number, like L6. Some books write FO-8 for a fly out. It means the same thing.",
        ],
        visual: { kind: "field", ball: { to: 8, type: "fly" }, highlight: [8] },
        zoom: box({ play: "F8", out: 1 }),
        check: {
          question: "The right fielder catches a fly ball. How do you score it?",
          choices: ["F7", "F9", "9-3", "L9"],
          answer: 1,
          why: "Caught in the air is F, and the right fielder is 9: F9.",
        },
      },
      {
        title: "Strikeouts",
        body: [
          "A strikeout is a K. Write it in the middle of the box with the out number in the corner.",
          "Chapter 6 covers the backwards K for a called third strike.",
        ],
        visual: box({ balls: 1, strikes: 2, play: "K", out: 3 }),
      },
      {
        title: "Your turn: the force at second",
        body: ["Ground ball to the third baseman. She throws to the second baseman covering second for the force out."],
        tap: { prompt: "Tap the fielders in order.", answer: [5, 4] },
      },
    ],
  },
  {
    n: 5,
    title: "Score a Half-Inning",
    short: "Half-Inning",
    blurb: "Put it all together: score a full half-inning, batter by batter, with runners, runs and RBIs.",
    steps: [
      {
        title: "Play ball",
        body: [
          "Time to put it together. Here's the top of the 1st, one batter at a time.",
          "The sheet shows the inning so far, and the big box is the batter at the plate. Pink lines are what you add on that play.",
        ],
        visual: sheet({ innings: 2, highlight: { cell: [1, 1] } }),
      },
      {
        title: "Cole singles",
        body: ["#3 Cole leads off with a single. Circle the 1 and draw her line from home to first."],
        visual: sheet({ innings: 2, cells: HALF[1], highlight: { cell: [1, 1] } }),
        zoom: box(HALF[1]["1-1"]),
      },
      {
        title: "Reyes singles, Cole to second",
        body: [
          "#11 Reyes singles too, and Cole moves up to second.",
          "Score Reyes's single in her box, then go back to Cole's box and extend her line to second.",
        ],
        visual: sheet({ innings: 2, cells: HALF[2], highlight: { cell: [2, 1] } }),
        zoom: box(HALF[2]["2-1"]),
      },
      {
        title: "Torres doubles: a run scores",
        body: [
          "#7 Torres doubles. Cole scores and Reyes goes to third.",
          "Torres's box: circle the 2 and draw her line to second. Reyes's box: extend to third. Cole's box: close the diamond, shade it in, and write 7 in her triangle, because Torres drove her in.",
        ],
        visual: sheet({ innings: 2, cells: HALF[3], highlight: { cell: [3, 1] } }),
        zoom: box(HALF[3]["3-1"]),
        check: {
          question: "Who gets the RBI for Cole's run?",
          choices: ["#3 Cole", "#11 Reyes", "#7 Torres", "Nobody"],
          answer: 2,
          why: "Torres's double drove Cole in, so Torres gets the RBI and her number, 7, goes in Cole's triangle.",
        },
      },
      {
        title: "Shaw's sacrifice fly",
        body: [
          "#22 Shaw flies out to right field. Reyes tags up and scores, and Torres tags and takes third.",
          "Shaw's box: F9 with a 1 in the out corner. Circle SAC too: her fly ball scored a run while she was out. Reyes's box: shade the diamond and write 22. Torres's box: extend her line to third.",
        ],
        visual: sheet({ innings: 2, cells: HALF[4], highlight: { cell: [4, 1] } }),
        zoom: box(HALF[4]["4-1"]),
      },
      {
        title: "Park grounds out",
        body: ["#15 Park grounds to the shortstop, who throws to first: 6-3, the second out. Torres holds at third."],
        visual: sheet({ innings: 2, cells: HALF[5], highlight: { cell: [5, 1] } }),
        zoom: box(HALF[5]["5-1"]),
      },
      {
        title: "Diaz strikes out",
        body: [
          "#9 Diaz strikes out swinging: K, with a 3 in the out corner. That's three outs.",
          "Slash the corner of Diaz's box and squiggle down the rest of the column. Torres is left stranded on third.",
        ],
        visual: sheet({ innings: 2, cells: HALF[6], highlight: { cell: [6, 1] }, squiggle: { inning: 1, fromRow: 7 } }),
        zoom: box(HALF[6]["6-1"]),
      },
      {
        title: "Count the runs",
        body: ["Count the shaded diamonds in the column to get the inning's runs. Then turn to the other team's page for the bottom of the 1st."],
        visual: sheet({ innings: 2, cells: HALF[6], squiggle: { inning: 1, fromRow: 7 }, highlight: { inning: 1 } }),
        check: {
          question: "How many runs did this team score in the 1st?",
          choices: ["1", "2", "3", "4"],
          answer: 1,
          why: "Two diamonds are shaded: Cole and Reyes. Torres was left on third.",
        },
      },
      {
        title: "Ready for the 2nd",
        body: ["When this team bats again, the order picks up right after Diaz."],
        visual: sheet({ innings: 2, cells: HALF[6], squiggle: { inning: 1, fromRow: 7 } }),
        check: {
          question: "Who leads off the top of the 2nd?",
          choices: ["#3 Cole", "#18 Grant", "#9 Diaz", "#4 Moreno"],
          answer: 1,
          why: "Diaz, the 6th batter, made the last out, so the 7th batter, #18 Grant, leads off in the inning 2 column.",
        },
      },
    ],
  },
  {
    n: 6,
    title: "Fastpitch Extras",
    short: "Extras",
    blurb: "Plays you'll see every weekend: walks, called third strikes, errors, fielder's choices, double plays and steals.",
    steps: [
      {
        title: "Walks and hit by pitch",
        body: ["Circle BB or HP and draw her line to first. Neither one is a hit, and neither counts as an at-bat."],
        visual: box({ balls: 2, reached: "HP", path: 1, highlight: "reached" }),
      },
      {
        title: "Called third strike",
        body: ["If she takes strike three without swinging, write the K backwards. A regular K means she struck out swinging."],
        visual: box({ balls: 1, strikes: 2, play: "Kc", out: 2, highlight: "play" }),
        check: {
          question: "She watches strike three go by. What goes in her box?",
          choices: ["K", "A backwards K", "SO", "F2"],
          answer: 1,
          why: "A called third strike is a backwards K. A forward K is a swinging strikeout.",
        },
      },
      {
        title: "Errors",
        body: [
          "When she reaches because a fielder misplays the ball, write E and that fielder's number, like E6, and draw her line to first.",
          "Don't circle the 1. An error isn't a hit.",
        ],
        visual: box({ play: "E6", path: 1, highlight: "play" }),
        check: {
          question: "The shortstop boots a routine grounder and the batter is safe. How do you score it?",
          choices: ["Circle 1 and draw a line to first", "E6, and a line to first", "FC", "6-3"],
          answer: 1,
          why: "She reached on the shortstop's error: E6. It's not a hit, so the 1 stays uncircled.",
        },
      },
      {
        title: "Fielder's choice",
        body: [
          "Sometimes she reaches only because the defense went after another runner instead. Write FC in her box and draw her line to first.",
          "The runner who was put out gets the out in her own box, like 6-4 for a force at second.",
        ],
        visual: box({ play: "FC", path: 1, highlight: "play" }),
      },
      {
        title: "Double plays",
        body: [
          "Two outs on one play. Each runner's out goes in her own box with its out number.",
          "In the batter's box, write the whole play and DP: shortstop to second to first is 6-4-3 DP.",
        ],
        visual: box({ play: "6-4-3 DP", out: 2, highlight: "play" }),
      },
      {
        title: "Steals, wild pitches, passed balls",
        body: [
          "When a runner moves up between pitches, extend her line and write how she got there next to it: SB for a stolen base, WP for a wild pitch, PB for a passed ball.",
        ],
        visual: box({ hit: 1, path: 2, fresh: [2], notes: [{ seg: 2, text: "SB" }], highlight: "diamond" }),
      },
      {
        title: "Sacrifice bunts",
        body: [
          "A bunt that moves a runner up while the batter is thrown out is a sacrifice. Circle SAC, write the play and the out number: a bunt fielded by the third baseman and thrown to first is 5-3.",
          "Like a walk, it doesn't count as an at-bat.",
        ],
        visual: box({ reached: "SAC", play: "5-3", out: 1, highlight: "reached" }),
      },
      {
        title: "Pencil, not pen",
        body: [
          "Plays happen fast. Write lightly, keep an eraser close, and compare books with the other scorekeeper between innings.",
          "Missed a call? Ask the coach or the umpire. Never guess.",
        ],
      },
    ],
  },
];

export const CHAPTER_COUNT = CHAPTERS.length;
export const QUIZ_LENGTH = 5;
export const PASS_PCT = 80;

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** A player's progress through one chapter's lessons (step is the furthest step she reached, from 0). */
export type ChapterProgress = { chapter: number; step: number; completedAt: string | null };

/**
 * locked: the previous chapter isn't complete · new: not started · reading: partway
 * through the lessons · quiz: lessons done, quiz not passed yet · complete: award earned.
 */
export type ChapterStatus = "locked" | "new" | "reading" | "quiz" | "complete";

export function chapterStatus(n: number, progress: ChapterProgress[], awards: number[]): ChapterStatus {
  if (awards.includes(n)) return "complete";
  if (n > 1 && !awards.includes(n - 1)) return "locked";
  const p = progress.find((x) => x.chapter === n);
  if (p?.completedAt) return "quiz";
  return p && p.step > 0 ? "reading" : "new";
}

/** Chapters complete, and the chapter to work on next (null when the course is done). */
export function courseProgress(progress: ChapterProgress[], awards: number[]) {
  const done = CHAPTERS.filter((c) => awards.includes(c.n)).length;
  const next = CHAPTERS.find((c) => {
    const s = chapterStatus(c.n, progress, awards);
    return s !== "complete" && s !== "locked";
  });
  return { done, total: CHAPTER_COUNT, next: next?.n ?? null };
}
