// Team Budget spreadsheet import (user, 2026-11-13): a coach uploads an Excel or CSV file and its
// rows become ledger lines: player payments, expenses and income. This module finds the heading
// row, reads each row into a line or says what's wrong with it, matches player names to the
// roster, and spots lines already in the budget (so the same file twice adds nothing). The server
// action checks every line again before saving (validLine), since the lines come back from the
// browser. No runtime imports, so unit tests load it directly; the category lists come in from
// src/lib/budget.ts (ImportLists).

export type ImportCell = string | number | boolean | null;
export type ImportKind = "payment" | "expense" | "income";
export const IMPORT_KINDS: readonly ImportKind[] = ["payment", "expense", "income"];
export const IMPORT_KIND_LABEL: Record<ImportKind, string> = { payment: "Player payment", expense: "Expense", income: "Income" };

/** The most lines one import takes. */
export const IMPORT_MAX_LINES = 500;
/** The largest file the browser sends (server actions take about 1 MB). */
export const IMPORT_MAX_BYTES = 1_000_000;
/** The ledger's limits (budget_entries): an amount up to $1,000,000; text up to 300 characters. */
const MAX_CENTS = 100_000_000;
const MAX_DESCRIPTION = 300;

export type ImportLists = {
  payment: readonly string[];
  expense: readonly string[];
  income: readonly string[];
  methods: readonly string[];
};

export type ImportPlayer = { id: string; first_name: string; last_name: string; preferred_name: string | null; jersey_number: string | null };

/** One line ready to save. `row` is the spreadsheet's row number; `note` says what the import changed. */
export type ImportLine = {
  row: number;
  kind: ImportKind;
  date: string;
  cents: number;
  category: string;
  playerId: string | null;
  playerName: string | null;
  method: string | null;
  description: string | null;
  note: string | null;
};

export type ImportProblem = { row: number; message: string };

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

type Column = "date" | "type" | "category" | "amount" | "in" | "out" | "player" | "method" | "description" | "ignore";

/** What a heading means, by its words (lowercase, punctuation dropped). */
const HEADINGS: Record<Column, string[]> = {
  date: ["date", "day", "date paid", "paid on", "payment date", "transaction date", "date received", "posted", "posted date", "when"],
  type: ["type", "kind", "entry type", "transaction type", "in out", "in or out", "money in or out", "income or expense", "income expense"],
  category: ["category", "categories", "budget category", "expense category", "income category", "income source", "source", "cat"],
  amount: ["amount", "amt", "amount usd", "total", "cost", "price", "sum", "value", "payment amount", "amount paid", "paid"],
  in: ["money in", "in", "income", "deposit", "deposits", "received", "receipts", "inflow", "collected"],
  out: ["money out", "out", "expense", "expenses", "spent", "withdrawal", "withdrawals", "outflow", "paid out"],
  player: ["player", "player name", "players", "athlete", "athlete name", "name", "daughter", "family"],
  method: ["method", "payment method", "paid with", "how paid", "pay method", "payment type", "form of payment", "paid via", "via"],
  description: [
    "description", "desc", "note", "notes", "memo", "details", "detail", "comment", "comments", "item", "items", "vendor",
    "payee", "what", "what for", "for", "purpose", "reason", "tournament", "event",
  ],
  ignore: ["balance", "running balance", "total balance", "running total", "id", "check number", "check no", "receipt"],
};

const HEADING_OF = new Map<string, Column>(Object.entries(HEADINGS).flatMap(([col, words]) => words.map((w) => [w, col as Column] as const)));

/** Lowercase words only: "Amount ($)" → "amount", "In/Out" → "in out". */
export function headingKey(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\busd\b|\$/g, (m) => (m === "$" ? "" : "usd"))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type ImportColumns = Partial<Record<Exclude<Column, "ignore">, number>>;

