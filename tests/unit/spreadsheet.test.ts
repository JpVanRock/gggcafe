// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { SpreadsheetError, columnName, readCsv, readXlsx, serialToIso, writeXlsx, zipFiles } from "../../src/lib/spreadsheet.ts";

test("column names", () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52, 701, 702].map(columnName), ["A", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
});

test("date serials (1900 and 1904 systems)", () => {
  assert.equal(serialToIso(46339), "2026-11-13");
  assert.equal(serialToIso(46339.75), "2026-11-13");
  assert.equal(serialToIso(44877, true), "2026-11-13");
  assert.equal(serialToIso(61), "1900-03-01");
});

test("a written workbook reads back: text, numbers, empty cells, hidden sheets left out", () => {
  const book = writeXlsx([
    {
      name: "Budget",
      header: true,
      widths: [12, 10],
      formats: ["date", "money"],
      rows: [
        ["Date", "Amount", "Note"],
        ["2026-11-13", 125.5, "Fish & chips <dinner> \"quoted\""],
        [null, 40, "  spaced  "],
      ],
      lists: [{ cells: "C2:C10", source: "Lists!$A$1:$A$2", strict: true }],
    },
    { name: "Lists", rows: [["Yes"], ["No"]], hidden: true },
  ]);
  const sheets = readXlsx(book);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].name, "Budget");
  assert.deepEqual(sheets[0].rows, [
    ["Date", "Amount", "Note"],
    ["2026-11-13", 125.5, 'Fish & chips <dinner> "quoted"'],
    [null, 40, "  spaced  "],
  ]);
  // the same input gives the same bytes
  assert.deepEqual(writeXlsx([{ name: "A", rows: [["x"]] }]), writeXlsx([{ name: "A", rows: [["x"]] }]));
});

// A workbook shaped like Excel's own: shared strings (with rich text and a phonetic guide), a date
// style, formulas with saved results, prefixed tags, sparse rows and cells, booleans and errors.
function excelStyleBook({ date1904 = false } = {}) {
  const parts: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:workbookPr${date1904 ? ' date1904="1"' : ""}/><x:sheets><x:sheet name="Summary &amp; notes" sheetId="1" r:id="rId1"/><x:sheet name="Secret" sheetId="2" state="hidden" r:id="rId2"/><x:sheet name="Ledger" sheetId="3" r:id="rId3"/></x:sheets></x:workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet3.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/sharedStrings.xml": `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5" uniqueCount="5"><si><t>Date</t></si><si><t>Amount</t></si><si><r><rPr><b/></rPr><t>Uni</t></r><r><t xml:space="preserve">forms </t></r><rPh sb="0" eb="1"><t>XX</t></rPh></si><si><t/></si><si><t>Line_x000D_break &amp; more</t></si></sst>`,
    "xl/styles.xml": `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="[$-409]mmmm\\ d\\,\\ yyyy;@"/><numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0.00"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Overview</t></is></c></row></sheetData></worksheet>`,
    "xl/worksheets/sheet2.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>hidden</t></is></c></row></sheetData></worksheet>`,
    "xl/worksheets/sheet3.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:E6"/><cols><col min="1" max="1" width="12"/></cols><sheetData>
      <row r="1" spans="1:5"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>
      <row r="3"><c r="A3" s="1"><v>${date1904 ? 44877 : 46339}</v></c><c r="B3" s="3"><v>125.5</v></c><c r="C3" t="b"><v>1</v></c><c r="D3" t="s"><v>4</v></c><c r="E3" s="2"/></row>
      <row r="4"><c r="A4" s="2"><v>${date1904 ? 44878 : 46340}</v></c><c r="B4"><f>B3*2</f><v>251</v></c><c r="C4" t="str"><f>"x"&amp;"y"</f><v>xy</v></c><c r="D4" t="e"><v>#REF!</v></c><c r="E4" t="s"><v>3</v></c></row>
      <row r="6"><c r="B6" t="d"><v>2026-11-15T00:00:00</v></c></row>
    </sheetData></worksheet>`,
  };
  return zipFiles(Object.entries(parts).map(([name, xml]) => ({ name, data: Buffer.from(xml, "utf8") })));
}

test("an Excel-style workbook: shared strings, date styles, formulas, sparse rows", () => {
  for (const date1904 of [false, true]) {
    const sheets = readXlsx(excelStyleBook({ date1904 }));
    assert.deepEqual(
      sheets.map((s) => s.name),
      ["Summary & notes", "Ledger"],
    );
    assert.deepEqual(sheets[1].rows, [
      ["Date", "Amount", null, "Uniforms "],
      [],
      ["2026-11-13", 125.5, true, "Line\rbreak & more", null],
      ["2026-11-14", 251, "xy", "#REF!", ""],
      [],
      [null, "2026-11-15"],
    ]);
  }
});

test("files that aren't workbooks get a message", () => {
  const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
  assert.throws(() => readXlsx(ole), (e) => e instanceof SpreadsheetError && /older Excel file/.test(e.message));
  assert.throws(() => readXlsx(Buffer.from("Date,Amount\n")), SpreadsheetError);
  assert.throws(() => readXlsx(zipFiles([{ name: "hello.txt", data: Buffer.from("hi") }])), SpreadsheetError);
  // a truncated file
  const book = writeXlsx([{ name: "A", rows: [["x"]] }]);
  assert.throws(() => readXlsx(book.subarray(0, book.length - 30)), SpreadsheetError);
});

test("a part that unzips too big is refused (zip bomb), even when the directory lies about its size", () => {
  const huge = Buffer.alloc(25 * 1024 * 1024, 0x20);
  const parts = (sheet: Buffer) => [
    { name: "_rels/.rels", data: Buffer.from(`<Relationships><Relationship Id="r" Type="x/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: Buffer.from(`<workbook><sheets><sheet name="A" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<Relationships><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`) },
    { name: "xl/worksheets/sheet1.xml", data: sheet },
  ];
  assert.equal(readXlsx(zipFiles(parts(Buffer.from("<worksheet/>"))))[0].rows.length, 0);
  const bomb = zipFiles(parts(huge));
  assert.ok(bomb.length < 200_000);
  assert.throws(() => readXlsx(bomb), SpreadsheetError);
  // the same file with the sheet's size in the directory rewritten as tiny: inflating stops at the limit
  const liar = Buffer.from(bomb);
  for (let i = liar.length - 22; i >= 0; i--) {
    if (liar.readUInt32LE(i) !== 0x02014b50) continue;
    const nameLength = liar.readUInt16LE(i + 28);
    if (liar.toString("utf8", i + 46, i + 46 + nameLength) === "xl/worksheets/sheet1.xml") liar.writeUInt32LE(100, i + 24);
  }
  assert.throws(() => readXlsx(liar), SpreadsheetError);
});

test("CSV: quotes, commas in amounts, line breaks, BOM, semicolons and tabs", () => {
  assert.deepEqual(readCsv('﻿Date,Amount,Note\r\n11/13/2026,"$1,250.00","Said ""hi""\nthen left"\n\n11/14/2026,40,'), [
    ["Date", "Amount", "Note"],
    ["11/13/2026", "$1,250.00", 'Said "hi"\nthen left'],
    [null],
    ["11/14/2026", "40", null],
  ]);
  assert.deepEqual(readCsv("Date;Amount\n13.11.2026;12,50\n"), [["Date", "Amount"], ["13.11.2026", "12,50"]]);
  assert.deepEqual(readCsv("Date\tAmount\n2026-11-13\t9\n"), [["Date", "Amount"], ["2026-11-13", "9"]]);
});
