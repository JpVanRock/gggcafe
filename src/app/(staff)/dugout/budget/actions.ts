"use server";

import { refresh } from "next/cache";
import { headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkbox, friendlyDbError, isoDate, oneOf, text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import {
  ENTRY_FORM_CATEGORIES, PAYMENT_CATEGORIES, PAYMENT_METHODS, centsToDollars, creditBalance, money, parseMoney, toCents,
} from "@/lib/budget";
import { STALE, failed, must, runAction } from "@/lib/actions";

function scope(fd: FormData) {
  const team_id = text(fd, "team_id");
  const season_id = text(fd, "season_id");
  return isUuid(team_id) && isUuid(season_id) ? { team_id, season_id } : null;
}

/** Replaces the season's registration costs (name + amount per player). */
export async function saveFees(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
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

/** Records a player's payment: what it's for (only Registration counts toward her fees) and a note. */
export async function recordPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const where = scope(fd);
  if (!where) return { error: "Choose a team and season." };
  const player_id = text(fd, "player_id");
  if (!isUuid(player_id)) return { error: "Choose the player." };
  const cents = parseMoney(text(fd, "amount"));
  if (cents === null || cents === "invalid" || cents <= 0) return { error: "Enter the amount paid, like 250 or 125.50." };
  const entry_date = isoDate(fd, "entry_date");
  if (!entry_date) return invalid("entry_date", "Pick the date it was paid.");
  const description = text(fd, "description");
  if ((description ?? "").length > 300) return invalid("description", "Keep the note to 300 characters.");

  const supabase = await createClient();
  const { error } = await supabase.from("budget_entries").insert({
    ...where,
    kind: "payment",
    player_id,
    entry_date,
    amount: Number(centsToDollars(cents)),
    category: oneOf(fd, "category", PAYMENT_CATEGORIES) ?? "Registration",
    method: oneOf(fd, "method", PAYMENT_METHODS),
    description,
  });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

/** Changes what a recorded payment is for, how it was paid and its note (user, 2026-11-12). */
export async function updatePayment(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const category = oneOf(fd, "category", PAYMENT_CATEGORIES);
    if (!category) return invalid("category", "Choose what the payment was for.");
    const description = text(fd, "description");
    if ((description ?? "").length > 300) return invalid("description", "Keep the note to 300 characters.");
    const supabase = await createClient();
    const { data } = must(
      await supabase
        .from("budget_entries")
        .update({ category, method: oneOf(fd, "method", PAYMENT_METHODS), description })
        .eq("id", id)
        .eq("kind", "payment")
        .select("id"),
    );
    if (!data?.length) return failed("That payment no longer exists, or you can't change it.");
    refresh();
  });
}

/** Sets a player's discount (negative) or extra charge, or clears it. */
export async function saveAdjustment(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
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
      .upsert({ ...where, player_id, amount: Number(centsToDollars(signed)), note: text(fd, "note") });
    if (error) return { error: friendlyDbError(error) };
  }
  refresh();
  return { error: null, saved: true };
}

/** Adds an expense or other income (sponsor, fundraiser...). */
export async function addEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const where = scope(fd);
  if (!where) return { error: "Choose a team and season." };
  const kind = fd.get("kind") === "income" ? "income" : "expense";
  const cents = parseMoney(text(fd, "amount"));
  if (cents === null || cents === "invalid" || cents <= 0) return { error: "Enter the amount, like 650 or 89.99." };
  const entry_date = isoDate(fd, "entry_date");
  if (!entry_date) return invalid("entry_date", "Pick the date.");
  // tournament credits and coach repayments have their own forms
  const category = oneOf(fd, "category", ENTRY_FORM_CATEGORIES[kind]);
  const description = text(fd, "description");
  if ((description ?? "").length > 300) return invalid("description", "Keep the description to 300 characters.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_entries")
    .insert({ ...where, kind, entry_date, amount: Number(centsToDollars(cents)), category: category ?? "Other", description });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function deleteEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("budget_entries").delete().eq("id", id));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Tournament credits (user, 2026-11-11): credit won and used, in their own table
// (budget_credits) apart from the team ledger and balance (user, 2026-11-12); their
// running balance is kept across seasons.
// ---------------------------------------------------------------------------

