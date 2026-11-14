// Family & roster (SB Blueprint Phase 6, user 2026-11-08): the preseason
// questionnaire, the medical & emergency card, and the parent welcome packet's
// starter tips (original wording). No imports, so it runs in unit tests and client code.

export const SIZES = ["YS", "YM", "YL", "YXL", "AS", "AM", "AL", "AXL", "A2XL", "A3XL"] as const;
export type Size = (typeof SIZES)[number];
export const SIZE_LABEL: Record<Size, string> = {
  YS: "Youth S", YM: "Youth M", YL: "Youth L", YXL: "Youth XL", AS: "Adult S", AM: "Adult M", AL: "Adult L", AXL: "Adult XL", A2XL: "Adult 2XL", A3XL: "Adult 3XL",
};

export type Questionnaire = {
  top_size: Size | null;
  bottom_size: Size | null;
  sock_size: Size | null;
  numbers: string[];
  positions: string[];
  experience: string | null;
  goals: string | null;
  notes: string | null;
};

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "UT"];

/** A clean questionnaire from form values: valid sizes, up to three 0-99 numbers (no repeats), up to four positions. */
export function cleanQuestionnaire(input: Record<string, unknown>): Questionnaire | string {
  const size = (v: unknown) => (SIZES as readonly string[]).includes(String(v ?? "")) ? (String(v) as Size) : null;
  const str = (v: unknown, max: number) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s.slice(0, max) : null;
  };
  const numbers = [...new Set((Array.isArray(input.numbers) ? input.numbers : []).map((n) => String(n).trim()).filter(Boolean))];
  if (numbers.some((n) => !/^\d{1,2}$/.test(n))) return "Jersey numbers are 0 to 99 (00 works too).";
  const positions = [...new Set((Array.isArray(input.positions) ? input.positions : []).map(String))].filter((p) => POSITIONS.includes(p));
  return {
    top_size: size(input.top_size),
    bottom_size: size(input.bottom_size),
    sock_size: size(input.sock_size),
    numbers: numbers.slice(0, 3),
    positions: positions.slice(0, 4),
    experience: str(input.experience, 300),
    goals: str(input.goals, 500),
    notes: str(input.notes, 300),
  };
}
export const QUESTIONNAIRE_POSITIONS = POSITIONS;

export const MEDICAL_FIELDS: { key: string; label: string; max: number; long?: boolean; hint?: string }[] = [
  { key: "contact1_name", label: "Emergency contact 1", max: 80 },
  { key: "contact1_relation", label: "Relationship", max: 40 },
  { key: "contact1_phone", label: "Phone", max: 30 },
  { key: "contact2_name", label: "Emergency contact 2", max: 80 },
  { key: "contact2_relation", label: "Relationship", max: 40 },
  { key: "contact2_phone", label: "Phone", max: 30 },
  { key: "allergies", label: "Allergies", max: 500, long: true, hint: "Food, medicine, bee stings… and what to do" },
  { key: "conditions", label: "Medical conditions", max: 500, long: true, hint: "Asthma, diabetes, past concussions…" },
  { key: "medications", label: "Medications", max: 500, long: true, hint: "Including an inhaler or EpiPen she carries" },
  { key: "physician", label: "Doctor", max: 120, hint: "Name and phone" },
  { key: "insurance", label: "Insurance", max: 120, hint: "Company and policy number" },
  { key: "notes", label: "Anything else the coach should know", max: 500, long: true },
];

/** A clean medical card from form values (trimmed, capped, blanks dropped), or an error. */
export function cleanMedical(input: Record<string, unknown>): Record<string, string | null> | string {
  const out: Record<string, string | null> = {};
  for (const f of MEDICAL_FIELDS) {
    const v = typeof input[f.key] === "string" ? (input[f.key] as string).trim() : "";
    if (v.length > f.max) return `${f.label}: ${f.max} characters at most.`;
    out[f.key] = v || null;
  }
  if (!out.contact1_name || !out.contact1_phone) return "Add at least one emergency contact with a phone number.";
  return out;
}

/** On file: at least one emergency contact with a phone. */
export function medicalOnFile(card: Record<string, unknown> | null): boolean {
  return Boolean(card?.contact1_name && card?.contact1_phone);
}

export const PACKET_KINDS = ["letter", "policy", "tip"] as const;
export type PacketKind = (typeof PACKET_KINDS)[number];
export const PACKET_KIND_LABEL: Record<PacketKind, string> = { letter: "From the coach", policy: "Team policy", tip: "How to help her" };

/** Starter "how to help her this season" tips a coach can add to the packet. */
export const PACKET_STARTERS: { title: string; body: string }[] = [
  { title: "Be her biggest fan, not her coach", body: "From the stands, cheer for effort and for the team. Leave the instruction to her coaches, so she hears one voice during the game." },
  { title: "The car ride home", body: "Give her time before talking about the game. Let her bring it up. Asking what she enjoyed most is a better start than going over what went wrong." },
  { title: "Praise what she controls", body: "Effort, attitude, hustle, being a good teammate. Results come and go; the habits you notice are the ones she keeps." },
  { title: "Wait a day", body: "If something about playing time or a decision bothers you, wait 24 hours, then ask the coach for a time to talk. Never at the field, and never about other players." },
  { title: "Fuel and sleep", body: "Tournament weekends are long. Water, real meals, snacks between games and a full night's sleep before game days matter as much as practice." },
  { title: "Let her own it", body: "Let her carry her bag, check her gear and talk to her coach herself. Players who handle their own business grow faster on and off the field." },
];

// ---------------------------------------------------------------------------
// Coming up on the family page (user, 2026-11-13): the team's next events and games
// ---------------------------------------------------------------------------

/** One line of "Coming up": a team event (practice, workout…) or a game. `start` is "HH:MM" or null. */
export type ComingUpItem = { key: string; teamId: string; date: string; start: string | null; title: string; place: string | null; game: boolean };

/** Events and games together, by day then start time (no time last that day), each once, the first `limit`. */
export function comingUp(items: ComingUpItem[], limit: number): ComingUpItem[] {
  const seen = new Set<string>();
  return items
    .filter((i) => !seen.has(i.key) && Boolean(seen.add(i.key)))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "99").localeCompare(b.start ?? "99") || Number(b.game) - Number(a.game))
    .slice(0, limit);
}

/** Groups the lines by day, in order. */
export function byDay(items: ComingUpItem[]): { date: string; items: ComingUpItem[] }[] {
  const days: { date: string; items: ComingUpItem[] }[] = [];
  for (const item of items) {
    const last = days[days.length - 1];
    if (last?.date === item.date) last.items.push(item);
    else days.push({ date: item.date, items: [item] });
  }
  return days;
}
