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

/** Turns sign-up with the team code on with a fresh code, or off (code = null). Head coaches only. */
export async function setTeamCode(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    if (!isUuid(teamId)) return failed(STALE);
    const supabase = await createClient();
    if (fd.get("mode") === "off") {
      must(await supabase.from("teams").update({ team_code: null }).eq("id", teamId));
    } else {
      for (let tries = 0; ; tries++) {
        const { error } = await supabase.from("teams").update({ team_code: newCode() }).eq("id", teamId);
        // 23505: another team already has that code, so draw again
        if (error?.code === "23505" && tries < 5) continue;
        must({ error });
        break;
      }
    }
    refresh();
  });
}
