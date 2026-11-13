"use server";

// Site health (user, 2026-11-13): an admin marks an error group resolved. It opens again if the
// error happens again. The database checks the admin again (resolve_error).
import { refresh } from "next/cache";
import { adminCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState } from "@/lib/form";
import { STALE, failed, must, runAction } from "@/lib/actions";

export async function resolveError(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await adminCheck();
    if (denied) return failed(denied);
    const fingerprint = text(fd, "fingerprint");
    if (!fingerprint || !/^[0-9a-f]{16}$/.test(fingerprint)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.rpc("resolve_error", { p_fingerprint: fingerprint }));
    refresh();
  });
}
