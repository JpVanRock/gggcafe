// Movement Preferences and Preferred Hitting Style: categories, choices and
// plain-language explanations (written for a 10-year-old), plus the move dial.
// No imports, so it runs in server and client code and in unit tests.
// `coach` is the testing term coaches use; players see `label` and `about`.

export type Choice = { value: string; label: string; coach: string; about: string };
export type Category = { key: string; title: string; coach: string; intro: string; choices: Choice[] };

// ---------------------------------------------------------------------------
// Movement Preferences (set by coaches after testing)
// ---------------------------------------------------------------------------
export const MOVEMENT: Category[] = [
  {
    key: "move_style",
    title: "How you move",
    coach: "Aerial vs. Terrestrial",
    intro: "Every great athlete moves a little differently. This is your natural way.",
    choices: [
      {
        value: "aerial",
        label: "Bouncy & light",
        coach: "Aerial",
        about: "You're at your best up on the front of your feet. You bounce, lead with your shoulders and spend more time in the air.",
      },
      {
        value: "terrestrial",
        label: "Grounded & strong",
        coach: "Terrestrial",
        about: "You're at your best with your weight back toward your heels. You push hard off the ground and lead with your hips.",
      },
    ],
  },
  {
    key: "power_side",
    title: "Your balance leg",
    coach: "Extension side",
    intro: "One leg is the one your body trusts most to land on, balance on and bounce off.",
    choices: [
      { value: "right", label: "Right leg", coach: "Right extension", about: "Your right leg is your go-to leg for balance and bounce." },
      { value: "left", label: "Left leg", coach: "Left extension", about: "Your left leg is your go-to leg for balance and bounce." },
    ],
  },
  {
    key: "dial_one",
    title: "Your #1 spot",
    coach: "Move dial #1",
    intro: "The part of your feet where you're strongest and most balanced. Load from your #1 when you get ready to throw or swing.",
    choices: [
      { value: "left_front", label: "Left toes", coach: "MD #1 left front", about: "The front of your left foot is your strongest spot." },
      { value: "right_front", label: "Right toes", coach: "MD #1 right front", about: "The front of your right foot is your strongest spot." },
      { value: "left_heel", label: "Left heel", coach: "MD #1 left heel", about: "Your left heel is your strongest spot." },
      { value: "right_heel", label: "Right heel", coach: "MD #1 right heel", about: "Your right heel is your strongest spot." },
    ],
  },
  {
    key: "flex",
    title: "Low or tall",
    coach: "Flexion / extension",
    intro: "Some players feel strongest down low with bent knees. Others feel strongest tall and springy.",
    choices: [
      { value: "double_flexion", label: "Extra low", coach: "Double flexion", about: "You feel strongest sitting way down, with your knees and hips really bent." },
      { value: "flexion", label: "Low", coach: "Flexion", about: "You feel strongest a little low, with your knees bent." },
      { value: "extension", label: "Tall", coach: "Extension", about: "You feel strongest standing a little taller and springy." },
      { value: "double_extension", label: "Extra tall", coach: "Double extension", about: "You feel strongest tall and springy, almost up on your toes." },
    ],
  },
  {
    key: "breathing",
    title: "Your power breath",
    coach: "Breathe in / out",
    intro: "Your body is strongest at one moment of your breath.",
    choices: [
      { value: "in", label: "Breathe in", coach: "Breathe in", about: "You're strongest right after a big breath in: tall back, chest up." },
      { value: "out", label: "Breathe out", coach: "Breathe out", about: "You're strongest right after you breathe out: chin forward, belly tight." },
    ],
  },
  {
    key: "twist",
    title: "How you turn",
    coach: "Associated vs. Disassociated",
    intro: "How your shoulders and hips work together when you turn.",
    choices: [
      {
        value: "associated",
        label: "All together",
        coach: "Associated",
        about: "Your shoulders and hips like to turn together, as one piece. You like facing things straight on and moving in straight lines.",
      },
      {
        value: "disassociated",
        label: "Coiled spring",
        coach: "Disassociated",
        about: "Your shoulders can turn while your hips stay still, like winding up a spring. You like moving at angles and in any direction.",
      },
    ],
  },
  {
    key: "space",
    title: "Your space",
    coach: "Axial vs. Large",
    intro: "How much room you like around your body when you move.",
    choices: [
      {
        value: "axial",
        label: "Close & centered",
        coach: "Axial",
        about: "You like keeping your arms and body close and moving forward and back. You see the ball best when it comes right at you.",
      },
      {
        value: "large",
        label: "Wide & roomy",
        coach: "Large",
        about: "You like room on your sides and moving side to side. You see the ball best when it comes from the side.",
      },
    ],
  },
  {
    key: "focus_line",
    title: "Your focus line",
    coach: "Vertical vs. Horizontal",
    intro: "When you need to calm down and lock in, look at this kind of line.",
    choices: [
      { value: "vertical", label: "Up and down", coach: "Vertical", about: "Look at something tall and straight, like a foul pole." },
      { value: "horizontal", label: "Side to side", coach: "Horizontal", about: "Look at something flat and wide, like the top of the outfield fence." },
    ],
  },
  {
    key: "motor_shoulder",
    title: "Your turning shoulder",
    coach: "Motor shoulder",
    intro: "The shoulder that leads when you turn fast.",
    choices: [
      { value: "left", label: "Left shoulder", coach: "MS left", about: "Your left shoulder leads your fast turns." },
      { value: "right", label: "Right shoulder", coach: "MS right", about: "Your right shoulder leads your fast turns." },
    ],
  },
  {
    key: "motor_eye",
    title: "Your quick eye",
    coach: "Motor eye",
    intro: "The eye that spots fast things coming at you first.",
    choices: [
      { value: "left", label: "Left eye", coach: "ME left", about: "Your left eye spots the ball first. At the plate, give it a clear look at the pitcher." },
      { value: "right", label: "Right eye", coach: "ME right", about: "Your right eye spots the ball first. At the plate, give it a clear look at the pitcher." },
    ],
  },
];

