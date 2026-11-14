// Reading and writing spreadsheets for imports and templates (Team Budget import, user 2026-11-13).
// No dependencies: an .xlsx file is a zip of XML parts, read and written here with node:zlib. Reads
// the first rows and columns of every visible sheet (values only; formulas give their saved result,
// date-formatted numbers become "YYYY-MM-DD"), and CSV. Writes plain workbooks with a bold, frozen
// header row, column widths and dropdown lists.
// Server code only (node:zlib). No other imports, so unit tests load it directly.
import { deflateRawSync, inflateRawSync } from "node:zlib";

export type Cell = string | number | boolean | null;
export type Sheet = { name: string; rows: Cell[][] };

/** A file we can't read, with a message for the coach. */
export class SpreadsheetError extends Error {}

const LIMITS = {
  entries: 2000, // files in the zip
  partBytes: 20 * 1024 * 1024, // one unzipped part
  totalBytes: 60 * 1024 * 1024, // everything unzipped (a "zip bomb" stops here)
  sheets: 30,
  rows: 5000,
  cols: 60,
};

const NOT_XLSX = "That file isn't an Excel workbook we can read. Save it as an Excel Workbook (.xlsx) or CSV and try again.";
const OLD_FORMAT =
  "That looks like an older Excel file (.xls) or a password-protected workbook. In Excel choose File → Save As → Excel Workbook (.xlsx), without a password, and upload that.";

// ---------------------------------------------------------------------------
// Zip
// ---------------------------------------------------------------------------