/** Records tournament credit the team won, or credit it used toward an entry fee. */
export async function addCredit(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const where = scope(fd);
    if (!where) return failed(STALE);
    const used = fd.get("direction") === "used";
    const cents = parseMoney(text(fd, "amount"));
    if (cents === null || cents === "invalid" || cents <= 0) return invalid("amount", "Enter the credit amount, like 250 or 125.50.");
    const entry_date = isoDate(fd, "entry_date");
    if (!entry_date) return invalid("entry_date", "Pick the date.");
    const description = text(fd, "description");
    if (!description) return invalid("description", used ? "Name the tournament the credit paid for." : "Name the tournament the team won it at.");
    if (description.length > 300) return invalid("description", "Keep it to 300 characters.");

    const supabase = await createClient();
    if (used) {
      // credit can't go below zero: check the balance across every season
      const { data } = must(await supabase.from("budget_credits").select("kind, entry_date, amount").eq("team_id", where.team_id));
      const balance = creditBalance(
        (data ?? []).map((e) => ({ kind: e.kind === "used" ? ("used" as const) : ("won" as const), date: e.entry_date, cents: toCents(e.amount) })),
      );
      if (cents > balance) return invalid("amount", `That's more than the team's ${money(balance)} in tournament credit.`);
    }
    must(
      await supabase
        .from("budget_credits")
        .insert({ ...where, kind: used ? "used" : "won", entry_date, amount: Number(centsToDollars(cents)), description }),
    );
    refresh();
  });
}

export async function deleteCredit(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("budget_credits").delete().eq("id", id));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Coaches' out-of-pocket ledger (user, 2026-11-11): what a coach paid with her own
// money, owed back until repaid.
// ---------------------------------------------------------------------------

/** Records something a coach paid for out of pocket. */
export async function addCoachExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const where = scope(fd);
    if (!where) return failed(STALE);
    const paid_by = text(fd, "paid_by");
    if (!paid_by) return invalid("paid_by", "Who paid for it?");
    if (paid_by.length > 80) return invalid("paid_by", "Keep the name to 80 characters.");
    const cents = parseMoney(text(fd, "amount"));
    if (cents === null || cents === "invalid" || cents <= 0) return invalid("amount", "Enter the amount, like 89.99.");
    const entry_date = isoDate(fd, "entry_date");
    if (!entry_date) return invalid("entry_date", "Pick the date.");
    const description = text(fd, "description");
    if (!description) return invalid("description", "Say what it was for, like “Practice balls”.");
    if (description.length > 300) return invalid("description", "Keep it to 300 characters.");
    const category = oneOf(fd, "category", ENTRY_FORM_CATEGORIES.expense) ?? "Other";

    const supabase = await createClient();
    must(
      await supabase
        .from("budget_coach_expenses")
        .insert({ ...where, paid_by, entry_date, category, description, amount: Number(centsToDollars(cents)) }),
    );
    refresh();
  });
}

/** Marks a coach's items repaid, and records the repayment as a team expense when it came from team money. */
export async function repayCoach(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const ids = fd.getAll("expense_id").map(String).filter(isUuid);
    if (ids.length === 0) return failed("Check the items you repaid.");
    const paidOn = isoDate(fd, "repaid_on");
    if (!paidOn) return invalid("repaid_on", "Pick the date it was repaid.");
    const supabase = await createClient();
    must(await supabase.rpc("reimburse_coach_expenses", { p_ids: ids, p_paid_on: paidOn, p_from_team_funds: checkbox(fd, "from_team_funds") }));
    refresh();
  });
}

/** Takes back a repayment: the item is owed again, and its team-ledger expense is removed. */
export async function undoCoachRepayment(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    const { data } = must(await supabase.from("budget_coach_expenses").select("reimbursement_id").eq("id", id).maybeSingle());
    if (!data) return failed(STALE);
    if (data.reimbursement_id) {
      // the database marks every item that repayment covered as owed again
      must(await supabase.from("budget_entries").delete().eq("id", data.reimbursement_id));
    } else {
      must(await supabase.from("budget_coach_expenses").update({ reimbursed_on: null }).eq("id", id));
    }
    refresh();
  });
}

export async function deleteCoachExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("budget_coach_expenses").delete().eq("id", id).is("reimbursed_on", null));
    refresh();
  });
}
