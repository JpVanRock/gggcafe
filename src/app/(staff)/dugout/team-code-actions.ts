"use server";

import { randomInt } from "node:crypto";
import { refresh } from "next/cache";
import { headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form";
import { text } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";

// No 0/O or 1/I, so codes are easy to read aloud and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/**
 * The parent code (team_parent_codes), the team's one join code: parents who join with it are approved
 * at once when their daughter's name matches the roster; assistant coaches and mentors wait for
 * approval. A fresh code, or off (no row). Head coaches only. (The team code is retired.)
 */
export async function setParentCode(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    if (!isUuid(teamId)) return failed(STALE);
    const supabase = await createClient();
    if (fd.get("mode") === "off") {
      must(await supabase.from("team_parent_codes").delete().eq("team_id", teamId));
    } else {
      for (let tries = 0; ; tries++) {
        const { error } = await supabase
          .from("team_parent_codes")
          .upsert({ team_id: teamId, code: newCode(), updated_at: new Date().toISOString() }, { onConflict: "team_id" });
        // 23505: another team (or a team code) already has that code, so draw again
        if (error?.code === "23505" && tries < 5) continue;
        must({ error });
        break;
      }
    }
    refresh();
  });
}
