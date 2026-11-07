"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { editorCheck, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, isoDate, text, wholeNumber, type FormState } from "@/lib/form";
import { formatDay, formatLongDate } from "@/lib/dates";
import { isUuid } from "@/lib/softball";
import {
  BASE_RUNNING, BASE_RUNNING_LABEL, HITTING_TYPES, HITTING_TYPE_LABEL, MAX_ROTATIONS, PITCHES, ROTATION_SPOTS,
  type PitchPlan, type Rotation,
} from "@/lib/gameday";
import { lineupSeason, loadGamedayRoster, loadLineup } from "@/lib/gameday-data";
import { loadCoachingStaff } from "@/lib/practice-plans";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { lineupFilename, renderLineupPdf } from "@/lib/pdf/lineup-pdf";
import type { ShareResult } from "../plans/actions";

// ---------------------------------------------------------------------------
// Player cards (hitting type, base running, typed stats) for a team + season
// ---------------------------------------------------------------------------

/** "0.412", ".412" or "41.2" style input for AVG/OBP; null when blank; "invalid" otherwise. */
function rateInput(v: FormDataEntryValue | undefined, max: number) {
  const s = String(v ?? "").trim().replace(/%$/, "");
  if (!s) return null;
  const n = Number(s.startsWith(".") ? `0${s}` : s);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : "invalid";
}