function unzip(data: Uint8Array): { names: string[]; read: (name: string) => string | null } {
  const b = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  // the end-of-central-directory record: the last 22 bytes, unless a comment follows it
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new SpreadsheetError(NOT_XLSX);
  const count = b.readUInt16LE(end + 10);
  if (count > LIMITS.entries) throw new SpreadsheetError(NOT_XLSX);
  const entries = new Map<string, { flags: number; method: number; size: number; packed: number; local: number }>();
  let p = b.readUInt32LE(end + 16);
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) throw new SpreadsheetError(NOT_XLSX);
    const nameLength = b.readUInt16LE(p + 28);
    const name = b.toString("utf8", p + 46, p + 46 + nameLength).replace(/\\/g, "/");
    entries.set(name, {
      flags: b.readUInt16LE(p + 8),
      method: b.readUInt16LE(p + 10),
      packed: b.readUInt32LE(p + 20),
      size: b.readUInt32LE(p + 24),
      local: b.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }

  let total = 0;
  function read(name: string): string | null {
    const e = entries.get(name);
    if (!e) return null;
    if (e.flags & 1) throw new SpreadsheetError(OLD_FORMAT);
    if (e.size > LIMITS.partBytes || e.packed === 0xffffffff) throw new SpreadsheetError("That workbook is too big. Keep the budget to one sheet of a few thousand rows.");
    if (e.local + 30 > b.length || b.readUInt32LE(e.local) !== 0x04034b50) throw new SpreadsheetError(NOT_XLSX);
    const start = e.local + 30 + b.readUInt16LE(e.local + 26) + b.readUInt16LE(e.local + 28);
    const packed = b.subarray(start, start + e.packed);
    let out: Buffer;
    if (e.method === 0) out = packed;
    else if (e.method === 8) {
      try {
        out = inflateRawSync(packed, { maxOutputLength: LIMITS.partBytes });
      } catch {
        throw new SpreadsheetError(NOT_XLSX);
      }
    } else throw new SpreadsheetError(NOT_XLSX);
    total += out.length;
    if (total > LIMITS.totalBytes) throw new SpreadsheetError("That workbook is too big. Keep the budget to one sheet of a few thousand rows.");
    return out.toString("utf8");
  }
  return { names: [...entries.keys()], read };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// a fixed timestamp (2026-01-01), so the same workbook gives the same bytes
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** A zip file of these files (deflated). Exported for tests that build workbooks by hand. */
export function zipFiles(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const packed = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(f.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

// ---------------------------------------------------------------------------
// XML (the small, regular subset spreadsheets use)
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? whole;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

/** Excel's escape for characters XML can't hold: _x000D_ is a carriage return. */
const unescapeOoxml = (s: string) => s.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = decode(m[2] ?? m[3] ?? "");
  return out;
}

/** Drops namespace prefixes from tag names (<x:row> → <row>); some tools write them. */
const stripPrefixes = (xml: string) => xml.replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, "<$1");

/** The text of a shared or inline string: every <t> run, leaving out phonetic guides. */
function runText(xml: string) {
  let out = "";
  for (const m of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?(?<!\/)>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescapeOoxml(decode(out));
}

const escapeXml = (s: string) =>
  s
    // characters XML 1.0 can't hold at all
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Column letters to a 0-based index: "A1" → 0, "AB7" → 27. */
function columnIndex(ref: string) {
  let n = 0;
  for (const ch of ref.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

/** 0-based index to column letters: 0 → "A", 27 → "AB". */
export function columnName(index: number) {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// built-in number formats that show a date
const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** A custom number format that shows a date: it has days or years outside quotes and [brackets]. */
function isDateFormat(code: string) {
  const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "").replace(/[_*]./g, "");
  return /[dy]/i.test(bare);
}

/** A date serial number to "YYYY-MM-DD" (the time of day is dropped). */
export function serialToIso(serial: number, date1904 = false) {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Resolves a relationship target against the part that points to it. */
function resolvePath(from: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function relationships(read: (name: string) => string | null, part: string) {
  const dir = part.split("/").slice(0, -1).join("/");
  const file = part.split("/").pop();
  const xml = read(`${dir ? `${dir}/` : ""}_rels/${file}.rels`) ?? "";
  return [...stripPrefixes(xml).matchAll(/<Relationship\b([^>]*?)\/?>/g)].map((m) => {
    const a = attrs(m[1]);
    return { id: a.Id ?? "", type: a.Type ?? "", target: a.TargetMode === "External" ? "" : resolvePath(part, a.Target ?? "") };
  });
}

/** Every visible sheet of an .xlsx workbook, as rows of cell values. */
export function readXlsx(data: Uint8Array): Sheet[] {
  if (data.length >= 4 && data[0] === 0xd0 && data[1] === 0xcf && data[2] === 0x11 && data[3] === 0xe0) throw new SpreadsheetError(OLD_FORMAT);
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) throw new SpreadsheetError(NOT_XLSX);
  const { read } = unzip(data);

  const book = relationships(read, "").find((r) => r.type.endsWith("/officeDocument"))?.target ?? "xl/workbook.xml";
  const workbook = stripPrefixes(read(book) ?? "");
  if (!workbook.includes("<sheet")) throw new SpreadsheetError(NOT_XLSX);
  const date1904 = /<workbookPr\b[^>]*\bdate1904\s*=\s*["'](1|true)["']/i.test(workbook);
  const rels = relationships(read, book);

  const sharedPart = rels.find((r) => r.type.endsWith("/sharedStrings"))?.target;
  const shared = [...stripPrefixes((sharedPart && read(sharedPart)) || "").matchAll(/<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
    runText(m[1] ?? ""),
  );

  const stylesPart = rels.find((r) => r.type.endsWith("/styles"))?.target;
  const styles = stripPrefixes((stylesPart && read(stylesPart)) || "");
  const customFormats = new Map(
    [...styles.matchAll(/<numFmt\b([^>]*?)\/?>/g)].map((m) => {
      const a = attrs(m[1]);
      return [Number(a.numFmtId), a.formatCode ?? ""] as const;
    }),
  );
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  const dateStyle = [...cellXfs.matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)].map((m) => {
    const id = Number(attrs(m[1]).numFmtId ?? 0);
    return DATE_FORMAT_IDS.has(id) || (customFormats.has(id) && isDateFormat(customFormats.get(id)!));
  });

  const sheets: Sheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    if (sheets.length >= LIMITS.sheets) break;
    const a = attrs(m[1]);
    if (a.state === "hidden" || a.state === "veryHidden") continue;
    const relId = Object.entries(a).find(([k]) => k.endsWith(":id"))?.[1];
    const part = rels.find((r) => r.id === relId && r.type.endsWith("/worksheet"))?.target;
    const xml = part ? read(part) : null;
    if (!xml) continue;
    sheets.push({ name: a.name ?? `Sheet${sheets.length + 1}`, rows: sheetRows(stripPrefixes(xml), shared, dateStyle, date1904) });
  }
  if (!sheets.length) throw new SpreadsheetError(NOT_XLSX);
  return sheets;
}

function sheetRows(xml: string, shared: string[], dateStyle: boolean[], date1904: boolean): Cell[][] {
  const data = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] ?? "";
  const rows: Cell[][] = [];
  let nextRow = 0;
  for (const rm of data.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ra = attrs(rm[1]);
    const r = ra.r ? Number(ra.r) - 1 : nextRow;
    nextRow = r + 1;
    if (!(r >= 0) || r >= LIMITS.rows) break;
    const row: Cell[] = [];
    let nextCol = 0;
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(cm[1]);
      const c = ca.r ? columnIndex(ca.r) : nextCol;
      nextCol = c + 1;
      if (c < 0 || c >= LIMITS.cols) continue;
      row[c] = cellValue(ca, cm[2] ?? "", shared, dateStyle, date1904);
    }
    rows[r] = Array.from(row, (v) => v ?? null);
  }
  return Array.from(rows, (r) => r ?? []);
}

function cellValue(a: Record<string, string>, inner: string, shared: string[], dateStyle: boolean[], date1904: boolean): Cell {
  const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  switch (a.t) {
    case "s":
      return v === undefined ? null : (shared[Number(v)] ?? null);
    case "inlineStr":
      return runText(/<is\b[^>]*(?<!\/)>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? "");
    case "str":
    case "e": // a formula error like #REF!: kept as text, so it shows up as "not an amount"
      return v === undefined ? null : unescapeOoxml(decode(v));
    case "b":
      return v === "1" || v === "true";
    case "d":
      return v ? decode(v).slice(0, 10) : null;
    default: {
      if (v === undefined || v.trim() === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return dateStyle[Number(a.s ?? 0)] && n >= 1 ? serialToIso(n, date1904) : n;
    }
  }
}

/** A CSV (or tab- or semicolon-separated) file as rows of text. */
export function readCsv(text: string): Cell[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const sep = count("\t") > count(",") ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (rows.length >= LIMITS.rows) return rows;
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.slice(0, LIMITS.cols).map((v) => (v === "" ? null : v)));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export type ColumnFormat = "date" | "money";

export type WriteSheet = {
  name: string;
  rows: (string | number | null)[][];
  /** column widths, in characters */
  widths?: number[];
  /** how a column shows what's typed into it */
  formats?: (ColumnFormat | null)[];
  /** the first row is a bold header that stays in view when scrolling */
  header?: boolean;
  /** dropdowns: the cells ("B2:B501") and the cells holding the choices ("Lists!$A$2:$A$4"); strict refuses anything else */
  lists?: { cells: string; source: string; strict?: boolean }[];
  hidden?: boolean;
};

const STYLE = { plain: 0, bold: 1, date: 2, money: 3 } as const;

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";

function worksheetXml(sheet: WriteSheet, selected: boolean) {
  const view = sheet.header
    ? `<sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>`
    : `<sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ""}/>`;
  const widthCount = Math.max(sheet.widths?.length ?? 0, sheet.formats?.length ?? 0);
  const cols = Array.from({ length: widthCount }, (_, i) => {
    const width = sheet.widths?.[i] ?? 12;
    const format = sheet.formats?.[i];
    const style = format ? ` style="${STYLE[format]}"` : "";
    return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"${style}/>`;
  }).join("");
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === null || value === "") return "";
          const ref = `${columnName(c)}${r + 1}`;
          const style = sheet.header && r === 0 ? STYLE.bold : sheet.formats?.[c] ? STYLE[sheet.formats[c]!] : 0;
          const s = style ? ` s="${style}"` : "";
          return typeof value === "number"
            ? `<c r="${ref}"${s}><v>${value}</v></c>`
            : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const lists = sheet.lists?.length
    ? `<dataValidations count="${sheet.lists.length}">${sheet.lists
        .map(
          (l) =>
            `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"${l.strict ? "" : ' errorStyle="warning"'} sqref="${l.cells}"><formula1>${escapeXml(l.source)}</formula1></dataValidation>`,
        )
        .join("")}</dataValidations>`
    : "";
  return (
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheetViews>${view}</sheetViews><sheetFormatPr defaultRowHeight="15"/>` +
    `${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows}</sheetData>${lists}` +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`
  );
}

const STYLES_XML =
  `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="m/d/yyyy"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

/** A workbook (.xlsx) with these sheets, in order. The first sheet must be visible. */
export function writeXlsx(sheets: WriteSheet[]): Buffer {
  const files = [
    {
      name: "[Content_Types].xml",
      xml:
        `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      xml: `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      xml:
        `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
        sheets
          .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ""} r:id="rId${i + 1}"/>`)
          .join("") +
        "</sheets></workbook>",
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      xml:
        `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", xml: STYLES_XML },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, xml: worksheetXml(s, i === 0) })),
  ];
  return zipFiles(files.map((f) => ({ name: f.name, data: Buffer.from(f.xml, "utf8") })));
}
