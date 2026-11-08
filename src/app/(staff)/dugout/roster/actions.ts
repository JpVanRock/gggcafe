"use server";

// Coach sign-ups and the coaching staff (Roster tab). The database decides who
// may approve whom: admins any coach, head coaches assistant coaches.
import { refresh } from "next/cache";
import { adminCheck, getCurrentUser, headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState } from "@/lib/form";
import { cleanMedical } from "@/lib/family";
import { isUuid } from "@/lib/softball";

export async function decideStaffRequest(fd: FormData) {
  if (await headCoachCheck()) return;
  const id = text(fd, "user_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.rpc("decide_staff_request", { p_user_id: id, p_approve: fd.get("decision") === "approve" });
  refresh();
}

const ROLES = ["viewer", "assistant", "coach"] as const;

/** Admins: make someone a head coach, an assistant coach or a viewer (never another admin, never yourself). */
export async function setStaffRole(fd: FormData) {
  if (await adminCheck()) return;
  const id = text(fd, "user_id");
  const role = ROLES.find((r) => r === fd.get("role"));
  const me = await getCurrentUser();
  if (!isUuid(id) || !role || id === me?.id) return;
  const supabase = await createClient();
  await supabase.from("staff").update({ role }).eq("user_id", id).neq("role", "admin");
  refresh();
}

/** Admins: take someone off the staff (the account stays; it just loses staff access). */
export async function removeStaff(fd: FormData) {
  if (await adminCheck()) return;
  const id = text(fd, "user_id");
  const me = await getCurrentUser();
  if (!isUuid(id) || id === me?.id) return;
  const supabase = await createClient();
  await supabase.from("staff").delete().eq("user_id", id).neq("role", "admin");
  refresh();
}

// ---------------------------------------------------------------------------
// The medical & emergency card (Phase 6): head coaches and admins only.
// ---------------------------------------------------------------------------

export async function saveMedicalCard(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const card = cleanMedical(Object.fromEntries(fd.entries()));
  if (typeof card === "string") return { error: card };
  const supabase = await createClient();
  const { error } = await supabase.from("medical_cards").upsert({ player_id: playerId, ...card, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}
