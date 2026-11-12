// Team Hitting Philosophy and the Throwing Program (user, 2026-11-12): the head coach
// writes both in Coaches Dugout → Training; players read their team's on their Team page.
// The throwing program is for position players, not pitchers, in three groups: Outies
// (outfielders), Innies (infielders) and Catchers. The starters below are ours, written
// for fastpitch, for a head coach to load and make their own.
// No imports, so client components and unit tests can use it.

export type PhilosophySection = { title: string; body: string };
export type ThrowStep = { name: string; dose: string | null; cue: string | null };

export const PHILOSOPHY_STATEMENT_MAX = 600;
export const PHILOSOPHY_SECTIONS_MAX = 12;
export const SECTION_TITLE_MAX = 80;
export const SECTION_BODY_MAX = 1500;
export const PROGRAM_INTRO_MAX = 800;
export const PROGRAM_STEPS_MAX = 20;
export const STEP_NAME_MAX = 80;
export const STEP_DOSE_MAX = 60;
export const STEP_CUE_MAX = 300;

export const THROW_GROUPS = [
  { key: "outies", label: "Outies", full: "Outfielders", positions: ["LF", "CF", "RF"] },
  { key: "innies", label: "Innies", full: "Infielders", positions: ["1B", "2B", "3B", "SS"] },
  { key: "catchers", label: "Catchers", full: "Catchers", positions: ["C"] },
] as const;
export type ThrowGroup = (typeof THROW_GROUPS)[number]["key"];

export function isThrowGroup(value: unknown): value is ThrowGroup {
  return THROW_GROUPS.some((g) => g.key === value);
}

export function throwGroup(key: ThrowGroup) {
  return THROW_GROUPS.find((g) => g.key === key)!;
}

/**
 * Her group from her positions (primary first): the first one that fields. Pitchers have their
 * own program, so P (and DP, FLEX, EH) don't count; a P/1B is an Innie. Null for a pitcher only.
 */
export function throwGroupFor(positions: readonly (string | null | undefined)[]): ThrowGroup | null {
  for (const p of positions) {
    const hit = THROW_GROUPS.find((g) => (g.positions as readonly string[]).includes(p ?? ""));
    if (hit) return hit.key;
  }
  return null;
}

const clip = (s: string, max: number) => s.trim().slice(0, max);

/** The form's section rows, trimmed and capped; rows with neither a title nor a body are dropped. */
export function cleanSections(titles: string[], bodies: string[]): PhilosophySection[] {
  const out: PhilosophySection[] = [];
  for (let i = 0; i < Math.max(titles.length, bodies.length); i++) {
    const title = clip(titles[i] ?? "", SECTION_TITLE_MAX);
    const body = clip(bodies[i] ?? "", SECTION_BODY_MAX);
    if (!title && !body) continue;
    out.push({ title: title || "Untitled", body });
  }
  return out.slice(0, PHILOSOPHY_SECTIONS_MAX);
}

/** The form's step rows, trimmed and capped; a row needs a name. */
export function cleanSteps(names: string[], doses: string[], cues: string[]): ThrowStep[] {
  const out: ThrowStep[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = clip(names[i] ?? "", STEP_NAME_MAX);
    if (!name) continue;
    const dose = clip(doses[i] ?? "", STEP_DOSE_MAX);
    const cue = clip(cues[i] ?? "", STEP_CUE_MAX);
    out.push({ name, dose: dose || null, cue: cue || null });
  }
  return out.slice(0, PROGRAM_STEPS_MAX);
}

// ---------------------------------------------------------------------------
// Starters (ours, fastpitch). A head coach loads one into the form and edits it.
// ---------------------------------------------------------------------------

export const PHILOSOPHY_STARTER: { statement: string; sections: PhilosophySection[] } = {
  statement:
    "We are on time, on the attack and hard to get out. We swing at strikes we can drive, we make the pitcher work, and we play the short game as a weapon, not a last resort.",
  sections: [
    {
      title: "On time, every pitch",
      body: "Get your load started early so you're never rushed. Be ready for her best fastball and adjust to anything slower. Late is the most common miss there is; early can still be fixed in the same swing.",
    },
    {
      title: "Hunt your pitch early",
      body: "Ahead or even in the count, look for one pitch in one zone and drive it. If it isn't there, take it and stay ready. A first-pitch strike you can drive is the best pitch you'll see all at-bat.",
    },
    {
      title: "With two strikes, we battle",
      body: "Choke up, widen out a little and protect the plate. Put the ball in play, foul off what you can't drive and make her throw one more. A tough out on pitch eight is a win for the dugout.",
    },
    {
      title: "Situations we win",
      body: "Runner on third, less than two outs: get her in, with a ball in the air to the outfield or hard on the ground up the middle. Runner on second, nobody out: move her over to the right side. Bunt and slap when the play is on, and do it like you mean it.",
    },
    {
      title: "What counts as a quality at-bat",
      body: "A ball hit hard, a walk, an at-bat of six pitches or more, a runner moved or driven in, or an executed bunt or slap. The result isn't always yours; the at-bat is.",
    },
    {
      title: "Words we use",
      body: "\"On time.\" \"Your pitch.\" \"Battle.\" \"Middle of the field.\" Short words, said the same way by every coach, so they mean something in a loud game.",
    },
    {
      title: "After the at-bat",
      body: "Leave the last one at the plate. Back in the dugout, tell the next hitters what you saw: her speed, her movement, what she threw with two strikes.",
    },
  ],
};

