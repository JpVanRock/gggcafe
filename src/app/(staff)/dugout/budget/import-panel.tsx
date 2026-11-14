"use client";

// Team Budget → Import from a spreadsheet (user, 2026-11-13): upload an Excel or CSV file, see every
// line it would add (and the rows that need fixing), then import them together. Server side in
// ./import-actions.ts; rules in src/lib/budget-import.ts.
import { useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Spinner, TableScroll, buttonStyles, tableClass, tdClass, thClass } from "@/components/ui";
import { money } from "@/lib/budget";
import { formatDay } from "@/lib/dates";
import {
  IMPORT_KINDS, IMPORT_KIND_LABEL, IMPORT_MAX_BYTES, importTotals, initialImportState, type ImportPreview, type ImportState,
} from "@/lib/budget-import";
import { checkBudgetFile, importBudgetLines } from "./import-actions";
import type { Scope } from "./forms";

/** How many lines the preview lists before "Show all". */
const SHOWN = 50;
const ACCEPT = ".xlsx,.xlsm,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function ScopeFields({ scope }: { scope: Scope }) {
  return (
    <>
      <input type="hidden" name="team_id" value={scope.teamId} />
      <input type="hidden" name="season_id" value={scope.seasonId} />
    </>
  );
}

/** The panel; "Import another file" starts it over. */
export function BudgetImport({ scope, templateHref }: { scope: Scope; templateHref: string }) {
  const [round, setRound] = useState(0);
  return <ImportRound key={`${scope.seasonId}-${round}`} scope={scope} templateHref={templateHref} onRestart={() => setRound((r) => r + 1)} />;
}

function ImportRound({ scope, templateHref, onRestart }: { scope: Scope; templateHref: string; onRestart: () => void }) {
  const [check, checkAction, checking] = useActionState(checkBudgetFile, initialImportState);
  const [result, importAction] = useActionState(importBudgetLines, initialImportState);
  const [tooBig, setTooBig] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const preview = check.preview;
  const imported = preview && result.imported?.previewId === preview.id ? result.imported : null;

  if (imported) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="status" className="text-sm text-highlight">
          Added {count(imported.count, "line", "lines")} to the budget
          {imported.alreadyThere ? ` (${count(imported.alreadyThere, "line was", "lines were")} already there)` : ""}.
        </p>
        <button type="button" className={buttonStyles("secondary")} onClick={onRestart}>
          Import another file
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form ref={form} action={checkAction} className="flex flex-col gap-3">
        <ScopeFields scope={scope} />
        <p className="text-sm text-muted">
          Add player payments, expenses and income all at once from an Excel (.xlsx) or CSV file. You see every line before anything is
          saved.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={buttonStyles("primary", `cursor-pointer focus-within:ring-2 focus-within:ring-pink ${checking ? "pointer-events-none opacity-60" : ""}`)}
          >
            {checking ? (
              <>
                <Spinner />
                Checking the file…
              </>
            ) : preview ? (
              "Upload a different file"
            ) : (
              "Upload a spreadsheet"
            )}
            <input
              type="file"
              name="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={checking}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > IMPORT_MAX_BYTES) {
                  setTooBig(true);
                  e.target.value = "";
                  return;
                }
                setTooBig(false);
                form.current?.requestSubmit();
              }}
            />
          </label>
          <a href={templateHref} download className={buttonStyles("secondary")}>
            Download the template
          </a>
        </div>
        <p className="text-xs text-muted">
          The template has the columns and dropdowns, with this season&apos;s roster. Your own sheet works too when a row names its
          columns: Date, Type (Payment, Expense or Income), Category, Amount, Player, Method and Description.
        </p>
        <FormMessage error={tooBig ? "That file is over 1 MB. Keep the budget to one sheet, or split it into two files." : check.error} fields={check.fields} />
      </form>

      {preview && !checking && <Preview preview={preview} scope={scope} importAction={importAction} importState={result} />}
    </div>
  );
}

function Preview({
  preview,
  scope,
  importAction,
  importState,
}: {
  preview: ImportPreview;
  scope: Scope;
  importAction: (fd: FormData) => void;
  importState: ImportState;
}) {
  const [all, setAll] = useState(false);
  const totals = importTotals(preview.lines);
  const shown = all ? preview.lines : preview.lines.slice(0, SHOWN);
  const kindCount: Record<string, [string, string]> = {
    payment: ["player payment", "player payments"],
    expense: ["expense", "expenses"],
    income: ["income line", "income lines"],
  };

  return (
    <section aria-label="What the file adds" className="flex flex-col gap-4 border-t border-navy-700 pt-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold break-all">
          {preview.fileName}
          {preview.sheet !== preview.fileName && <span className="font-normal text-muted"> · sheet “{preview.sheet}”</span>}
        </p>
        {preview.lines.length > 0 && (
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {IMPORT_KINDS.filter((k) => totals[k].count).map((k) => (
              <li key={k}>
                {count(totals[k].count, ...kindCount[k])} · <span className="tabular-nums">{money(totals[k].cents)}</span>
              </li>
            ))}
          </ul>
        )}
        {preview.duplicates.length > 0 && (
          <p className="text-sm text-muted">
            {count(preview.duplicates.length, "line is", "lines are")} already in the budget and will be left out.
          </p>
        )}
        {preview.skipped > 0 && <p className="text-sm text-muted">{count(preview.skipped, "totals row", "totals rows")} left out.</p>}
      </div>

      {preview.problems.length > 0 && (
        <div className="rounded-xl border border-danger/60 p-4">
          <p className="text-sm font-semibold text-danger">
            {count(preview.problems.length, "row needs", "rows need")} fixing and won&apos;t be imported:
          </p>
          <ul className="mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto text-sm">
            {preview.problems.map((p) => (
              <li key={p.row}>
                <span className="font-semibold tabular-nums">Row {p.row}:</span> {p.message}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Fix them in the spreadsheet and upload it again: lines you import now are recognized and left out next time.
          </p>
        </div>
      )}

      {preview.lines.length > 0 ? (
        <>
          <TableScroll label="Lines to import">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Row</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Category</th>
                  <th className={thClass}>Player</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>Description</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.row}>
                    <td className={`${tdClass} text-muted tabular-nums`}>{l.row}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDay(l.date)}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{IMPORT_KIND_LABEL[l.kind]}</td>
                    <td className={tdClass}>{l.category}</td>
                    <td className={tdClass}>
                      {l.playerName ?? ""}
                      {l.method && <span className="block text-xs text-muted">{l.method}</span>}
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap tabular-nums`}>{money(l.cents)}</td>
                    <td className={tdClass}>
                      {l.description}
                      {l.note && <span className="block text-xs text-muted">{l.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {!all && preview.lines.length > SHOWN && (
            <button type="button" className={buttonStyles("link", "self-start")} onClick={() => setAll(true)}>
              Show all {preview.lines.length} lines
            </button>
          )}
          <form action={importAction} className="flex flex-col items-start gap-2">
            <ScopeFields scope={scope} />
            <input type="hidden" name="preview_id" value={preview.id} />
            <input type="hidden" name="lines" value={JSON.stringify(preview.lines)} />
            <SubmitButton pendingLabel="Importing…">Import {count(preview.lines.length, "line", "lines")}</SubmitButton>
            <FormMessage error={importState.error} />
          </form>
        </>
      ) : (
        <p className="text-sm text-muted">
          Nothing new to import{preview.duplicates.length ? ": every line is already in the budget" : ""}.
        </p>
      )}
    </section>
  );
}
