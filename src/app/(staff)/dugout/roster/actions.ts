"use server";

// Coach sign-ups and the coaching staff (Roster tab). The database decides who
// may approve whom: admins any coach, head coaches assistant coaches.
import { refresh } from "next/cache";
import { adminCheck, getCurrentUser, headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text } from "@/lib/form";
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
