"use server";

import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";

export async function saveTeamDugout(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return { error: "Choose a team." };

  const details = fd.getAll("standard_detail");
  const standards = fd
    .getAll("standard_title")
    .map((t, i) => ({ title: String(t).trim(), detail: String(details[i] ?? "").trim() }))
    .filter((s) => s.title);
  if (standards.length > 25) return { error: "Keep it to 25 standards or fewer." };
  if (standards.some((s) => s.title.length > 140)) return { error: "Keep each standard to 140 characters; put the rest in its detail." };
  if (standards.some((s) => s.detail.length > 800)) return { error: "Keep each standard's detail to 800 characters." };

  const headline = text(fd, "headline");
  const statement = text(fd, "statement");
  if ((headline ?? "").length > 120) return { error: "Keep the headline to 120 characters." };
  if ((statement ?? "").length > 4000) return { error: "Keep the team culture description to 4,000 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_team_dugout", {
    p_team_id: teamId,
    p_headline: headline,
    p_statement: statement,
    p_standards: standards,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}
