// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AGREEMENT_LABEL,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  TERMS_INTRO,
  TERMS_NOTICE,
  TERMS_SECTIONS,
  TERMS_SUMMARY,
  TERMS_VERSION,
  needsTermsAgreement,
  safeNext,
} from "../../src/lib/legal.ts";

test("signed-in page loads ask for the agreement until the current version is agreed", () => {
  assert.equal(needsTermsAgreement("/dashboard", "GET", undefined), true);
  assert.equal(needsTermsAgreement("/players/abc/training", "GET", "2020-01-01"), true, "an older version asks again");
  assert.equal(needsTermsAgreement("/dashboard", "GET", TERMS_VERSION), false);
  assert.equal(needsTermsAgreement("/dashboard", "POST", undefined), false, "a save in flight isn't interrupted");
});

test("the documents, sign-in help and the home page stay open", () => {
  for (const path of ["/", "/terms", "/terms/accept", "/privacy", "/login", "/register", "/forgot-password", "/reset-password", "/auth/confirm", "/manifest.webmanifest"]) {
    assert.equal(needsTermsAgreement(path, "GET", undefined), false, path);
  }
  assert.equal(needsTermsAgreement("/termsx", "GET", undefined), true, "only the exact paths");
});

test("after agreeing, only a path on this site", () => {
  assert.equal(safeNext("/me?team=1"), "/me?team=1");
  for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "", undefined, null, 7]) assert.equal(safeNext(bad), "/dashboard", String(bad));
});

test("the section numbers the notes and the intro point to", () => {
  const n = (id: string) => TERMS_SECTIONS.findIndex((s) => s.id === id) + 1;
  // SafetyNote says "Terms, section 4" (#risk); RewardsNote "Terms, section 7" (#rewards)
  assert.equal(n("risk"), 4);
  assert.equal(n("rewards"), 7);
  const intro = TERMS_INTRO.join(" ");
  assert.match(intro, new RegExp(`assumption of risk and a release of claims \\(section ${n("risk")}\\)`));
  assert.match(intro, new RegExp(`disclaimer of warranties \\(section ${n("warranties")}\\)`));
  assert.match(intro, new RegExp(`limits on our liability \\(section ${n("liability")}\\)`));
  assert.match(intro, new RegExp(`an indemnity \\(section ${n("indemnity")}\\)`));
  assert.match(intro, new RegExp(`binding arbitration agreement with a waiver of class actions and jury trials \\(section ${n("disputes")}\\)`));
  assert.match(TERMS_NOTICE, new RegExp(`SECTION ${n("disputes")} REQUIRES`));
  assert.match(TERMS_NOTICE, new RegExp(`FOLLOWING SECTION ${n("disputes")}\\.`));
  assert.match(TERMS_SUMMARY.join(" "), new RegExp(`\\(section ${n("disputes")}\\)`));
  const risk = JSON.stringify(TERMS_SECTIONS.find((s) => s.id === "risk"));
  assert.match(risk, new RegExp(`the indemnity in section ${n("indemnity")} `));
  const legal = readFileSync(new URL("../../src/components/legal.tsx", import.meta.url), "utf8");
  assert.match(legal, /\/terms#risk[\s\S]{0,80}Terms, section 4/);
  assert.match(legal, /\/terms#rewards[\s\S]{0,80}Terms, section 7/);
});

test("section ids are unique anchors", () => {
  for (const doc of [TERMS_SECTIONS, PRIVACY_SECTIONS]) {
    const ids = doc.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("no placeholders left in the documents", () => {
  const text = JSON.stringify([TERMS_INTRO, TERMS_SECTIONS, PRIVACY_INTRO, PRIVACY_SECTIONS]);
  assert.doesNotMatch(text, /\[[A-Z][A-Z ]+\]/, "a [BRACKETED] blank is still in the text");
  assert.match(text, /GMI Digital LLC/);
});

test("the protections an audit asked for are in the documents (2026-11-11)", () => {
  const terms = (id: string) => JSON.stringify(TERMS_SECTIONS.find((s) => s.id === id) ?? null);
  const privacy = (id: string) => JSON.stringify(PRIVACY_SECTIONS.find((s) => s.id === id) ?? null);
  const disputes = terms("disputes");
  assert.match(disputes, /Federal Arbitration Act/);
  assert.match(disputes, /Consumer Arbitration Rules/);
  assert.match(disputes, /within 30 days after you first agree/, "an opt-out window");
  assert.match(disputes, /small-claims court/);
  assert.match(disputes, /25 or more/, "mass filings are batched");
  assert.match(disputes, /CLASS ACTION AND JURY TRIAL WAIVER/);
  assert.match(terms("law"), /WAIVE A JURY TRIAL/);
  assert.match(terms("changes-terms"), /reject that change/, "a later arbitration change can be rejected");
  assert.match(terms("copyright"), /penalty of perjury/);
  assert.match(terms("copyright"), /repeatedly infringe/);
  assert.match(terms("fees"), /renew automatically/);
  assert.match(terms("fees"), /non-refundable/);
  assert.match(terms("communications"), /electronically/);
  assert.match(terms("rules"), /National Center for Missing & Exploited Children/);
  assert.match(terms("general"), /reasonable control/, "force majeure");
  assert.match(AGREEMENT_LABEL, /arbitration/);
  for (const id of ["sources", "sharing", "cookies", "children", "retention", "international"]) assert.notEqual(privacy(id), "null", id);
  assert.match(privacy("children"), /COPPA/);
  assert.match(privacy("retention"), /within 30 days after a parent asks/, "a written retention period for children's information");
  assert.match(privacy("cookies"), /Global Privacy Control/);
  assert.match(privacy("sharing"), /don't sell personal information/);
  assert.match(privacy("rights"), /appeal/);
});

test("the version is a date (the database checks the same shape)", () => {
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("Coach's Responsibilities: the user's sixteen, three in bold", async () => {
  const { COACH_RESPONSIBILITIES, COACH_RESPONSIBILITIES_MOTTO } = await import("../../src/lib/coach-responsibilities.ts");
  assert.equal(COACH_RESPONSIBILITIES.length, 16);
  assert.deepEqual(COACH_RESPONSIBILITIES.flatMap((r, i) => (r.key ? [i + 1] : [])), [3, 7, 14]);
  assert.equal(COACH_RESPONSIBILITIES_MOTTO, "Teaching Creates Understanding");
  const { COACHING_ETIQUETTE, COACHING_ETIQUETTE_MOTTO } = await import("../../src/lib/coach-responsibilities.ts");
  assert.equal(COACHING_ETIQUETTE.length, 4);
  assert.equal(COACHING_ETIQUETTE_MOTTO, "Creating a Habit of Excellence");
  assert.ok(!JSON.stringify(COACHING_ETIQUETTE).includes("11 Strong"));
});
