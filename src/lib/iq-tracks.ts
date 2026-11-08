// Softball IQ tracks whose award is the MVP badge (no ring): Offense IQ (Phase 3)
// and Battery IQ (Phase 4). Shared by server and client code (a constant exported
// from a "use client" file can't be read on the server). No imports.
export type BadgeTrack = "offense" | "battery";
export const BADGE_TRACK_LABEL: Record<BadgeTrack, string> = { offense: "Offense IQ", battery: "Battery IQ" };
export const isBadgeTrack = (t: string): t is BadgeTrack => t === "offense" || t === "battery";
