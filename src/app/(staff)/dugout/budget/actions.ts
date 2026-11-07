"use server";

import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, isoDate, oneOf, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, centsToDollars, parseMoney } from "@/lib/budget";

function scope(fd: FormData) {
  const team_id = text(fd, "team_id");
  const season_id = text(fd, "season_id");
  return isUuid(team_id) && isUuid(season_id) ? { team_id, season_id } : null;
}

/** Replaces the season's registration costs (name + amount per player). */
export async function saveFees(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const where = scope(fd);
  if (!where) return { error: "Choose a team and season." };

  const amounts = fd.getAll("fee_amount").map(String);
  const fees: { name: string; amount: string }[] = [];
  for (const [i, raw] of fd.getAll("fee_name").entries()) {
    const name = String(raw).trim();
    const cents = parseMoney(amounts[i]);
    if (!name && cents === null) continue;
    if (!name) return { error: "Give each cost a name, like “Registration”." };
    if (name.length > 80) return { error: "Keep cost names to 80 characters." };
    if (cents === null || cents === "invalid") return { error: `Enter an amount for “${name}”, like 400 or 125.50.` };
    fees.push({ name, amount: centsToDollars(cents) });
  }
  if (fees.length > 20) return { error: "Up to 20 costs." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_budget_fees", { p_team_id: where.team_id, p_season_id: where.season_id, p_fees: fees });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

/** Records a player's payment. */
export async function recordPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const where = scope(fd);
  if (!where) return { error: "Choose a team and season." };
  const player_id = text(fd, "player_id");
  if (!isUuid(player_id)) return { error: "Choose the player." };
  const cents = parseMoney(text(fd, "amount"));
  if (cents === null || cents === "invalid" || cents <= 0) return { error: "Enter the amount paid, like 250 or 125.50." };
  const entry_date = isoDate(fd, "entry_date");
  if (!entry_date) return { error: "Pick the date it was paid." };

  const supabase = await createClient();
  const { error } = await supabase.from("budget_entries").insert({
    ...where,
    kind: "payment",
    player_id,
    entry_date,
    amount: centsToDollars(cents),
    method: oneOf(fd, "method", PAYMENT_METHODS),
    description: text(fd, "description"),
  });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

/** Sets a player's discount (negative) or extra charge, or clears it. */
export async function saveAdjustment(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const where = scope(fd);
  if (!where) return { error: "Choose a team and season." };
  const player_id = text(fd, "player_id");
  if (!isUuid(player_id)) return { error: "Choose the player." };
  const cents = parseMoney(text(fd, "amount"));
  if (cents === "invalid") return { error: "Enter an amount like 100." };

  const supabase = await createClient();
  if (!cents) {
    const { error } = await supabase.from("budget_adjustments").delete().match({ ...where, player_id });
    if (error) return { error: friendlyDbError(error) };
  } else {
    const signed = fd.get("direction") === "charge" ? cents : -cents;
    const { error } = await supabase
      .from("budget_adjustments")
      .upsert({ ...where, player_id, amount: centsToDollars(signed), note: text(fd, "note") });
    if (error) return { error: friendlyDbError(error) };
  }
  refresh();
  return { error: null, saved: true };
}

/** Adds an expense or other income (sponsor, fundraiser...). */
export async function addEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const where = scope(fd);
  if (!where) return { error: "Choose a team and season." };
  const kind = fd.get("kind") === "income" ? "income" : "expense";
  const cents = parseMoney(text(fd, "amount"));
  if (cents === null || cents === "invalid" || cents <= 0) return { error: "Enter the amount, like 650 or 89.99." };
  const entry_date = isoDate(fd, "entry_date");
  if (!entry_date) return { error: "Pick the date." };
  const category = kind === "income" ? oneOf(fd, "category", INCOME_CATEGORIES) : oneOf(fd, "category", EXPENSE_CATEGORIES);
  const description = text(fd, "description");
  if ((description ?? "").length > 300) return { error: "Keep the description to 300 characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_entries")
    .insert({ ...where, kind, entry_date, amount: centsToDollars(cents), category: category ?? "Other", description });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function deleteEntry(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("budget_entries").delete().eq("id", id);
  refresh();
}
