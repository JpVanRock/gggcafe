"use server";

// Team Budget spreadsheet import (user, 2026-11-13): checkBudgetFile reads the upload and returns
// what it would add (nothing is saved), importBudgetLines saves those lines in one insert. Head
// coaches and admins only, like every budget change. Rules in src/lib/budget-import.ts.
import { refresh } from "next/cache";
import { headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { invalid, text } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { ENTRY_FORM_CATEGORIES, PAYMENT_CATEGORIES, PAYMENT_METHODS, centsToDollars } from "@/lib/budget";
import {
  IMPORT_MAX_BYTES, IMPORT_MAX_LINES, findHeadings, readBudgetRows, splitDuplicates, validLine,
  type ImportLine, type ImportLists, type ImportPlayer, type ImportState,
} from "@/lib/budget-import";
import { SpreadsheetError, readCsv, readXlsx, type Sheet } from "@/lib/spreadsheet";

const LISTS: ImportLists = {
  payment: PAYMENT_CATEGORIES,
  expense: ENTRY_FORM_CATEGORIES.expense,
  income: ENTRY_FORM_CATEGORIES.income,
  methods: PAYMENT_METHODS,
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

function scope(fd: FormData) {
  const team_id = text(fd, "team_id");
  const season_id = text(fd, "season_id");
  return isUuid(team_id) && isUuid(season_id) ? { team_id, season_id } : null;
}

/** The season's active players (the Budget page lists the same ones), and the ledger lines it has. */
async function seasonData(supabase: Supabase, teamId: string, seasonId: string) {
  const [roster, entries] = await Promise.all([
    supabase
      .from("roster_entries")
      .select("jersey_number, player:players(id, first_name, last_name, preferred_name)")
      .eq("team_id", teamId)
      .eq("season_id", seasonId)
      .eq("active", true),
    supabase.from("budget_entries").select("kind, entry_date, amount, player_id, category, description").eq("team_id", teamId).eq("season_id", seasonId),
  ]);
  const players: ImportPlayer[] = (must(roster).data ?? []).flatMap((r) => (r.player ? [{ ...r.player, jersey_number: r.jersey_number }] : []));
  return { players, existing: must(entries).data ?? [] };
}

/** The upload's sheets: CSV by its name, anything else read as an Excel workbook. */
async function readUpload(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".numbers")) throw new SpreadsheetError("Numbers files can't be read here. In Numbers choose File → Export To → Excel, and upload that.");
  if (name.endsWith(".ods")) throw new SpreadsheetError("Save it as an Excel Workbook (.xlsx) or CSV, and upload that.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.(csv|tsv|txt)$/.test(name)) {
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      // Excel's plain "CSV" on Windows isn't UTF-8
      content = new TextDecoder("windows-1252").decode(bytes);
    }
    return [{ name: file.name, rows: readCsv(content) }];
  }
  return readXlsx(bytes);
}

/** Reads the uploaded spreadsheet and returns what it would add. Saves nothing. */
export async function checkBudgetFile(_prev: ImportState, fd: FormData): Promise<ImportState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const where = scope(fd);
    if (!where) return failed(STALE);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return invalid("file", "Choose a spreadsheet to upload.");
    if (file.size > IMPORT_MAX_BYTES) return invalid("file", "That file is over 1 MB. Keep the budget to one sheet, or split it into two files.");

    let sheets: Sheet[];
    try {
      sheets = await readUpload(file);
    } catch (e) {
      if (e instanceof SpreadsheetError) return invalid("file", e.message);
      throw e;
    }
    // the first sheet with recognizable headings
    const found = sheets.flatMap((sheet) => {
      const headings = findHeadings(sheet.rows);
      return headings ? [{ sheet, headings }] : [];
    })[0];
    if (!found) {
      return invalid(
        "file",
        "We couldn't find the column headings. Row 1 should name the columns, like Date, Type, Category, Amount, Player and Description. Download the template to start from.",
      );
    }

    const supabase = await createClient();
    const { players, existing } = await seasonData(supabase, where.team_id, where.season_id);
    const { lines, problems, skipped } = readBudgetRows(found.sheet.rows, found.headings, players, LISTS);
    if (lines.length + problems.length === 0) return invalid("file", "There are no budget lines under the headings.");
    if (lines.length + problems.length > IMPORT_MAX_LINES) {
      return invalid("file", `That's more than ${IMPORT_MAX_LINES} lines. Split it into smaller files.`);
    }
    const { fresh, duplicates } = splitDuplicates(lines, existing);
    const state: ImportState = {
      error: null,
      preview: { id: crypto.randomUUID(), fileName: file.name, sheet: found.sheet.name, lines: fresh, duplicates, problems, skipped },
    };
    return state;
  });
}

/** Saves the checked lines, all together; lines the budget already has are left out again. */
export async function importBudgetLines(_prev: ImportState, fd: FormData): Promise<ImportState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const where = scope(fd);
    if (!where) return failed(STALE);
    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("lines") ?? ""));
    } catch {
      return failed(STALE);
    }
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > IMPORT_MAX_LINES) return failed(STALE);

    const supabase = await createClient();
    const { players, existing } = await seasonData(supabase, where.team_id, where.season_id);
    // the lines came back from the browser: every field is checked again
    const ids = new Set(players.map((p) => p.id));
    const lines = raw.map((v) => validLine(v, LISTS, ids)).filter((l): l is ImportLine => l !== null);
    if (lines.length !== raw.length) return failed(STALE);
    const { fresh, duplicates } = splitDuplicates(lines, existing);
    if (!fresh.length) return failed("Those lines are already in the budget.");

    must(
      await supabase.from("budget_entries").insert(
        fresh.map((l) => ({
          ...where,
          kind: l.kind,
          entry_date: l.date,
          amount: Number(centsToDollars(l.cents)),
          player_id: l.playerId,
          category: l.category,
          method: l.method,
          description: l.description,
        })),
      ),
    );
    refresh();
    const state: ImportState = {
      error: null,
      saved: true,
      imported: { previewId: text(fd, "preview_id") ?? "", count: fresh.length, alreadyThere: duplicates.length },
    };
    return state;
  });
}
