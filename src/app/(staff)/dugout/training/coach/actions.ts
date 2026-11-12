"use server";

// Coach training, The Mental Game (user, 2026-11-12): a coach's notes on a module.
// Saving marks the module done (and keeps the first date). Every staff member keeps
// their own; RLS checks it again (coach_mental_lessons).
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { invalid, text, type FormState } from "@/lib/form";
import { COACH_NOTES_MAX, moduleBySlug } from "@/lib/coach-training";
import { STALE, failed, must, runAction } from "@/lib/actions";

export async function saveCoachModule(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) return failed("Your session has ended. Sign in again.");
    if (!user.staff) return failed("Coach training is for coaches and staff.");
    const mod = moduleBySlug(text(fd, "lesson") ?? "");
    if (!mod) return failed(STALE);
    const notes = text(fd, "notes");
    if (notes && notes.length > COACH_NOTES_MAX) return invalid("notes", `Keep your notes under ${COACH_NOTES_MAX} characters.`);
    const supabase = await createClient();
    const { data: before } = must(
      await supabase.from("coach_mental_lessons").select("completed_at").eq("user_id", user.id).eq("lesson", mod.slug).maybeSingle(),
    );
    const now = new Date().toISOString();
    must(
      await supabase
        .from("coach_mental_lessons")
        .upsert(
          { user_id: user.id, lesson: mod.slug, notes, completed_at: before?.completed_at ?? now, updated_at: now },
          { onConflict: "user_id,lesson" },
        ),
    );
    refresh();
  });
}
