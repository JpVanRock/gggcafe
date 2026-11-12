"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, fieldClass, inputClass } from "@/components/ui";
import { ENTRY_FORM_CATEGORIES, PAYMENT_CATEGORIES, PAYMENT_METHODS, centsToDollars, money, parseMoney, type PaymentCategory } from "@/lib/budget";
import { initialFormState } from "@/lib/form";
import { addCoachExpense, addCredit, addEntry, recordPayment, repayCoach, saveAdjustment, saveFees, updatePayment } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export type Scope = { teamId: string; seasonId: string };
export type BudgetPlayer = { id: string; label: string };

function Hidden({ scope }: { scope: Scope }) {
  return (
    <>
      <input type="hidden" name="team_id" value={scope.teamId} />
      <input type="hidden" name="season_id" value={scope.seasonId} />
    </>
  );
}

const moneyInput = `${inputClass} tabular-nums`;

/** The season's registration costs: what every player owes. */
export function FeesForm({ scope, fees }: { scope: Scope; fees: { name: string; cents: number }[] }) {
  const [state, action] = useActionState(saveFees, initialFormState);
  const [rows, setRows] = useState(() =>
    (fees.length ? fees : [{ name: "Registration", cents: 0 }]).map((f, i) => ({ key: i, name: f.name, amount: f.cents ? centsToDollars(f.cents) : "" })),
  );
  const [next, setNext] = useState(rows.length);
  const total = rows.reduce((sum, r) => {
    const c = parseMoney(r.amount);
    return sum + (typeof c === "number" ? c : 0);
  }, 0);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Hidden scope={scope} />
      {rows.map((row, i) => (
        <div key={row.key} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
          <Field label={i === 0 ? "Cost" : ""}>
            <input
              name="fee_name"
              value={row.name}
              onChange={(e) => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))}
              maxLength={80}
              placeholder="Uniform"
              aria-label={`Cost ${i + 1} name`}
              className={inputClass}
            />
          </Field>
          <Field label={i === 0 ? "Per player" : ""}>
            <input
              name="fee_amount"
              value={row.amount}
              onChange={(e) => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))}
              inputMode="decimal"
              placeholder="0.00"
              aria-label={`Cost ${i + 1} amount`}
              className={moneyInput}
            />
          </Field>
          <button
            type="button"
            onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
            aria-label={`Remove cost ${i + 1}`}
            className="mb-1 rounded-md px-2 py-1.5 text-sm text-muted hover:text-danger"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setRows((list) => [...list, { key: next, name: "", amount: "" }]);
            setNext((n) => n + 1);
          }}
          className="rounded-md border border-dashed border-navy-600 px-3 py-1.5 text-sm text-muted hover:border-pink hover:text-ink"
        >
          + Add a cost
        </button>
        <p className="text-sm">
          Each player owes <span className="font-display font-bold text-highlight tabular-nums">{money(total)}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save registration costs</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

