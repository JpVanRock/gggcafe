"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { editorCheck, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, isoDate, oneOf, text, wholeNumber, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { formatDay, formatLongDate } from "@/lib/dates";
import {
  DRILL_TAGS, MAX_BLOCK_MINUTES, PLAN_POSITIONS, PRACTICE_SETTINGS, PRACTICE_SETTING_LABEL,
  durationLabel, finalizeProblems, parseClock, planTimeline, practiceRange,
} from "@/lib/dugout";
import { loadCoachingStaff, loadPlanRoster, loadPracticePlan, type PracticePlan } from "@/lib/practice-plans";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { practicePlanFilename, renderPracticePlanPdf } from "@/lib/pdf/practice-plan-pdf";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createPracticePlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const teamId = text(fd, "team_id");
  const date = isoDate(fd, "practice_date");
  const start = text(fd, "start_time");
  const total = wholeNumber(fd, "total_minutes", 15, 480);
  if (!isUuid(teamId)) return { error: "Choose a team." };
  if (!date) return { error: "Pick the practice date." };
  if (start && parseClock(start) === null) return { error: "Check the start time." };
  if (total === null || total === "invalid") return { error: "Pick the total practice time." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_plans")
    .insert({
      team_id: teamId,
      practice_date: date,
      start_time: start,
      setting: oneOf(fd, "setting", PRACTICE_SETTINGS) ?? "outdoor",
      total_minutes: total,
      location: text(fd, "location"),
      focus: text(fd, "focus"),
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };

  redirect(`/dugout/plans/${data.id}`);
}

// ---------------------------------------------------------------------------
// Autosave from the builder
// ---------------------------------------------------------------------------

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Checks the builder's JSON and turns it into the save_practice_plan payload; a string is an error. */
function cleanPlan(body: string) {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body);
  } catch {
    return "Couldn't read the plan. Reload the page and try again.";
  }
  const date = typeof raw.practice_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.practice_date) ? raw.practice_date : null;
  if (!date) return "Pick the practice date.";
  const start = str(raw.start_time, 8);
  if (start && parseClock(start) === null) return "Check the start time.";
  const total = Number(raw.total_minutes);
  if (!Number.isInteger(total) || total < 15 || total > 480) return "Total practice time must be 15 to 480 minutes.";
  const setting = (PRACTICE_SETTINGS as readonly string[]).includes(raw.setting as string) ? raw.setting : "outdoor";

  const drills = Array.isArray(raw.drills) ? raw.drills : [];
  if (drills.length > 60) return "That's more than 60 drills. Split it into two plans.";
  const cleanDrills = [];
  for (const d of drills as Record<string, unknown>[]) {
    const name = str(d?.name, 120);
    if (!name) continue;
    const minutes = d.minutes === null || d.minutes === undefined || d.minutes === "" ? null : Number(d.minutes);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_BLOCK_MINUTES)) {
      return `Time limit for “${name}” must be 1 to ${MAX_BLOCK_MINUTES} minutes.`;
    }
    cleanDrills.push({
      drill_id: isUuid(d.drill_id) ? d.drill_id : null,
      name,
      description: str(d.description, 2000),
      tags: Array.isArray(d.tags) ? d.tags.filter((t) => (DRILL_TAGS as readonly string[]).includes(t as string)) : [],
      minutes,
      coaches: Array.isArray(d.coaches)
        ? [...new Set(d.coaches.map((c) => str(c, 60)).filter((c): c is string => Boolean(c)))].slice(0, 10)
        : [],
      equipment: str(d.equipment, 500),
    });
  }

  const positions = (Array.isArray(raw.positions) ? raw.positions : [])
    .filter(
      (p: Record<string, unknown>) =>
        (PLAN_POSITIONS as readonly string[]).includes(p?.position as string) && isUuid(p?.player_id),
    )
    .slice(0, 300);

  return {
    practice_date: date,
    start_time: start,
    setting,
    total_minutes: total,
    location: str(raw.location, 120),
    focus: str(raw.focus, 200),
    drills: cleanDrills,
    positions,
  };
}

