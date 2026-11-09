// Softball reference values shared by forms and tables. Must match the enums in
// supabase/migrations/20261106000001_foundation.sql.

export const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DP", "FLEX", "EH"] as const;
export type Position = (typeof POSITIONS)[number];
/** The nine positions on the field (no DP/FLEX/EH): position IQ tests and Golden Gloves. */
export const FIELD_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const satisfies readonly Position[];
export type FieldPosition = (typeof FIELD_POSITIONS)[number];
export const POSITION_LABEL: Record<Position, string> = {
  P: "Pitcher",
  C: "Catcher",
  "1B": "First base",
  "2B": "Second base",
  "3B": "Third base",
  SS: "Shortstop",
  LF: "Left field",
  CF: "Center field",
  RF: "Right field",
  DP: "Designated player",
  FLEX: "Flex",
  EH: "Extra hitter",
};

export const BATS = ["R", "L", "S"] as const;
export type Bats = (typeof BATS)[number];
export const BATS_LABEL: Record<Bats, string> = { R: "Right", L: "Left", S: "Switch" };

export const THROWS = ["R", "L"] as const;
export type Throws = (typeof THROWS)[number];
export const THROWS_LABEL: Record<Throws, string> = { R: "Right", L: "Left" };

export const FORMATS = ["fastpitch", "slowpitch"] as const;
export type GameFormat = (typeof FORMATS)[number];
export const FORMAT_LABEL: Record<GameFormat, string> = { fastpitch: "Fastpitch", slowpitch: "Slowpitch" };

export type Team = {
  id: string;
  name: string;
  short_name: string | null;
  organization: string | null;
  age_group: string | null;
  format: GameFormat;
  is_own_team: boolean;
  home_field: string | null;
  notes: string | null;
  /** path in the private team-logos bucket (signedLogoUrl) */
  logo_path: string | null;
  /** shown to players when they claim their profile on this team */
  welcome_message: string | null;
};

export type Season = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

export const GOAL_METHODS = ["harada", "smart"] as const;
export type GoalMethod = (typeof GOAL_METHODS)[number];
export const GOAL_METHOD_LABEL: Record<GoalMethod, string> = { harada: "Harada Method", smart: "SMART Method" };

export const SKILL_AREAS = [
  "hitting", "short_game", "pitching", "catching", "infield", "outfield",
  "baserunning", "mental", "strength_conditioning", "other",
] as const;
export type SkillArea = (typeof SKILL_AREAS)[number];
export const SKILL_AREA_LABEL: Record<SkillArea, string> = {
  hitting: "Hitting",
  short_game: "Short game",
  pitching: "Pitching",
  catching: "Catching",
  infield: "Infield",
  outfield: "Outfield",
  baserunning: "Baserunning",
  mental: "Mental",
  strength_conditioning: "Strength & conditioning",
  other: "General",
};

export type Player = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  bats: Bats | null;
  throws: Throws | null;
  grad_year: number | null;
  primary_position: Position | null;
  secondary_positions: Position[];
  is_slapper: boolean;
  notes: string | null;
  goal_method: GoalMethod;
  birth_date: string | null;
  /** path in the private player-photos bucket; shown through a signed URL */
  photo_path: string | null;
  walk_up_songs: WalkUpSong[];
};

export type WalkUpSong = { title: string; artist: string | null; link: string | null };
export const MAX_WALK_UP_SONGS = 3;

/** Age groups for the Players page tabs, taken from the team she plays for. */
export const AGE_GROUPS = ["8U", "10U", "11U", "12U", "13U", "14U", "15U", "16U", "17U", "18U"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** A team's age group as one of AGE_GROUPS ("16u", "16 U", "GGG 16U" → "16U"), or null. */
export function ageGroupOf(teamAgeGroup: string | null | undefined): AgeGroup | null {
  const match = /(\d{1,2})\s*u\b/i.exec(teamAgeGroup ?? "");
  const group = match ? `${Number(match[1])}U` : null;
  return (AGE_GROUPS as readonly string[]).includes(group ?? "") ? (group as AgeGroup) : null;
}

export function playerName(p: Pick<Player, "first_name" | "last_name" | "preferred_name">) {
  return `${p.preferred_name || p.first_name} ${p.last_name}`;
}

/** "R/R", "L/R", "S/R", or "–" */
export function batsThrows(p: Pick<Player, "bats" | "throws">) {
  if (!p.bats && !p.throws) return "–";
  return `${p.bats ?? "?"}/${p.throws ?? "?"}`;
}

/** Sort jersey numbers numerically, with "0" before "00" and blanks last. */
export function compareJersey(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null || a === "") return 1;
  if (b === null || b === "") return -1;
  const diff = Number(a) - Number(b);
  return diff !== 0 ? diff : a.length - b.length;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
