"use server";

import { randomInt } from "node:crypto";
import { refresh } from "next/cache";
import { editorCheck, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text } from "@/lib/form";
import { isUuid } from "@/lib/softball";

// No 0/O or 1/I, so codes are easy to read aloud and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** Turns parent sign-up on with a fresh code, or off (code = null). */
export async function setParentCode(fd: FormData) {
  if (await editorCheck()) return;
  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return;
  const supabase = await createClient();
  if (fd.get("mode") === "off") {
    await supabase.from("teams").update({ parent_code: null }).eq("id", teamId);
  } else {
    for (let tries = 0; tries < 5; tries++) {
      const { error } = await supabase.from("teams").update({ parent_code: newCode() }).eq("id", teamId);
      if (!error || error.code !== "23505") break; // 23505: code already used by another team, try again
    }
  }
  refresh();
}

/** Approves a request (matched to one of the team's players) or declines it. */
export async function decideParentLink(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "link_id");
  const playerId = text(fd, "player_id");
  if (!isUuid(id)) return;
  const approve = fd.get("decision") === "approve";
  if (approve && !isUuid(playerId)) return;
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase
    .from("parent_links")
    .update({
      status: approve ? "approved" : "declined",
      player_id: approve ? playerId : null,
      decided_by: user?.id ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  refresh();
}

export async function removeParentLink(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "link_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("parent_links").delete().eq("id", id);
  refresh();
}
