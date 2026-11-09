"use server";

import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nextPosition } from "@/lib/db";
import { friendlyDbError, oneOf, text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { INSTALL_CATEGORIES, INSTALL_STATUSES, STARTER_ITEMS } from "@/lib/install";
import { STALE, failed, must, runAction } from "@/lib/actions";

/** Load the starter checklist; items the team already has (same group and title) are skipped. */
export async function loadStarterInstall(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const teamId = text(fd, "team_id");
    const denied = await editorCheck();
    if (denied) return failed(denied);
    if (!isUuid(teamId)) return failed(STALE);
    const supabase = await createClient();
    const { data } = await supabase.from("install_items").select("group_name, title, position").eq("team_id", teamId);
    const have = new Set(((data ?? []) as { group_name: string; title: string }[]).map((i) => `${i.group_name}|${i.title}`));
    let position = Math.max(-1, ...((data ?? []) as { position: number }[]).map((i) => i.position)) + 1;
    const rows = STARTER_ITEMS.filter((i) => !have.has(`${i.group}|${i.title}`)).map((i) => ({
      team_id: teamId,
      category: i.category,
      group_name: i.group,
      title: i.title,
      iq_track: i.iq ?? null,
      position: position++,
    }));
    if (rows.length) await supabase.from("install_items").insert(rows);
    refresh();
  });
}

export async function addInstallItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const category = oneOf(fd, "category", INSTALL_CATEGORIES);
  const group = text(fd, "group");
  const title = text(fd, "title");
  if (!isUuid(teamId) || !category) return { error: "Choose position or situation." };
  if (!group || group.length > 40) return invalid("group", "Name the group (a position or a situation), up to 40 characters.");
  if (!title || title.length > 140) return invalid("title", "Write what to install, up to 140 characters.");

  const supabase = await createClient();
  const position = await nextPosition(supabase, "install_items", "team_id", teamId);
  const { error } = await supabase.from("install_items").insert({ team_id: teamId, category, group_name: group, title, position });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function setInstallStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "id");
    const status = oneOf(fd, "status", INSTALL_STATUSES);
    const denied = await editorCheck();
    if (denied) return failed(denied);
    if (!isUuid(id) || !status) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("install_items").update({ status, updated_at: new Date().toISOString() }).eq("id", id));
    refresh();
  });
}

export async function removeInstallItem(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "id");
    const denied = await editorCheck();
    if (denied) return failed(denied);
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("install_items").delete().eq("id", id));
    refresh();
  });
}
