// Shared by server and client code on the player dashboard (no server-only imports here).

export const MENTAL_FIELDS = [
  { name: "focus_words", label: "Focus words", hint: "Two or three cue words to come back to" },
  { name: "pre_game_routine", label: "Pre-game routine", hint: "Before the first pitch" },
  { name: "pre_pitch_routine", label: "Pre-pitch routine", hint: "Between pitches and before each at-bat" },
  { name: "reset_routine", label: "Reset routine", hint: "After a mistake or a bad at-bat" },
  { name: "confidence_statements", label: "Confidence statements", hint: "What the player believes about their game" },
  { name: "pressure_plan", label: "Big-moment plan", hint: "Bases loaded, last inning, two strikes" },
  { name: "notes", label: "Notes", hint: "Anything else" },
] as const;

export type MentalField = (typeof MENTAL_FIELDS)[number]["name"];
export type MentalPlan = Record<MentalField, string | null> & { updated_at: string };
