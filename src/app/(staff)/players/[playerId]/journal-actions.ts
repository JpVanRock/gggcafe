"use server";

// My Journal (user, 2026-11-12): only the player herself writes her journal; the database
// checks it again (player_journal_entries RLS, the journal-audio bucket's policies).
import { refresh } from "next/cache";
import { getCurrentUser, getMyPlayerIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { JOURNAL_BUCKET, cleanJournalEntry, isMemoPathFor, type JournalInput } from "@/lib/journal";

type Result = { error: string | null; field?: string };

async function ownJournal(playerId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has ended. Sign in again.";
  if (!isUuid(playerId) || !(await getMyPlayerIds()).includes(playerId)) return "Only you can write in your journal.";
  return null;
}

/** Saves a new entry, or changes one (`id`). A memo it replaces is removed from storage. */
export async function saveJournalEntry(input: JournalInput & { playerId: string; id?: string | null }): Promise<Result> {
  const denied = await ownJournal(input.playerId);
  if (denied) return { error: denied };
  if (input.id && !isUuid(input.id)) return { error: STALE };
  const supabase = await createClient();
  const { data: mentors } = await supabase.rpc("player_mentors", { p_player_id: input.playerId });
  const cleaned = cleanJournalEntry(input, input.playerId, (mentors ?? []).map((m) => m.mentor_id), todayISO());
  if ("error" in cleaned) return { error: cleaned.error, field: cleaned.field };

  if (input.id) {
    const { data: before } = await supabase.from("player_journal_entries").select("audio_path").eq("id", input.id).eq("player_id", input.playerId).maybeSingle();
    if (!before) return { error: STALE };
    const { error } = await supabase.from("player_journal_entries").update(cleaned.row).eq("id", input.id);
    if (error) return { error: "Couldn't save your entry. Try again." };
    if (before.audio_path && before.audio_path !== cleaned.row.audio_path) await supabase.storage.from(JOURNAL_BUCKET).remove([before.audio_path]);
  } else {
    const { error } = await supabase.from("player_journal_entries").insert({ ...cleaned.row, player_id: input.playerId });
    if (error) return { error: "Couldn't save your entry. Try again." };
  }
  refresh();
  return { error: null };
}

/** A memo she recorded but didn't keep (recorded again, or removed before saving). */
export async function discardJournalMemo(playerId: string, path: string): Promise<Result> {
  const denied = await ownJournal(playerId);
  if (denied) return { error: denied };
  if (!isMemoPathFor(path, playerId)) return { error: STALE };
  const supabase = await createClient();
  // never one a saved entry still uses
  const { count } = await supabase.from("player_journal_entries").select("id", { count: "exact", head: true }).eq("audio_path", path);
  if (!count) await supabase.storage.from(JOURNAL_BUCKET).remove([path]);
  return { error: null };
}

export async function deleteJournalEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const playerId = text(fd, "player_id") ?? "";
    const id = text(fd, "id");
    const denied = await ownJournal(playerId);
    if (denied) return failed(denied);
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    const { data } = must(await supabase.from("player_journal_entries").delete().eq("id", id).eq("player_id", playerId).select("audio_path"));
    const audio = data?.[0]?.audio_path;
    if (audio) await supabase.storage.from(JOURNAL_BUCKET).remove([audio]);
    refresh();
  });
}

/** Share an entry with the mentor it's about, or stop sharing it. */
export async function shareJournalEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const playerId = text(fd, "player_id") ?? "";
    const id = text(fd, "id");
    const denied = await ownJournal(playerId);
    if (denied) return failed(denied);
    if (!isUuid(id)) return failed(STALE);
    const share = fd.get("share") === "on";
    const supabase = await createClient();
    const { data } = must(await supabase.from("player_journal_entries").update({ shared_with_mentor: share }).eq("id", id).eq("player_id", playerId).select("id"));
    if (!data?.length) return failed(STALE);
    refresh();
  });
}