export type SaveResult = { error: string | null; savedAt?: string };

export async function savePracticePlan(planId: string, body: string): Promise<SaveResult> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(planId)) return { error: "Unknown practice plan." };
  const plan = cleanPlan(body);
  if (typeof plan === "string") return { error: plan };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_practice_plan", { p_plan_id: planId, p_plan: plan });
  if (error) {
    if (error.code === "P0004") return { error: "This plan is final. Reopen it to make changes." };
    if (error.code === "P0002") return { error: "This plan was deleted." };
    return { error: friendlyDbError(error) };
  }
  return { error: null, savedAt: data as string };
}

// ---------------------------------------------------------------------------
// Finalize, reopen, delete
// ---------------------------------------------------------------------------

async function finalize(supabase: Supabase, plan: PracticePlan): Promise<string | null> {
  if (plan.status === "final") return null;
  const problems = finalizeProblems(plan.blocks);
  if (problems.length) return problems.join(" ");
  const { error } = await supabase
    .from("practice_plans")
    .update({ status: "final", finalized_at: new Date().toISOString() })
    .eq("id", plan.id)
    .eq("status", "draft");
  return error ? friendlyDbError(error) : null;
}

export async function finalizePracticePlan(planId: string): Promise<{ error: string | null }> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(planId)) return { error: "Unknown practice plan." };
  const supabase = await createClient();
  const plan = await loadPracticePlan(supabase, planId);
  if (!plan) return { error: "This plan was deleted." };
  const error = await finalize(supabase, plan);
  if (error) return { error };
  refresh();
  return { error: null };
}

export async function reopenPracticePlan(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("practice_plans").update({ status: "draft", finalized_at: null }).eq("id", id);
  refresh();
}

export async function deletePracticePlan(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("practice_plans").delete().eq("id", id);
  redirect(isUuid(teamId) ? `/dugout/plans?team=${teamId}` : "/dugout/plans");
}

// ---------------------------------------------------------------------------
// Share with the coaching staff
// ---------------------------------------------------------------------------

export type ShareResult = {
  error: string | null;
  /** how many coaches it was emailed to */
  sent?: number;
  /** email isn't set up: open this in the coach's own email app instead */
  mailto?: string;
};

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gggcafe.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function summaryLines(plan: PracticePlan) {
  const { slots } = planTimeline(plan.start_time, plan.blocks);
  return plan.blocks.map((b, i) => {
    const coaches = b.coaches.length ? ` · ${b.coaches.join(", ")}` : "";
    return { time: slots[i].label ?? "", name: b.name, minutes: b.minutes ?? 0, coaches, equipment: b.equipment };
  });
}

