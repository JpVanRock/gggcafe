// Scripted bullpens (SB Blueprint Phase 4, user 2026-11-08): a coach's script is a
// list of pitches (type, target zone, intent, optional count); she throws it and taps
// hit or miss on each pitch. Command % = hits / pitches, by pitch type. Zones follow
// the site's pitch zones: 1-9 the strike zone from the catcher's view, 11-14 the
// outside quadrants (11 up-left, 12 up-right, 13 down-left, 14 down-right).
// Windmill pitches only. No imports, so it runs in unit tests and client code.

export const PITCH_TYPES = ["Fastball", "Rise", "Drop", "Curve", "Screw", "Change-up", "Drop-curve"] as const;
export type PitchType = (typeof PITCH_TYPES)[number];
export const INTENTS = ["strike", "chase", "up"] as const;
export type Intent = (typeof INTENTS)[number];
export const INTENT_LABEL: Record<Intent, string> = { strike: "Strike", chase: "Chase (just off)", up: "Up (above the zone)" };
export const ZONES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14] as const;
export const COUNTS = ["0-0", "0-1", "0-2", "1-0", "1-1", "1-2", "2-0", "2-1", "2-2", "3-0", "3-1", "3-2"] as const;
export const MAX_PITCHES = 80;

export type ScriptPitch = { pitch: PitchType; zone: number; intent: Intent; count?: string | null };
export type ResultPitch = ScriptPitch & { hit: boolean };

export function zoneLabel(zone: number): string {
  if (zone >= 11) return { 11: "Off the plate, up-left", 12: "Off the plate, up-right", 13: "Off the plate, down-left", 14: "Off the plate, down-right" }[zone as 11] ?? `Zone ${zone}`;
  const row = zone <= 3 ? "Up" : zone <= 6 ? "Middle" : "Down";
  const col = (zone - 1) % 3;
  return `${row}, ${col === 0 ? "left" : col === 1 ? "center" : "right"}`;
}

/** A clean script from untrusted input, or an error message. */
export function cleanScript(input: unknown): ScriptPitch[] | string {
  if (!Array.isArray(input) || input.length === 0) return "Add at least one pitch.";
  if (input.length > MAX_PITCHES) return `Keep a script to ${MAX_PITCHES} pitches.`;
  const out: ScriptPitch[] = [];
  for (const raw of input) {
    const p = raw as Record<string, unknown>;
    const pitch = PITCH_TYPES.find((t) => t === p?.pitch);
    const zone = Number(p?.zone);
    const intent = INTENTS.find((t) => t === p?.intent);
    const count = typeof p?.count === "string" && (COUNTS as readonly string[]).includes(p.count) ? p.count : null;
    if (!pitch || !intent || !(ZONES as readonly number[]).includes(zone)) return "Every pitch needs a type, a zone and an intent.";
    out.push({ pitch, zone, intent, count });
  }
  return out;
}

/** The last pitches at a full count, the way bullpens often end. */
export function fullCountFinish(pitches: PitchType[]): ScriptPitch[] {
  return pitches.map((pitch, i) => ({ pitch, zone: [7, 9, 5][i % 3], intent: "strike", count: "3-2" }));
}

export type Command = { pitch: PitchType; thrown: number; hits: number; pct: number };

/** Command by pitch type across sessions (only types she threw), most thrown first. */
export function commandByPitch(sessions: { results: ResultPitch[] }[]): Command[] {
  const by = new Map<PitchType, { thrown: number; hits: number }>();
  for (const s of sessions) for (const r of s.results) {
    const c = by.get(r.pitch) ?? { thrown: 0, hits: 0 };
    c.thrown += 1;
    if (r.hit) c.hits += 1;
    by.set(r.pitch, c);
  }
  return [...by]
    .map(([pitch, c]) => ({ pitch, ...c, pct: Math.round((c.hits / c.thrown) * 100) }))
    .sort((a, b) => b.thrown - a.thrown || PITCH_TYPES.indexOf(a.pitch) - PITCH_TYPES.indexOf(b.pitch));
}

export function sessionPct(results: ResultPitch[]): number {
  return results.length ? Math.round((results.filter((r) => r.hit).length / results.length) * 100) : 0;
}
