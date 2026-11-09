import "server-only";
// Shared by TWIS check-offs and Performance Training: award newly earned achievements.
import type { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { evaluateAchievements, type Check, type Routine } from "@/lib/achievements";

export /** Stores any achievements the player has newly earned. Earned ones are never removed. */
async function awardAchievements(supabase: Awaited<ReturnType<typeof createClient>>, playerId: string) {
  const [{ data: player }, { data: routines }] = await Promise.all([
    supabase.from("players").select("primary_position, secondary_positions").eq("id", playerId).maybeSingle(),
    supabase.from("player_activities").select("id, category, days, starts_on, ends_on").eq("player_id", playerId).not("category", "is", null),
  ]);
  if (!player || !routines?.length) return;
  const { data: checks } = await supabase
    .from("twis_checks")
    .select("activity_id, on_date")
    .in("activity_id", routines.map((r) => r.id));
  const unlocked = evaluateAchievements({
    routines: routines as Routine[],
    checks: (checks ?? []) as Check[],
    today: todayISO(),
    positions: [player.primary_position, ...(player.secondary_positions ?? [])].filter((p) => p !== null),
  }).filter((p): p is typeof p & { unlockedOn: string } => Boolean(p.unlockedOn));
  if (unlocked.length === 0) return;
  await supabase.from("player_achievements").upsert(
    unlocked.map((p) => ({ player_id: playerId, achievement_key: p.def.key, unlocked_on: p.unlockedOn })),
    { onConflict: "player_id,achievement_key", ignoreDuplicates: true },
  );
}