/** At-bat focus tip from her power breath (the color helps her lock in). */
export const FOCUS_TIP: Record<string, { color: string; colorName: string; title: string; tip: string }> = {
  out: {
    color: "#C8102E",
    colorName: "Scarlet red",
    title: "Big picture first",
    tip: "Look out at the whole field first, then zoom in on the pitcher's release point.",
  },
  in: {
    color: "#1F4BD8",
    colorName: "Royal blue",
    title: "Zoom in first",
    tip: "Start on one small detail, like the logo on the pitcher's jersey, then widen your view.",
  },
};

// ---------------------------------------------------------------------------
// Preferred Hitting Style (her natural setup: no right or wrong)
// ---------------------------------------------------------------------------
export const HITTING: Category[] = [
  {
    key: "hands_height",
    title: "Hand height",
    coach: "Hand position one",
    intro: "",
    choices: [
      { value: "high", label: "Hands high", coach: "High", about: "" },
      { value: "low", label: "Hands low", coach: "Low", about: "" },
    ],
  },
  {
    key: "hands_depth",
    title: "Hands front or back",
    coach: "Hand position two",
    intro: "",
    choices: [
      { value: "forward", label: "Out in front", coach: "Forward", about: "" },
      { value: "back", label: "Back by your shoulder", coach: "Back", about: "" },
    ],
  },
  {
    key: "hands_reach",
    title: "Hands close or away",
    coach: "Hand position three",
    intro: "",
    choices: [
      { value: "proximal", label: "Close to your body", coach: "Proximal", about: "" },
      { value: "distal", label: "Away from your body", coach: "Distal", about: "" },
    ],
  },
  {
    key: "feet_width",
    title: "Feet width",
    coach: "Feet position one",
    intro: "",
    choices: [
      { value: "wide", label: "Wide", coach: "Wide", about: "" },
      { value: "narrow", label: "Narrow", coach: "Narrow", about: "" },
    ],
  },
  {
    key: "feet_angle",
    title: "Stance",
    coach: "Feet position two",
    intro: "",
    choices: [
      { value: "open", label: "Open: front foot pulled back from the plate", coach: "Open", about: "" },
      { value: "closed", label: "Closed: front foot closer to the plate", coach: "Closed", about: "" },
      { value: "neutral", label: "Even: both feet the same distance", coach: "Neutral", about: "" },
    ],
  },
  {
    key: "weight",
    title: "Where your weight is",
    coach: "Weight distribution",
    intro: "",
    choices: [
      { value: "forward", label: "More on your front leg", coach: "Forward", about: "" },
      { value: "centered", label: "In the middle", coach: "Centered", about: "" },
      { value: "back", label: "More on your back leg", coach: "Back", about: "" },
    ],
  },
  {
    key: "load_stride",
    title: "How you load",
    coach: "Load & stride type",
    intro: "",
    choices: [
      { value: "leg_lift", label: "Leg lift", coach: "Leg lift", about: "" },
      { value: "toe_tap", label: "Toe tap", coach: "Toe tap", about: "" },
      { value: "no_stride", label: "No stride", coach: "No stride", about: "" },
      { value: "open_to_close", label: "Step in (open to closed)", coach: "Open to close", about: "" },
    ],
  },
  {
    key: "weight_shift",
    title: "When you swing",
    coach: "Weight shift",
    intro: "",
    choices: [
      { value: "shift", label: "Move forward into the ball", coach: "Shift", about: "" },
      { value: "no_shift", label: "Stay in place and turn", coach: "No shift", about: "" },
    ],
  },
  {
    key: "foot_down",
    title: "How your front foot lands",
    coach: "Foot down method",
    intro: "",
    choices: [
      { value: "toe_to_heel", label: "Toes first", coach: "Toe to heel", about: "" },
      { value: "heel_to_toe", label: "Heel first", coach: "Heel to toe", about: "" },
      { value: "simultaneous", label: "Whole foot at once", coach: "Simultaneous", about: "" },
    ],
  },
];

