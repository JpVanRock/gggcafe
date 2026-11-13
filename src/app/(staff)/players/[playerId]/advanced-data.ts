// G3 Advanced: is it unlocked for this player, and her book (title and chapter work).
import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_BOOK_TITLE, type ChapterWork } from "@/lib/advanced-book";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AdvancedBook = {
  unlocked: boolean;
  source: "admin" | "coach" | "subscription" | null;
  title: string;
  work: ChapterWork[];
  /** positions a coach has confirmed (opens position chapters, e.g. Pitching) */
  confirmed: string[];
};

export async function loadAdvanced(supabase: Supabase, playerId: string): Promise<AdvancedBook> {
  const { data: access } = await supabase.from("player_advanced_access").select("source").eq("player_id", playerId).maybeSingle();
  if (!access) return { unlocked: false, source: null, title: DEFAULT_BOOK_TITLE, work: [], confirmed: [] };
  const [{ data: book }, { data: chapters }, { data: positions }] = await Promise.all([
    supabase.from("player_advanced_books").select("title").eq("player_id", playerId).maybeSingle(),
    supabase.from("player_advanced_chapters").select("chapter, owned, mine, notes, completed_at, course_step, course_done_at").eq("player_id", playerId),
    supabase.from("player_confirmed_positions").select("position").eq("player_id", playerId),
  ]);
  return {
    unlocked: true,
    source: access.source as AdvancedBook["source"],
    title: (book?.title as string | undefined) ?? DEFAULT_BOOK_TITLE,
    work: ((chapters ?? []) as { chapter: string; owned: string[]; mine: string[]; notes: string | null; completed_at: string | null; course_step: number | null; course_done_at: string | null }[]).map((c) => ({
      chapter: c.chapter,
      owned: c.owned ?? [],
      mine: c.mine ?? [],
      notes: c.notes,
      completedAt: c.completed_at,
      courseStep: c.course_step ?? 0,
      courseDoneAt: c.course_done_at,
    })),
    confirmed: ((positions ?? []) as { position: string }[]).map((p) => p.position),
  };
}