function emailBodies(plan: PracticePlan, url: string, from: string, note: string | null) {
  const range = practiceRange(plan.start_time, plan.total_minutes);
  const when = [formatLongDate(plan.practice_date), range].filter(Boolean).join(", ");
  const facts = [when, PRACTICE_SETTING_LABEL[plan.setting], durationLabel(plan.total_minutes), plan.location, plan.focus && `Focus: ${plan.focus}`]
    .filter(Boolean)
    .join(" · ");
  const lines = summaryLines(plan);

  const text = [
    `${from} shared the practice plan for ${plan.team.name}.`,
    facts,
    note ? `\n${note}\n` : "",
    ...lines.map((l) => `${l.time}  ${l.name} (${l.minutes} min)${l.coaches}`),
    "",
    `Full plan: ${url}`,
  ].join("\n");

  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #d3d9e8;white-space:nowrap;color:#4a5578;font-size:13px">${escapeHtml(l.time)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #d3d9e8;font-size:14px"><strong>${escapeHtml(l.name)}</strong>${
          l.coaches ? `<br><span style="color:#4a5578;font-size:12px">${escapeHtml(l.coaches.slice(3))}</span>` : ""
        }</td>
        <td style="padding:8px 10px;border-bottom:1px solid #d3d9e8;text-align:right;font-size:14px">${l.minutes}</td>
      </tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Helvetica,Arial,sans-serif;color:#000a2d">
  <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border-collapse:collapse">
    <tr><td style="background:#000a2d;padding:20px 24px">
      <div style="color:#e7fb06;font-size:20px;font-weight:bold;letter-spacing:2px">PRACTICE PLAN</div>
      <div style="color:#ffffff;font-size:14px;margin-top:4px;letter-spacing:1px">${escapeHtml(plan.team.name.toUpperCase())}</div>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="margin:0 0 6px;font-size:14px">${escapeHtml(from)} shared the practice plan. The PDF is attached.</p>
      <p style="margin:0 0 16px;font-size:13px;color:#4a5578">${escapeHtml(facts)}</p>
      ${note ? `<p style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #fe1f7c;background:#f4f6fb;font-size:14px;white-space:pre-line">${escapeHtml(note)}</p>` : ""}
      <table role="presentation" width="100%" style="border-collapse:collapse">
        <tr><th align="left" style="padding:6px 10px;font-size:11px;letter-spacing:1px;color:#4a5578">TIME</th>
            <th align="left" style="padding:6px 10px;font-size:11px;letter-spacing:1px;color:#4a5578">DRILL</th>
            <th align="right" style="padding:6px 10px;font-size:11px;letter-spacing:1px;color:#4a5578">MIN</th></tr>
        ${rows}
      </table>
      <p style="margin:20px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#e7fb06;color:#000a2d;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:999px">Open in the Coaches Dugout</a></p>
    </td></tr>
  </table></body></html>`;
  return { text, html };
}

export async function sharePracticePlan(planId: string, recipientIds: string[], note: string): Promise<ShareResult> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(planId)) return { error: "Unknown practice plan." };

  const supabase = await createClient();
  const plan = await loadPracticePlan(supabase, planId);
  if (!plan) return { error: "This plan was deleted." };
  const finalError = await finalize(supabase, plan);
  if (finalError) return { error: finalError };

  const staff = await loadCoachingStaff(supabase);
  const to = staff.filter((s) => recipientIds.includes(s.user_id));
  if (to.length === 0) return { error: "Pick at least one coach to send it to." };

  const user = await getCurrentUser();
  const from = user?.staff?.displayName ?? "A coach";
  const url = `${await siteOrigin()}/dugout/plans/${plan.id}`;
  const subject = `Practice plan: ${plan.team.name} · ${formatDay(plan.practice_date)}`;
  const cleanNote = note.trim().slice(0, 1000) || null;
  const { text: textBody, html } = emailBodies({ ...plan, status: "final" }, url, from, cleanNote);

  if (!emailConfigured()) {
    // Fall back to the coach's own email app (no attachment; the link opens the plan).
    const params = new URLSearchParams({ subject, body: textBody.slice(0, 1600) });
    refresh();
    return {
      error: null,
      mailto: `mailto:${to.map((s) => encodeURIComponent(s.email)).join(",")}?${params.toString().replace(/\+/g, "%20")}`,
    };
  }

  const roster = await loadPlanRoster(supabase, plan.team.id, plan.spots.map((s) => s.player_id));
  const pdf = await renderPracticePlanPdf(plan, roster);
  const result = await sendEmail({
    to: to.map((s) => s.email),
    subject,
    html,
    text: textBody,
    replyTo: user?.email,
    attachments: [{ filename: practicePlanFilename(plan), content: pdf }],
  });
  if (result.error) return { error: result.error };

  await supabase.from("practice_plans").update({ shared_at: new Date().toISOString() }).eq("id", plan.id);
  refresh();
  return { error: null, sent: to.length };
}