export const MOVEMENT_KEYS = MOVEMENT.map((c) => c.key);
export const HITTING_KEYS = HITTING.map((c) => c.key);

export type Values = Record<string, string | null>;

export function choiceOf(categories: Category[], key: string, value: string | null | undefined): Choice | null {
  return categories.find((c) => c.key === key)?.choices.find((o) => o.value === value) ?? null;
}

/** Only known values for the given categories (anything else becomes null). */
export function cleanValues(categories: Category[], input: Record<string, unknown>): Values {
  return Object.fromEntries(
    categories.map((c) => {
      const v = input[c.key];
      return [c.key, typeof v === "string" && c.choices.some((o) => o.value === v) ? v : null];
    }),
  );
}

/** What changed between two versions, as "Title: Old → New" lines (labels for players). */
export function changes(categories: Category[], before: Values | null, after: Values) {
  return categories
    .filter((c) => (before?.[c.key] ?? null) !== (after[c.key] ?? null))
    .map((c) => {
      const from = choiceOf(categories, c.key, before?.[c.key])?.label ?? "—";
      const to = choiceOf(categories, c.key, after[c.key])?.label ?? "—";
      return `${c.title}: ${before ? `${from} → ` : ""}${to}`;
    });
}

// ---------------------------------------------------------------------------
// The move dial: four spots on the feet, 1 (strongest) to 4
// ---------------------------------------------------------------------------
export const SPOTS = ["left_front", "right_front", "left_heel", "right_heel"] as const;
export type Spot = (typeof SPOTS)[number];
export type DialRank = "1" | "2" | "3" | "4" | "2/3";

const side = (s: Spot) => (s.startsWith("left") ? "left" : "right");
const isFront = (s: Spot) => s.endsWith("front");
const spot = (sideName: string, front: boolean) => `${sideName}_${front ? "front" : "heel"}` as Spot;

/** Her #1 spot: set directly, or from how she moves (bouncy = toes, grounded = heel) and her balance leg. */
export function dialOne(v: Values): Spot | null {
  if (v.dial_one && (SPOTS as readonly string[]).includes(v.dial_one)) return v.dial_one as Spot;
  if (!v.power_side || !v.move_style) return null;
  return spot(v.power_side, v.move_style === "aerial");
}

/**
 * The full dial. #1 on toes: #4 is the heel right behind it. #1 on a heel: #4
 * is the toes on the other foot. #2 and #3 are the other two spots; which is
 * which comes from her space (close/wide) and power breath when both are known,
 * otherwise they show as "2/3".
 */
export function moveDial(v: Values): Record<Spot, DialRank> | null {
  const one = dialOne(v);
  if (!one) return null;
  const four = isFront(one) ? spot(side(one), false) : spot(side(one) === "left" ? "right" : "left", true);
  const rest = SPOTS.filter((s) => s !== one && s !== four);
  const dial = { [one]: "1", [four]: "4" } as Record<Spot, DialRank>;
  if ((v.space === "axial" || v.space === "large") && (v.breathing === "in" || v.breathing === "out")) {
    const twoOnHeel = (v.space === "axial" && v.breathing === "in") || (v.space === "large" && v.breathing === "out");
    for (const s of rest) dial[s] = isFront(s) === twoOnHeel ? "3" : "2";
  } else {
    for (const s of rest) dial[s] = "2/3";
  }
  return dial;
}
