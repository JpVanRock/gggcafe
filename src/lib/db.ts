import "server-only";
// Small query helpers shared by server actions.
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Tables = Database["public"]["Tables"];
/** Tables that keep their rows in order with a numeric `position` column. */
type Ordered = { [K in keyof Tables]: Tables[K]["Row"] extends { position: number } ? K : never }[keyof Tables];

/** The position after the last row where `column = value` (0 for the first row): new rows go to the end of a list. */
export async function nextPosition<T extends Ordered>(supabase: Supabase, table: T, column: keyof Tables[T]["Row"] & string, value: string): Promise<number> {
  // the generic table makes the builder's own types too wide to follow, so read the one column plainly
  const query = supabase.from(table as Ordered).select("position") as {
    eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: { position: number }[] | null }> } };
  };
  const { data } = await query.eq(column, value).order("position", { ascending: false }).limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}
