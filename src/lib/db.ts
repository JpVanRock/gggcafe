import "server-only";
// Small query helpers shared by server actions.
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The position after the last row where `column = value` (0 for the first row): new rows go to the end of a list. */
export async function nextPosition(supabase: Supabase, table: string, column: string, value: string): Promise<number> {
  const { data } = await supabase.from(table).select("position").eq(column, value).order("position", { ascending: false }).limit(1);
  return (((data ?? [])[0] as { position: number } | undefined)?.position ?? -1) + 1;
}