function PlayerSelect({ players, name = "player_id" }: { players: BudgetPlayer[]; name?: string }) {
  return (
    <select name={name} required defaultValue="" className={inputClass}>
      <option value="" disabled>
        Choose a player
      </option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

/** What a player payment is for: only Registration goes toward her registration fees (user, 2026-11-12). */
function PaymentCategoryPicker({ value }: { value: PaymentCategory }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">For</legend>
      <div className="inline-flex flex-wrap rounded-full border border-navy-600 p-0.5">
        {PAYMENT_CATEGORIES.map((c) => (
          <label
            key={c}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold text-muted transition select-none has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40"
          >
            <input type="radio" name="category" value={c} defaultChecked={c === value} className="sr-only" />
            {c}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">Only Registration counts toward her registration fees.</p>
    </fieldset>
  );
}

function MethodSelect({ value = "" }: { value?: string }) {
  return (
    <select name="method" defaultValue={value} className={inputClass}>
      <option value="">—</option>
      {PAYMENT_METHODS.map((m) => (
        <option key={m}>{m}</option>
      ))}
    </select>
  );
}

export function PaymentForm({ scope, players, today }: { scope: Scope; players: BudgetPlayer[]; today: string }) {
  const [state, action] = useActionState(recordPayment, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      <Hidden scope={scope} />
      <div className="sm:col-span-3">
        <Field label="Player">
          <PlayerSelect players={players} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Amount">
          <input name="amount" required inputMode="decimal" placeholder="250.00" className={moneyInput} />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <PaymentCategoryPicker value="Registration" />
      </div>
      <div className="sm:col-span-3">
        <Field label="Date paid">
          <input type="date" name="entry_date" required defaultValue={today} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Paid by">
          <MethodSelect />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Note (optional)" hint="Saved with the payment and shown in the ledger">
          <textarea name="description" rows={2} maxLength={300} placeholder="Check #1042, covers the fall tournament fee" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>Record payment</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function AdjustmentForm({ scope, players }: { scope: Scope; players: BudgetPlayer[] }) {
  const [state, action] = useActionState(saveAdjustment, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      <Hidden scope={scope} />
      <div className="sm:col-span-3">
        <Field label="Player">
          <PlayerSelect players={players} />
        </Field>
      </div>
      <fieldset className="sm:col-span-3">
        <legend className="mb-1.5 text-sm font-medium">Type</legend>
        <div className="flex gap-4 pt-1.5 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="direction" value="discount" defaultChecked className="accent-pink" /> Discount
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="direction" value="charge" className="accent-pink" /> Extra charge
          </label>
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <Field label="Amount" hint="Leave blank or 0 to clear it">
          <input name="amount" inputMode="decimal" placeholder="100.00" className={moneyInput} />
        </Field>
      </div>
      <div className="sm:col-span-4">
        <Field label="Reason (optional)">
          <input name="note" maxLength={200} placeholder="Sibling discount" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>Save</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

/** An expense, or fundraisers and other income: two separate forms (user, 2026-11-12). */
export function EntryForm({ scope, today, kind }: { scope: Scope; today: string; kind: "expense" | "income" }) {
  const [state, action] = useActionState(addEntry, initialFormState);
  const categories = ENTRY_FORM_CATEGORIES[kind];
  const income = kind === "income";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      <Hidden scope={scope} />
      <input type="hidden" name="kind" value={kind} />
      <div className="sm:col-span-2">
        <Field label="Date">
          <input type="date" name="entry_date" required defaultValue={today} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={income ? "Source" : "Category"}>
          <select name="category" defaultValue={categories[0]} className={inputClass}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Amount">
          <input name="amount" required inputMode="decimal" placeholder={income ? "300.00" : "650.00"} className={moneyInput} />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Description">
          <input name="description" maxLength={300} placeholder={income ? "Car wash fundraiser" : "Fall Classic entry fee"} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{income ? "Add income" : "Add expense"}</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

/** Tournament credit the team won, or credit it used toward an entry fee (user, 2026-11-11). */
export function CreditForm({ scope, today, balance }: { scope: Scope; today: string; balance: number }) {
  const [state, action] = useActionState(addCredit, initialFormState);
  const [direction, setDirection] = useState<"won" | "used">("won");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      <Hidden scope={scope} />
      <fieldset className="sm:col-span-6">
        <legend className="sr-only">Credit won or used</legend>
        <div role="radiogroup" className="inline-flex rounded-full border border-navy-600 p-0.5">
          {(["won", "used"] as const).map((d) => (
            <label
              key={d}
              className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold text-muted transition select-none has-checked:bg-pink has-checked:text-on-accent"
            >
              <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} className="sr-only" />
              {d === "won" ? "Credit won" : "Credit used"}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {direction === "won"
            ? "Adds to the team's tournament credit. Credit is kept apart from the team balance."
            : `Takes it off the team's tournament credit (${money(balance)} available). It isn't a team expense: no team money is spent.`}
        </p>
      </fieldset>
      <div className="sm:col-span-2">
        <Field label="Date">
          <input type="date" name="entry_date" required defaultValue={today} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Credit">
          <input name="amount" required inputMode="decimal" placeholder="250.00" className={moneyInput} />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label={direction === "won" ? "Tournament won" : "Tournament it paid for"}>
          <input
            name="description"
            required
            maxLength={300}
            placeholder={direction === "won" ? "Fall Classic champions" : "Spring Opener entry fee"}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{direction === "won" ? "Add credit won" : "Use credit"}</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

/** Something a coach or a parent paid for with their own money (user, 2026-11-11; parents too, 2026-11-12). */
export function CoachExpenseForm({
  scope,
  today,
  coachNames,
  parentNames,
  defaultName,
}: {
  scope: Scope;
  today: string;
  coachNames: string[];
  parentNames: string[];
  defaultName: string;
}) {
  const [state, action] = useActionState(addCoachExpense, initialFormState);
  const [role, setRole] = useState<"coach" | "parent">("coach");
  const [name, setName] = useState(defaultName);
  const pick = (r: "coach" | "parent") => {
    setRole(r);
    setName(r === "coach" ? defaultName : "");
  };
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      <Hidden scope={scope} />
      <fieldset className="sm:col-span-6">
        <legend className="mb-1.5 text-sm font-medium">Paid by a</legend>
        <div role="radiogroup" className="inline-flex rounded-full border border-navy-600 p-0.5">
          {(["coach", "parent"] as const).map((r) => (
            <label
              key={r}
              className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold text-muted transition select-none has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40"
            >
              <input type="radio" name="paid_by_role" value={r} checked={role === r} onChange={() => pick(r)} className="sr-only" />
              {r === "coach" ? "Coach" : "Parent"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-3">
        <Field label={role === "coach" ? "Coach's name" : "Parent's name"}>
          <input
            name="paid_by"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            list={`budget-${role}-names`}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <datalist id="budget-coach-names">
          {coachNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <datalist id="budget-parent-names">
          {parentNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className="sm:col-span-3">
        <Field label="Amount">
          <input name="amount" required inputMode="decimal" placeholder="89.99" className={moneyInput} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Date">
          <input type="date" name="entry_date" required defaultValue={today} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-4">
        <Field label="Category">
          <select name="category" defaultValue="Equipment" className={inputClass}>
            {ENTRY_FORM_CATEGORIES.expense.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="What it was for">
          <input name="description" required maxLength={300} placeholder="Two dozen practice balls" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>Add out-of-pocket expense</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export type OwedItem = { id: string; label: string };

/** Marks a coach's out-of-pocket items repaid; by default the repayment also goes in the team ledger. */
export function RepayForm({ items, today }: { items: OwedItem[]; today: string }) {
  const [state, action] = useActionState(repayCoach, initialFormState);
  if (items.length === 0) return <p className="text-sm text-muted">Nothing is owed right now. Out-of-pocket expenses waiting to be repaid show here.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Items repaid</legend>
        <ul className="flex flex-col gap-1.5">
          {items.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="expense_id" value={it.id} className="mt-1 accent-pink" />
                <span>{it.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Repaid on">
          <input type="date" name="repaid_on" required defaultValue={today} className={`${fieldClass} w-44`} />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="from_team_funds" defaultChecked className="accent-pink" />
          Paid from team money (adds an Out-of-pocket reimbursement expense to the ledger)
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Mark repaid</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

/** Changes a recorded payment's category, method and note (the ledger's Edit). */
export function EditPaymentForm({
  id,
  category,
  method,
  note,
}: {
  id: string;
  category: PaymentCategory;
  method: string | null;
  note: string | null;
}) {
  const [state, action] = useActionState(updatePayment, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <PaymentCategoryPicker value={category} />
      <Field label="Paid by">
        <MethodSelect value={method ?? ""} />
      </Field>
      <Field label="Note (optional)">
        <textarea name="description" rows={3} maxLength={300} defaultValue={note ?? ""} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save changes</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