/** The heading row: the first of a sheet's first 15 rows that names a date and an amount (or money in/out) column. */
export function findHeadings(rows: ImportCell[][]): { row: number; columns: ImportColumns } | null {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const columns: ImportColumns = {};
    (rows[r] ?? []).forEach((cell, c) => {
      const col = typeof cell === "string" ? HEADING_OF.get(headingKey(cell)) : undefined;
      if (col && col !== "ignore" && columns[col] === undefined) columns[col] = c;
    });
    if (columns.date !== undefined && (columns.amount !== undefined || columns.in !== undefined || columns.out !== undefined)) return { row: r, columns };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export const cellText = (cell: ImportCell | undefined) =>
  cell === null || cell === undefined ? "" : typeof cell === "boolean" ? (cell ? "TRUE" : "FALSE") : String(cell).trim();

/** An amount in cents: 125.5, "$1,250.50", "(40)" (negative). null when blank, "invalid" when it isn't money. */
export function amountCents(cell: ImportCell | undefined): number | null | "invalid" {
  if (typeof cell === "number") return Number.isFinite(cell) ? Math.round(cell * 100) : "invalid";
  let s = cellText(cell).replace(/[\s$,]|usd/gi, "").replace(/−/g, "-");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return "invalid";
  const cents = Math.round(Number(s) * 100);
  return negative ? -cents : cents;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isoDate(y: number, m: number, d: number) {
  if (y < 100) y += 2000;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return y >= 2000 && y <= 2100 ? t.toISOString().slice(0, 10) : null;
}

/**
 * A date as "YYYY-MM-DD": from Excel (already converted, or a raw serial number), or typed like
 * 11/13/2026, 11/13/26, 2026-11-13, Nov 13, 2026 or 13 Nov 2026. Slashes are month first (US).
 */
export function dateIso(cell: ImportCell | undefined): string | null | "invalid" {
  if (typeof cell === "number") {
    // an Excel date that wasn't formatted as one: days since 1899-12-30 (2000–2100)
    if (cell >= 36526 && cell < 73051) return new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86_400_000).toISOString().slice(0, 10);
    return "invalid";
  }
  const s = cellText(cell).toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t\s].*)?$/.exec(s);
  if (m) return isoDate(+m[1], +m[2], +m[3]) ?? "invalid";
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/.exec(s);
  if (m) return isoDate(+m[3], +m[1], +m[2]) ?? "invalid";
  m = /^(?:[a-z]+,?\s+)?([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s); // Nov 13, 2026 / Friday, November 13, 2026
  if (m && MONTHS.includes(m[1].slice(0, 3))) return isoDate(+m[3], MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2]) ?? "invalid";
  m = /^(\d{1,2})\s+([a-z]{3,})\.?,?\s+(\d{4})$/.exec(s); // 13 Nov 2026
  if (m && MONTHS.includes(m[2].slice(0, 3))) return isoDate(+m[3], MONTHS.indexOf(m[2].slice(0, 3)) + 1, +m[1]) ?? "invalid";
  return "invalid";
}

const key = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** A category name in one of the lists, matched loosely ("tournament fee" → "Tournament fees"). */
function categoryIn(list: readonly string[], text: string) {
  const k = key(text);
  if (!k) return null;
  const single = (s: string) => s.replace(/s\b/g, "");
  return list.find((c) => key(c) === k) ?? list.find((c) => single(key(c)) === single(k)) ?? null;
}

/** Everyday words for the budget's categories; only used once we know the line's kind. */
const CATEGORY_WORDS: Record<ImportKind, [RegExp, string][]> = {
  payment: [
    [/regist|\bdues\b|\bfees?\b|tuition|\breg\b|season/, "Registration"],
    [/equip|uniform|jersey|\bbats?\b|glove|helmet|cleat|gear|\bbag\b|apparel|\bpants\b|socks|visor/, "Equipment"],
  ],
  expense: [
    [/tourn|entry fee|showcase/, "Tournament fees"],
    [/league|insurance|sanction|usssa|usa softball|membership/, "League & insurance"],
    [/field|facility|cage|rental|\bgym\b|indoor/, "Field & facility"],
    [/\bumps?\b|umpire|officiat/, "Umpires"],
    [/equip|\bballs?\b|\bbats?\b|catcher|gear|\bnets?\b|first aid|medical kit/, "Equipment"],
    [/uniform|jersey|\bpants\b|socks|visor|\bhats?\b|apparel|shirt|hoodie/, "Uniforms"],
    [/lesson|training|clinic|instruction|camp/, "Training & lessons"],
    [/hotel|lodging|travel|\bgas\b|fuel|mileage|flight|airbnb|\bvan\b|\bbus\b/, "Travel & lodging"],
    [/party|banquet|team event|\bfood\b|snack|pizza|dinner|lunch|award|trophy|trophies|gift/, "Team events"],
  ],
  income: [
    [/fundrais|raffle|car wash|bake sale|\bsale\b|candle|cookie|calendar|50 ?50/, "Fundraiser"],
    [/sponsor|banner|advertis/, "Sponsor"],
    [/donat|donor|\bgift\b/, "Donation"],
    [/reimburs|refund|rebate/, "Reimbursement"],
  ],
};

