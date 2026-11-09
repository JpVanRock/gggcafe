"use server";

// G3 Advanced: admins grant access; the player (or a coach) keeps her book. The
// database enforces both (admin-only access rows; her book only while she has access).
import { refresh } from "next/cache";
import { actForCheck, adminCheck, editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/form";
import { FIELD_POSITIONS, isUuid, type FieldPosition } from "@/lib/softball";
import { CHAPTERS, NOTES_MAX, cleanBookTitle, cleanMyHabits } from "@/lib/advanced-book";

type Result = { error: string | null };

/** Admins turn G3 Advanced on or off for a player. Her book is kept when it's turned off. */
export async function setAdvancedAccess(input: { playerId: string; on: boolean }): Promise<Result> {
  const denied = await adminCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  const supabase = await createClient();
  const { error } = input.on
    ? await supabase.from("player_advanced_access").upsert({ player_id: input.playerId, source: "admin" }, { onConflict: "player_id" })
    : await supabase.from("player_advanced_access").delete().eq("player_id", input.playerId);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Coaches confirm (or remove) a player's position, which opens that position's chapter. */
export async function setConfirmedPosition(input: { playerId: string; position: string; on: boolean }): Promise<Result> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !(FIELD_POSITIONS as readonly string[]).includes(input.position)) return { error: "Unknown position." };
  const position = input.position as FieldPosition;
  const supabase = await createClient();
  const { error } = input.on
    ? await supabase.from("player_confirmed_positions").upsert({ player_id: input.playerId, position }, { onConflict: "player_id,position" })
    : await supabase.from("player_confirmed_positions").delete().eq("player_id", input.playerId).eq("position", position);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

export async function renameAdvancedBook(input: { playerId: string; title: string }): Promise<Result> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const title = cleanBookTitle(input.title ?? "");
  if (!isUuid(input.playerId) || !title) return { error: "Give your book a title." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("player_advanced_books")
    .upsert({ player_id: input.playerId, title, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Her saved work on one chapter, or nothing yet. */
async function currentWork(supabase: Awaited<ReturnType<typeof createClient>>, playerId: string, chapter: string) {
  const { data } = await supabase
    .from("player_advanced_chapters")
    .select("owned, mine, notes, completed_at, course_step, course_done_at")
    .eq("player_id", playerId)
    .eq("chapter", chapter)
    .maybeSingle();
  return data as {
    owned: string[];
    mine: string[];
    notes: string | null;
    completed_at: string | null;
    course_step: number;
    course_done_at: string | null;
  } | null;
}

async function saveWork(
  playerId: string,
  chapterSlug: string,
  patch: (current: Awaited<ReturnType<typeof currentWork>>) => Record<string, unknown> | string,
  refreshPage = false,
): Promise<Result> {
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  const chapter = CHAPTERS.find((c) => c.slug === chapterSlug);
  if (!isUuid(playerId) || !chapter) return { error: "Unknown chapter." };
  const supabase = await createClient();
  if (chapter.requires) {
    const { data: confirmed } = await supabase
      .from("player_confirmed_positions")
      .select("position")
      .eq("player_id", playerId)
      .eq("position", chapter.requires.position)
      .maybeSingle();
    if (!confirmed) return { error: "Unknown chapter." };
  }
  const changes = patch(await currentWork(supabase, playerId, chapterSlug));
  if (typeof changes === "string") return { error: changes };
  const { error } = await supabase
    .from("player_advanced_chapters")
    .upsert({ player_id: playerId, chapter: chapterSlug, ...changes, updated_at: new Date().toISOString() }, { onConflict: "player_id,chapter" });
  if (error) return { error: friendlyDbError(error) };
  if (refreshPage) refresh();
  return { error: null };
}

/** "I own this": one foundation habit, on or off. */
export async function setAdvancedHabit(input: { playerId: string; chapter: string; habit: string; owned: boolean }): Promise<Result> {
  const chapter = CHAPTERS.find((c) => c.slug === input.chapter);
  if (!chapter?.habits?.some((h) => h.key === input.habit)) return { error: "Unknown habit." };
  return saveWork(input.playerId, input.chapter, (current) => {
    const owned = new Set(current?.owned ?? []);
    if (input.owned) owned.add(input.habit);
    else owned.delete(input.habit);
    return { owned: [...owned] };
  });
}

/** The habits she adds on top of the foundation. */
export async function saveAdvancedMine(input: { playerId: string; chapter: string; mine: string[] }): Promise<Result & { mine?: string[] }> {
  const mine = cleanMyHabits(Array.isArray(input.mine) ? input.mine.map(String) : []);
  const res = await saveWork(input.playerId, input.chapter, () => ({ mine }));
  return res.error ? res : { error: null, mine };
}

export async function saveAdvancedNotes(input: { playerId: string; chapter: string; notes: string }): Promise<Result> {
  const notes = (input.notes ?? "").trim();
  if (notes.length > NOTES_MAX) return { error: `Keep notes under ${NOTES_MAX} characters.` };
  return saveWork(input.playerId, input.chapter, () => ({ notes: notes || null }));
}

/** Chapter finished (or reopened). A chapter with a course needs the course finished first. */
export async function setAdvancedChapterDone(input: { playerId: string; chapter: string; done: boolean }): Promise<Result> {
  const chapter = CHAPTERS.find((c) => c.slug === input.chapter);
  return saveWork(
    input.playerId,
    input.chapter,
    (current) =>
      input.done && chapter?.course && !current?.course_done_at
        ? "Finish the course first."
        : { completed_at: input.done ? new Date().toISOString() : null },
    true,
  );
}

/** The course: her furthest step (it only moves forward). */
export async function saveCourseStep(input: { playerId: string; chapter: string; step: number }): Promise<Result> {
  const chapter = CHAPTERS.find((c) => c.slug === input.chapter);
  if (!chapter?.course) return { error: "Unknown chapter." };
  const step = Math.max(0, Math.min(Math.trunc(Number(input.step) || 0), chapter.course.length - 1));
  return saveWork(input.playerId, input.chapter, (current) => ({ course_step: Math.max(current?.course_step ?? 0, step) }));
}

/** The course: finished. */
export async function finishCourse(input: { playerId: string; chapter: string }): Promise<Result> {
  const chapter = CHAPTERS.find((c) => c.slug === input.chapter);
  if (!chapter?.course) return { error: "Unknown chapter." };
  return saveWork(
    input.playerId,
    input.chapter,
    (current) => ({ course_step: chapter.course!.length - 1, course_done_at: current?.course_done_at ?? new Date().toISOString() }),
    true,
  );
}
