"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, centsToDollars, money, parseMoney } from "@/lib/budget";
import { initialFormState } from "@/lib/form";
import { addEntry, recordPayment, saveAdjustment, saveFees } from "./actions";

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
  const [state, action, pending] = useActionState(saveFees, initialFormState);
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
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save registration costs"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
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

export function PaymentForm({ scope, players, today }: { scope: Scope; players: BudgetPlayer[]; today: string }) {
  const [state, action, pending] = useActionState(recordPayment, initialFormState);
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
      <div className="sm:col-span-2">
        <Field label="Date paid">
          <input type="date" name="entry_date" required defaultValue={today} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Paid by">
          <select name="method" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Note (optional)">
          <input name="description" maxLength={300} placeholder="Check #1042" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Record payment"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function AdjustmentForm({ scope, players }: { scope: Scope; players: BudgetPlayer[] }) {
  const [state, action, pending] = useActionState(saveAdjustment, initialFormState);
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
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function EntryForm({ scope, today }: { scope: Scope; today: string }) {
  const [state, action, pending] = useActionState(addEntry, initialFormState);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      <Hidden scope={scope} />
      <fieldset className="sm:col-span-6">
        <legend className="sr-only">Expense or income</legend>
        <div role="radiogroup" className="inline-flex rounded-full border border-navy-600 p-0.5">
          {(["expense", "income"] as const).map((k) => (
            <label
              key={k}
              className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold text-muted transition select-none has-checked:bg-pink has-checked:text-on-accent"
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === "expense" ? "Expense" : "Other income"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <Field label="Date">
          <input type="date" name="entry_date" required defaultValue={today} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={kind === "income" ? "Source" : "Category"}>
          <select key={kind} name="category" defaultValue={categories[0]} className={inputClass}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Amount">
          <input name="amount" required inputMode="decimal" placeholder="650.00" className={moneyInput} />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Description">
          <input
            name="description"
            maxLength={300}
            placeholder={kind === "income" ? "Pizza Place banner sponsor" : "Fall Classic entry fee"}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : kind === "income" ? "Add income" : "Add expense"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