/** A category from everyday words ("hotel" → Travel & lodging), when its list has it. */
function categoryWord(kind: ImportKind, text: string, lists: ImportLists) {
  const k = key(text);
  if (!k) return null;
  const hit = CATEGORY_WORDS[kind].find(([re, category]) => re.test(k) && lists[kind].includes(category));
  return hit ? hit[1] : null;
}

/** The category for a line of this kind: a name from its list, or an everyday word for one. */
function categoryFor(kind: ImportKind, text: string, lists: ImportLists) {
  return categoryIn(lists[kind], text) ?? categoryWord(kind, text, lists);
}

/**
 * What a Type cell says: a kind, and a category when it named one ("Fundraiser", "Uniforms").
 * A payment category ("Registration") means a payment when the row names a player.
 */
function typeOf(text: string, lists: ImportLists, hasPlayer: boolean): { kind: ImportKind; category?: string } | null {
  const k = key(text);
  if (["payment", "payments", "player payment", "player payments", "dues", "pmt", "fee payment"].includes(k)) return { kind: "payment" };
  if (["expense", "expenses", "out", "money out", "spent", "spending", "cost", "costs", "withdrawal", "debit"].includes(k)) return { kind: "expense" };
  if (["income", "money in", "in", "deposit", "revenue", "credit"].includes(k)) return { kind: "income" };
  const payment = hasPlayer ? categoryIn(lists.payment, text) : null;
  if (payment) return { kind: "payment", category: payment };
  const income = categoryIn(lists.income, text);
  const expense = categoryIn(lists.expense, text);
  if (income && !expense) return { kind: "income", category: income };
  if (expense && !income) return { kind: "expense", category: expense };
  return null;
}

