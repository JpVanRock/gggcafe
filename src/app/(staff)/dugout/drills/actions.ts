"use server";

import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allOf, friendlyDbError, text, type FormState } from "@/lib/form";
import { DRILL_TAGS } from "@/lib/dugout";
import { isUuid } from "@/lib/softball";

const DUPLICATE = "A drill with that name is already in the library.";

/** Adds a drill to the library, or updates it when the form has an id. */
export async function saveDrill(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const id = text(fd, "id");
  const drill = {
    name: text(fd, "name"),
    description: text(fd, "description"),
    tags: allOf(fd, "tags", DRILL_TAGS),
    equipment: text(fd, "equipment"),
  };
  if (!drill.name) return { error: "Give the drill a name." };
  if (drill.name.length > 120) return { error: "Keep the name to 120 characters." };
  if ((drill.description ?? "").length > 2000) return { error: "Keep the description to 2,000 characters." };
  if ((drill.equipment ?? "").length > 500) return { error: "Keep the equipment list to 500 characters." };
  if (drill.tags.length === 0) return { error: "Pick at least one tag so coaches can find it." };

  const supabase = await createClient();
  if (id) {
    if (!isUuid(id)) return { error: "Unknown drill." };
    const { data, error } = await supabase.from("practice_drills").update(drill).eq("id", id).select("id");
    if (error) return { error: friendlyDbError(error, DUPLICATE) };
    if (!data?.length) return { error: "That drill no longer exists, or you can't edit it." };
  } else {
    const { error } = await supabase.from("practice_drills").insert(drill);
    if (error) return { error: friendlyDbError(error, DUPLICATE) };
  }

  refresh();
  return { error: null, saved: true };
}

export async function deleteDrill(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("practice_drills").delete().eq("id", id);
  refresh();
}
