"use server";

import { refresh } from "next/cache";
import { headCoachCheck, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState, invalid } from "@/lib/form";
import { PACKET_KINDS, PACKET_STARTERS } from "@/lib/family";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";

/** Approves a request (matched to one of the team's players) or declines it. */
export async function decideParentLink(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "link_id");
    const playerId = text(fd, "player_id");
    if (!isUuid(id)) return failed(STALE);
    const approve = fd.get("decision") === "approve";
    if (approve && !isUuid(playerId)) return failed(STALE);
    const user = await getCurrentUser();
    const supabase = await createClient();
    must(await supabase
      .from("parent_links")
      .update({
        status: approve ? "approved" : "declined",
        player_id: approve ? playerId : null,
        decided_by: user?.id ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id));
    refresh();
  });
}

export async function removeParentLink(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "link_id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("parent_links").delete().eq("id", id));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// The parent welcome packet (Phase 6): head coaches write it; parents read it on /family.
// ---------------------------------------------------------------------------

export async function savePacketItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  const kind = PACKET_KINDS.find((k) => k === fd.get("kind")) ?? "tip";
  const title = text(fd, "title");
  const body = text(fd, "body");
  if (!isUuid(teamId) || (id && !isUuid(id))) return { error: "Unknown team." };
  if (!title || title.length > 100) return invalid("title", "Give it a title (100 characters at most).");
  if (!body || body.length > 3000) return invalid("body", "Write the text (3000 characters at most).");
  const supabase = await createClient();
  const row = { team_id: teamId, kind, title, body, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from("parent_packet_items").update(row).eq("id", id)
    : await supabase.from("parent_packet_items").insert({ ...row, position: PACKET_KINDS.indexOf(kind) * 1000 + (Date.now() % 1000) });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function deletePacketItem(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("parent_packet_items").delete().eq("id", id));
    refresh();
  });
}

/** Adds the starter "how to help her" tips the team doesn't have yet. */
export async function addStarterTips(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    if (!isUuid(teamId)) return failed(STALE);
    const supabase = await createClient();
    const { data } = await supabase.from("parent_packet_items").select("title").eq("team_id", teamId);
    const have = new Set(((data ?? []) as { title: string }[]).map((r) => r.title));
    const rows = PACKET_STARTERS.filter((t) => !have.has(t.title)).map((t, i) => ({ team_id: teamId, kind: "tip", title: t.title, body: t.body, position: 2000 + i }));
    if (rows.length) await supabase.from("parent_packet_items").insert(rows);
    refresh();
  });
}