function methodOf(text: string, methods: readonly string[]) {
  const k = key(text);
  if (!k) return null;
  const exact = methods.find((m) => key(m) === k);
  if (exact) return exact;
  if (/cash ?app/.test(k)) return methods.find((m) => m === "Other") ?? null;
  if (/cheque|\bchk\b|\bcheck\b/.test(k)) return methods.find((m) => m === "Check") ?? null;
  if (/credit|debit|visa|mastercard|amex|card|square|stripe/.test(k)) return methods.find((m) => m === "Card") ?? null;
  return methods.find((m) => k.includes(key(m))) ?? methods.find((m) => m === "Other") ?? null;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export function playerLabel(p: ImportPlayer) {
  return `${p.preferred_name?.trim() || p.first_name} ${p.last_name}`;
}

/** The roster player a name means ("Avery Smith", "Smith, Avery", "#12", "Avery"), or why not. */
export function matchPlayer(text: string, roster: ImportPlayer[]): { player: ImportPlayer } | { error: string } {
  const raw = text.trim();
  const jersey = /^#?\s*(\d{1,3})(?:\s+(.*))?$/.exec(raw);
  const name = key(jersey ? (jersey[2] ?? "") : raw);
  if (jersey && !name) {
    const hits = roster.filter((p) => (p.jersey_number ?? "").replace(/^0+(?=\d)/, "") === jersey[1].replace(/^0+(?=\d)/, ""));
    if (hits.length === 1) return { player: hits[0] };
    return { error: hits.length ? `More than one player wears #${jersey[1]}. Use her name.` : `No player wears #${jersey[1]} on this season's roster.` };
  }
  const firsts = (p: ImportPlayer) => [p.first_name, p.preferred_name ?? ""].map(key).filter(Boolean);
  const full = roster.filter((p) =>
    firsts(p).some((f) => {
      const l = key(p.last_name);
      return name === `${f} ${l}` || name === `${l} ${f}`;
    }),
  );
  const byFirst = roster.filter((p) => firsts(p).includes(name));
  const byLast = roster.filter((p) => key(p.last_name) === name);
  // "Smith family", "Avery Smith (mom)": the name with extra words around it
  const within = roster.filter((p) => {
    const words = ` ${name} `;
    return firsts(p).some((f) => words.includes(` ${f} ${key(p.last_name)} `));
  });
  for (const hits of [full, byFirst, byLast, within]) {
    if (hits.length === 1) return { player: hits[0] };
    if (hits.length > 1) return { error: `“${raw}” matches more than one player. Use her full name.` };
  }
  return { error: `No player named “${raw}” on this season's roster.` };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const TOTALS = /^(grand\s+)?(sub\s*)?totals?\b|^(starting|ending|opening|closing|running)?\s*balance\b|^net\b/i;

/** Every row under the headings: the lines to import, the problems by row, and how many rows were left out (totals). */
export function readBudgetRows(
  rows: ImportCell[][],
  headings: { row: number; columns: ImportColumns },
  roster: ImportPlayer[],
  lists: ImportLists,
): { lines: ImportLine[]; problems: ImportProblem[]; skipped: number } {
  const { columns } = headings;
  const lines: ImportLine[] = [];
  const problems: ImportProblem[] = [];
  let skipped = 0;
  const used = Object.values(columns);

  for (let r = headings.row + 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const get = (c: keyof ImportColumns) => (columns[c] === undefined ? null : (cells[columns[c]!] ?? null));
    if (used.every((c) => cellText(cells[c]) === "")) continue;
    const row = r + 1;
    const problem = (message: string) => problems.push({ row, message });

    // a totals or balance row: left out
    if (cells.some((c) => typeof c === "string" && TOTALS.test(c.trim())) && dateIso(get("date")) === null) {
      skipped++;
      continue;
    }

    const typeText = cellText(get("type"));
    const categoryText = cellText(get("category"));
    const playerText = cellText(get("player"));
    const descriptionText = cellText(get("description"));

    // the amount, or money in / money out
    let cents = amountCents(get("amount"));
    let side: "in" | "out" | null = null;
    if (cents === null) {
      const inCents = amountCents(get("in"));
      const outCents = amountCents(get("out"));
      if (typeof inCents === "number" && inCents !== 0 && typeof outCents === "number" && outCents !== 0) {
        problem("It has both money in and money out. Put them on separate rows.");
        continue;
      }
      if (inCents !== null && inCents !== 0) [cents, side] = [inCents, "in"];
      else if (outCents !== null && outCents !== 0) [cents, side] = [outCents, "out"];
    }

    if (/tournament credit/i.test(`${typeText} ${categoryText}`)) {
      problem("Tournament credit has its own form: Tournament credit won or used.");
      continue;
    }

    // payment, expense or income
    const typed = typeText ? typeOf(typeText, lists, Boolean(playerText)) : null;
    if (typeText && !typed) {
      problem(`Type “${typeText}” isn't one we know. Use Payment, Expense or Income.`);
      continue;
    }
    const kind: ImportKind | null =
      typed?.kind ??
      (playerText && side !== "out" ? "payment" : null) ??
      (side === "out" ? "expense" : side === "in" ? "income" : null) ??
      (categoryIn(lists.expense, categoryText) && !categoryIn(lists.income, categoryText) ? "expense" : null) ??
      (categoryIn(lists.income, categoryText) && !categoryIn(lists.expense, categoryText) ? "income" : null) ??
      (typeof cents === "number" && cents < 0 ? "expense" : null);
    if (!kind) {
      problem("Say whether it's a Payment, Expense or Income (the Type column).");
      continue;
    }

    if (cents === null) {
      problem("There's no amount.");
      continue;
    }
    if (cents === "invalid") {
      problem(`“${cellText(get("amount"))}” isn't an amount. Use a number like 125.50.`);
      continue;
    }
    if (cents < 0) {
      if (kind !== "expense") {
        problem("The amount is negative. Use a positive amount (refunds can be entered as an expense).");
        continue;
      }
      cents = -cents;
    }
    if (cents === 0) {
      problem("The amount is 0.");
      continue;
    }
    if (cents > MAX_CENTS) {
      problem("That's more than $1,000,000.");
      continue;
    }

    const date = dateIso(get("date"));
    if (date === null) {
      problem("There's no date.");
      continue;
    }
    if (date === "invalid") {
      problem(`“${cellText(get("date"))}” isn't a date. Use a date like 11/13/2026.`);
      continue;
    }

    // the category: from the list, else Other (keeping what the sheet said in the description)
    let category =
      categoryFor(kind, categoryText, lists) ??
      typed?.category ??
      // no category given: an expense or income description often says it ("Car wash", "Hotel")
      (categoryText || kind === "payment" ? null : categoryWord(kind, descriptionText, lists));
    let description: string | null = descriptionText || null;
    let note: string | null = null;
    if (!category) {
      // a blank payment category is Registration, as on the form; anything we can't place is Other
      category = kind === "payment" && !categoryText ? "Registration" : "Other";
      if (categoryText) {
        if (!description) description = categoryText;
        note = `“${categoryText}” isn't ${kind === "expense" ? "an expense" : `a ${kind}`} category: saved as ${category}.`;
      }
    }
    if (description && description.length > MAX_DESCRIPTION) {
      description = `${description.slice(0, MAX_DESCRIPTION - 1)}…`;
      note = [note, "The description was shortened to 300 characters."].filter(Boolean).join(" ");
    }

    let playerId: string | null = null;
    let playerName: string | null = null;
    let method: string | null = null;
    if (kind === "payment") {
      if (!playerText) {
        problem("Player payments need the player's name.");
        continue;
      }
      const match = matchPlayer(playerText, roster);
      if ("error" in match) {
        problem(match.error);
        continue;
      }
      playerId = match.player.id;
      playerName = playerLabel(match.player);
      method = methodOf(cellText(get("method")), lists.methods);
    }

    lines.push({ row, kind, date, cents, category, playerId, playerName, method, description, note });
  }
  return { lines, problems, skipped };
}

// ---------------------------------------------------------------------------
// Already in the budget
// ---------------------------------------------------------------------------

export type ExistingEntry = {
  kind: string;
  entry_date: string;
  amount: number | string;
  player_id: string | null;
  category: string | null;
  description: string | null;
};

const lineKey = (l: { kind: string; date: string; cents: number; playerId: string | null; category: string; description: string | null }) =>
  [l.kind, l.date, l.cents, l.playerId ?? "", l.category.toLowerCase(), (l.description ?? "").trim().toLowerCase()].join("|");

/**
 * Splits lines into new ones and ones the budget already has (same kind, date, amount, player,
 * category and description). Counts matter: two identical payments in the file and one in the
 * budget means one is new.
 */
export function splitDuplicates<L extends ImportLine>(lines: L[], existing: ExistingEntry[]): { fresh: L[]; duplicates: L[] } {
  const have = new Map<string, number>();
  for (const e of existing) {
    const k = lineKey({
      kind: e.kind,
      date: e.entry_date,
      cents: Math.round(Number(e.amount) * 100),
      playerId: e.player_id,
      // payments saved before categories count as Registration (paymentCategory in budget.ts)
      category: e.category ?? (e.kind === "payment" ? "Registration" : "Other"),
      description: e.description,
    });
    have.set(k, (have.get(k) ?? 0) + 1);
  }
  const fresh: L[] = [];
  const duplicates: L[] = [];
  for (const l of lines) {
    const k = lineKey(l);
    const n = have.get(k) ?? 0;
    if (n > 0) {
      have.set(k, n - 1);
      duplicates.push(l);
    } else fresh.push(l);
  }
  return { fresh, duplicates };
}

// ---------------------------------------------------------------------------
// Checking lines that come back from the browser
// ---------------------------------------------------------------------------

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A line from the browser, checked again: the same line when every field is allowed, else null. */
export function validLine(value: unknown, lists: ImportLists, rosterIds: Set<string>): ImportLine | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const kind = IMPORT_KINDS.find((k) => k === v.kind);
  if (!kind) return null;
  const str = (x: unknown) => (typeof x === "string" ? x : null);
  const date = str(v.date);
  if (!date || !ISO.test(date) || dateIso(date) !== date) return null;
  const cents = v.cents;
  if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null;
  const category = str(v.category);
  if (!category || !lists[kind].includes(category)) return null;
  const description = str(v.description);
  if (description !== null && (description.length > MAX_DESCRIPTION || !description.trim())) return null;
  const playerId = str(v.playerId);
  const method = str(v.method);
  if (kind === "payment") {
    if (!playerId || !rosterIds.has(playerId)) return null;
    if (method !== null && !lists.methods.includes(method)) return null;
  } else if (playerId !== null || method !== null) return null;
  const row = typeof v.row === "number" && Number.isInteger(v.row) ? v.row : 0;
  return { row, kind, date, cents, category, playerId, playerName: str(v.playerName), method, description, note: null };
}

// ---------------------------------------------------------------------------
// What the upload panel shows
// ---------------------------------------------------------------------------

export type ImportPreview = {
  /** ties an import to the preview it came from */
  id: string;
  fileName: string;
  sheet: string;
  /** lines to add */
  lines: ImportLine[];
  /** lines the budget already has (left out) */
  duplicates: ImportLine[];
  problems: ImportProblem[];
  /** totals and balance rows left out */
  skipped: number;
};

/** The upload and import actions' state (a FormState with the preview or what was imported). */
export type ImportState = {
  error: string | null;
  saved?: boolean;
  fields?: Record<string, string>;
  preview?: ImportPreview;
  imported?: { previewId: string; count: number; alreadyThere: number };
};

export const initialImportState: ImportState = { error: null };

/** Totals of the lines by kind, in cents. */
export function importTotals(lines: ImportLine[]) {
  const totals: Record<ImportKind, { count: number; cents: number }> = {
    payment: { count: 0, cents: 0 },
    expense: { count: 0, cents: 0 },
    income: { count: 0, cents: 0 },
  };
  for (const l of lines) {
    totals[l.kind].count++;
    totals[l.kind].cents += l.cents;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// The template (written by src/lib/spreadsheet.ts writeXlsx)
// ---------------------------------------------------------------------------

export const TEMPLATE_HEADINGS = ["Date", "Type", "Category", "Amount", "Player", "Method", "Description"] as const;
export const TEMPLATE_TYPES = ["Payment", "Expense", "Income"] as const;
const TEMPLATE_ROWS = 500;

type TemplateSheet = {
  name: string;
  rows: (string | number | null)[][];
  widths?: number[];
  formats?: ("date" | "money" | null)[];
  header?: boolean;
  lists?: { cells: string; source: string; strict?: boolean }[];
  hidden?: boolean;
};

/**
 * The template workbook: a Budget sheet with the headings and dropdowns (type, category, this
 * season's players, payment method), a How to sheet, and the hidden lists the dropdowns use.
 */
export function budgetTemplate(players: string[], lists: ImportLists, title: string): TemplateSheet[] {
  const categories = [...new Set([...lists.payment, ...lists.expense, ...lists.income])];
  const longest = Math.max(TEMPLATE_TYPES.length, categories.length, players.length, lists.methods.length);
  const listRows = Array.from({ length: longest }, (_, i) => [TEMPLATE_TYPES[i] ?? null, categories[i] ?? null, players[i] ?? null, lists.methods[i] ?? null]);
  const range = (col: string, n: number) => `Lists!$${col}$2:$${col}$${Math.max(2, n + 1)}`;
  const cells = (col: string) => `${col}2:${col}${TEMPLATE_ROWS + 1}`;
  return [
    {
      name: "Budget",
      header: true,
      rows: [[...TEMPLATE_HEADINGS]],
      widths: [12, 12, 24, 12, 24, 12, 44],
      formats: ["date", null, null, "money", null, null, null],
      lists: [
        { cells: cells("B"), source: range("A", TEMPLATE_TYPES.length), strict: true },
        { cells: cells("C"), source: range("B", categories.length) },
        ...(players.length ? [{ cells: cells("E"), source: range("C", players.length) }] : []),
        { cells: cells("F"), source: range("D", lists.methods.length) },
      ],
    },
    {
      name: "How to",
      widths: [110],
      rows: [
        [title],
        [""],
        ["One row per player payment, expense or income, on the Budget sheet. Keep the headings in row 1."],
        ["Date: the day it was paid, like 11/13/2026."],
        ["Type: Payment (a player paid), Expense (the team spent money) or Income (fundraisers, sponsors, donations)."],
        [`Category: pick one from the list. For payments: ${lists.payment.join(", ")}. Only Registration counts toward what a player owes.`],
        ["Amount: in dollars, like 125.50."],
        ["Player: payments only. Pick her name from the list (this season's roster)."],
        [`Method: payments only. ${lists.methods.join(", ")}.`],
        ["Description: anything that helps you remember it, up to 300 characters."],
        [""],
        ["Tournament credit, discounts and out-of-pocket expenses have their own forms on the Budget page."],
        ["To upload: Coaches Dugout → Budget → Import from a spreadsheet. You see every line before anything is saved,"],
        ["and lines already in the budget are left out, so uploading the same file again adds nothing twice."],
      ],
    },
    { name: "Lists", hidden: true, rows: [["Type", "Category", "Player", "Method"], ...listRows] },
  ];
}