export const THROWING_STARTERS: Record<ThrowGroup, { intro: string; steps: ThrowStep[] }> = {
  outies: {
    intro:
      "Outfield arms win games: hit the cutoff, keep the runner from taking the extra base. Every throwing day builds from short and easy to long and on a line. Warm up first, and stop if anything hurts.",
    steps: [
      { name: "Arm care warm-up", dose: "5 minutes", cue: "Jog, then band work: arm circles, pull-aparts, and throwing-motion pulls." },
      { name: "Wrist flicks", dose: "10 throws · 10 ft", cue: "Elbow up, snap the wrist, watch the spin." },
      { name: "One-knee throws", dose: "10 throws · 20 ft", cue: "Throwing-side knee down; rotate the chest to the target and finish over the front leg." },
      { name: "Power-position throws", dose: "10 throws · 40 ft", cue: "Feet set, glove-side shoulder to the target, throw through your partner." },
      { name: "Crow-hop throws", dose: "10 throws · 60–90 ft", cue: "Hop, land closed, and let the momentum carry into the throw." },
      { name: "Long toss", dose: "10–15 throws, build to 120+ ft", cue: "Arc it out to your distance, then work back in with throws on a line." },
      { name: "Ground ball to the cutoff", dose: "8 reps", cue: "Field it through the glove side, crow hop, hit the cutoff chest-high." },
      { name: "Fly ball to a base", dose: "8 reps", cue: "Catch on the throwing side moving forward, crow hop, one-hop it to the base." },
    ],
  },
  innies: {
    intro:
      "Infield throws are about a quick, clean exchange and an accurate ball, not a big arm. Work short to long, then add feet and movement. Warm up first, and stop if anything hurts.",
    steps: [
      { name: "Arm care warm-up", dose: "5 minutes", cue: "Jog, then band work: arm circles, pull-aparts, and throwing-motion pulls." },
      { name: "Wrist flicks", dose: "10 throws · 10 ft", cue: "Elbow up, snap the wrist, watch the spin." },
      { name: "One-knee throws", dose: "10 throws · 20 ft", cue: "Rotate the chest to the target; finish with the throwing shoulder pointing at your partner." },
      { name: "Quick exchange", dose: "10 reps · 30 ft", cue: "Glove to the middle of the chest, hand meets it, four-seam grip, release." },
      { name: "Step-behind throws", dose: "10 throws · 60 ft", cue: "Throwing foot steps behind the glove foot to line up, then throw through the target." },
      { name: "Slow roller on the run", dose: "8 reps", cue: "Charge it, field it off the glove-side foot and throw on the move; underhand when it's close." },
      { name: "Feeds and flips at second", dose: "8 each side", cue: "Short and firm, chest-high, let the fielder see the ball early." },
      { name: "Backhand and throw across", dose: "8 reps", cue: "Plant the back foot hard, gather and throw through first base." },
      { name: "Stretch-out throws", dose: "10 throws · build to 90 ft", cue: "Finish the day long and easy on a line." },
    ],
  },
  catchers: {
    intro:
      "A catcher's throw is footwork first: a quick transfer and short, square feet beat a big arm. Build the footwork without a ball, then add the throw. Warm up first, and stop if anything hurts.",
    steps: [
      { name: "Arm care warm-up", dose: "5 minutes", cue: "Jog, then band work: arm circles, pull-aparts, and throwing-motion pulls." },
      { name: "Wrist flicks", dose: "10 throws · 10 ft", cue: "Elbow up, snap the wrist, watch the spin." },
      { name: "Throws from the knees", dose: "10 throws · 40 ft", cue: "Upper body only: rotate, keep the elbow at shoulder height, follow through." },
      { name: "Transfer drill", dose: "10 reps", cue: "Catch it deep in the pocket and take it to the ear in one motion; no ball-in-glove fishing." },
      { name: "Footwork to second, no ball", dose: "10 reps", cue: "Short replace step, shoulders square to second, front shoulder closed." },
      { name: "Throw-downs to second", dose: "6–8 throws", cue: "Same footwork, now with the ball; aim for the bag at knee height." },
      { name: "Throws to third", dose: "6 throws", cue: "Clear the right-handed hitter: step behind or in front, then throw through the bag." },
      { name: "Back-picks to first", dose: "6 throws", cue: "Quick pivot, low and to the bag side so the first baseman can tag." },
      { name: "Block, recover, throw", dose: "6 reps", cue: "Block the ball, find it, pop up and throw to the base the runner is going to." },
    ],
  },
};
