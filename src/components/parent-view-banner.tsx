// Shown on a player's pages when her approved parent is viewing as her (user, 2026-11-12): what she
// sees, read only. Nothing for anyone else.
import Link from "next/link";
import { getCurrentUser, getMyChildIds, getMyPlayerIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function ParentViewBanner({ playerId }: { playerId: string }) {
  const user = await getCurrentUser();
  if (!user || user.staff) return null;
  if ((await getMyPlayerIds()).includes(playerId)) return null;
  if (!(await getMyChildIds()).includes(playerId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("players").select("first_name, preferred_name").eq("id", playerId).maybeSingle();
  const first = data ? data.preferred_name || data.first_name : "your daughter";
  return (
    <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-pink bg-pink/5 px-4 py-3 text-sm">
      <span>
        <strong className="text-highlight">Viewing as {first}.</strong> This is what she sees. Read only: nothing can be changed from here.
      </span>
      <Link href="/family" className="font-semibold text-link hover:underline">
        ← Family home
      </Link>
    </div>
  );
}