export async function saveGamedayCards(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const seasonId = text(fd, "season_id");
  if (!isUuid(teamId) || !isUuid(seasonId)) return { error: "Choose a team and season." };

  const ids = fd.getAll("player_id").map(String);
  const col = (name: string) => fd.getAll(name).map(String);
  const [types, running, avgs, obps, ks] = [col("hitting_type"), col("base_running"), col("avg"), col("obp"), col("k_pct")];
  const rows = [];
  for (const [i, id] of ids.entries()) {
    if (!isUuid(id)) continue;
    const avg = rateInput(avgs[i], 1);
    const obp = rateInput(obps[i], 1);
    const k = rateInput(ks[i], 100);
    if (avg === "invalid" || obp === "invalid") return { error: "AVG and OBP look like .312 (between 0 and 1)." };
    if (k === "invalid") return { error: "K% is a number between 0 and 100." };
    rows.push({
      team_id: teamId,
      season_id: seasonId,
      player_id: id,
      hitting_type: (HITTING_TYPES as readonly string[]).includes(types[i]) ? types[i] : null,
      base_running: (BASE_RUNNING as readonly string[]).includes(running[i]) ? running[i] : null,
      avg,
      obp,
      k_pct: k,
    });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("gameday_profiles").upsert(rows, { onConflict: "team_id,season_id,player_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

export async function createLineup(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const seasonId = text(fd, "season_id");
  const date = isoDate(fd, "game_date");
  const rotations = wholeNumber(fd, "rotations", 1, MAX_ROTATIONS);
  if (!isUuid(teamId)) return { error: "Choose a team." };
  if (!date) return { error: "Pick the game date." };
  if (rotations === "invalid") return { error: `Rotations: 1 to ${MAX_ROTATIONS}.` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gameday_lineups")
    .insert({
      team_id: teamId,
      season_id: isUuid(seasonId) ? seasonId : null,
      game_date: date,
      opponent: text(fd, "opponent"),
      title: text(fd, "title"),
      rotations: rotations ?? 5,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };
  redirect(`/dugout/gameday/${data.id}`);
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const isPitch = (v: unknown): v is PitchPlan["chase"][number] => typeof v === "string" && (PITCHES as readonly string[]).includes(v);

/** Checks the builder's JSON; a string is an error message. */
function cleanLineup(body: string) {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body);
  } catch {
    return "Couldn't read the lineup. Reload the page and try again.";
  }
  const date = typeof raw.game_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.game_date) ? raw.game_date : null;
  if (!date) return "Pick the game date.";
  const rotations = Number(raw.rotations);
  if (!Number.isInteger(rotations) || rotations < 1 || rotations > MAX_ROTATIONS) return `Rotations: 1 to ${MAX_ROTATIONS}.`;

  const order = (Array.isArray(raw.batting_order) ? raw.batting_order : []).filter(isUuid);
  const defense: Record<string, Rotation> = {};
  const pitching: Record<string, PitchPlan> = {};
  for (let r = 1; r <= rotations; r++) {
    const rot = (raw.defense as Record<string, Record<string, unknown>> | undefined)?.[r] ?? {};
    defense[r] = Object.fromEntries(
      Object.entries(rot).filter(([id, spot]) => isUuid(id) && (ROTATION_SPOTS as readonly string[]).includes(spot as string)),
    ) as Rotation;
    const p = (raw.pitching as Record<string, Record<string, unknown>> | undefined)?.[r];
    if (p) {
      pitching[r] = {
        primary: isPitch(p.primary) ? p.primary : null,
        secondary: isPitch(p.secondary) ? p.secondary : null,
        chase: (Array.isArray(p.chase) ? p.chase : []).filter(isPitch).slice(0, 3),
      };
    }
  }
  return {
    game_date: date,
    opponent: str(raw.opponent, 120),
    title: str(raw.title, 120),
    rotations,
    batting_order: [...new Set(order)],
    defense,
    pitching,
    notes: str(raw.notes, 1000),
  };
}

export async function saveLineup(lineupId: string, body: string): Promise<{ error: string | null; savedAt?: string }> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(lineupId)) return { error: "Unknown lineup." };
  const lineup = cleanLineup(body);
  if (typeof lineup === "string") return { error: lineup };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gameday_lineups")
    .update(lineup)
    .eq("id", lineupId)
    .eq("status", "draft")
    .select("updated_at");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "This lineup is final. Reopen it to make changes." };
  return { error: null, savedAt: data[0].updated_at as string };
}

export async function finalizeLineup(lineupId: string): Promise<{ error: string | null }> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(lineupId)) return { error: "Unknown lineup." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("gameday_lineups")
    .update({ status: "final", finalized_at: new Date().toISOString() })
    .eq("id", lineupId)
    .eq("status", "draft");
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

export async function reopenLineup(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("gameday_lineups").update({ status: "draft", finalized_at: null }).eq("id", id);
  refresh();
}

export async function deleteLineup(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("gameday_lineups").delete().eq("id", id);
  redirect(isUuid(teamId) ? `/dugout/gameday?team=${teamId}` : "/dugout/gameday");
}

// ---------------------------------------------------------------------------
// Share with the coaching staff (PDF attached)
// ---------------------------------------------------------------------------

export async function shareLineup(lineupId: string, recipientIds: string[], note: string): Promise<ShareResult> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(lineupId)) return { error: "Unknown lineup." };
  const supabase = await createClient();
  const lineup = await loadLineup(supabase, lineupId);
  if (!lineup) return { error: "This lineup was deleted." };
  if (lineup.status === "draft") {
    const { error } = await supabase
      .from("gameday_lineups")
      .update({ status: "final", finalized_at: new Date().toISOString() })
      .eq("id", lineupId);
    if (error) return { error: friendlyDbError(error) };
  }

  const staff = await loadCoachingStaff(supabase);
  const to = staff.filter((s) => recipientIds.includes(s.user_id));
  if (to.length === 0) return { error: "Pick at least one coach to send it to." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gggcafe.vercel.app";
  const url = `${host.startsWith("localhost") ? "http" : "https"}://${host}/dugout/gameday/${lineup.id}`;
  const user = await getCurrentUser();
  const from = user?.staff?.displayName ?? "A coach";
  const vs = lineup.opponent ? ` vs ${lineup.opponent}` : "";
  const subject = `Lineup: ${lineup.team.name}${vs} · ${formatDay(lineup.game_date)}`;
  const seasonId = await lineupSeason(supabase, lineup.team.id, lineup.season_id);
  const roster = seasonId ? await loadGamedayRoster(supabase, lineup.team.id, seasonId) : [];
  const byId = new Map(roster.map((p) => [p.id, p]));
  const orderLines = lineup.batting_order.map((id, i) => {
    const p = byId.get(id);
    const tags = [p?.hitting_type && HITTING_TYPE_LABEL[p.hitting_type], p?.base_running && BASE_RUNNING_LABEL[p.base_running]].filter(Boolean).join(", ");
    return `${i + 1}. ${p?.short ?? "Player"}${tags ? ` (${tags})` : ""}`;
  });
  const cleanNote = note.trim().slice(0, 1000) || null;
  const textBody = [
    `${from} shared the lineup for ${lineup.team.name}${vs}, ${formatLongDate(lineup.game_date)}.`,
    cleanNote ? `\n${cleanNote}\n` : "",
    "Batting order:",
    ...orderLines,
    "",
    `Full lineup with rotations: ${url}`,
  ].join("\n");

  if (!emailConfigured()) {
    const params = new URLSearchParams({ subject, body: textBody.slice(0, 1600) });
    refresh();
    return { error: null, mailto: `mailto:${to.map((s) => encodeURIComponent(s.email)).join(",")}?${params.toString().replace(/\+/g, "%20")}` };
  }

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Helvetica,Arial,sans-serif;color:#000a2d">
  <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border-collapse:collapse">
    <tr><td style="background:#000a2d;padding:20px 24px"><div style="color:#e7fb06;font-size:20px;font-weight:bold;letter-spacing:2px">LINEUP CARD</div>
      <div style="color:#fff;font-size:14px;margin-top:4px">${escapeHtml(`${lineup.team.name}${vs}`.toUpperCase())} · ${escapeHtml(formatLongDate(lineup.game_date))}</div></td></tr>
    <tr><td style="padding:20px 24px">
      <p style="margin:0 0 12px;font-size:14px">${escapeHtml(from)} shared the lineup. The PDF with defensive rotations and the pitching plan is attached.</p>
      ${cleanNote ? `<p style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #fe1f7c;background:#f4f6fb;font-size:14px;white-space:pre-line">${escapeHtml(cleanNote)}</p>` : ""}
      <ol style="margin:0;padding-left:22px;font-size:14px;line-height:1.7">${orderLines.map((l) => `<li>${escapeHtml(l.replace(/^\d+\.\s/, ""))}</li>`).join("")}</ol>
      <p style="margin:20px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#e7fb06;color:#000a2d;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:999px">Open in the Coaches Dugout</a></p>
    </td></tr></table></body></html>`;
  const pdf = await renderLineupPdf({ ...lineup, status: "final" }, roster);
  const result = await sendEmail({
    to: to.map((s) => s.email),
    subject,
    html,
    text: textBody,
    replyTo: user?.email,
    attachments: [{ filename: lineupFilename(lineup), content: pdf }],
  });
  if (result.error) return { error: result.error };
  await supabase.from("gameday_lineups").update({ shared_at: new Date().toISOString() }).eq("id", lineup.id);
  refresh();
  return { error: null, sent: to.length };
}
