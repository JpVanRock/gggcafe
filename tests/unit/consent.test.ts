// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn, consentFormPath, consentStep } from "../../src/lib/consent.ts";
import { CONSENT_NOTICE, CONSENT_STATEMENT, LEGAL, PRIVACY_URL } from "../../src/lib/legal.ts";

const uid = "0f8fad5b-d9cb-469f-a165-70867728950e";

test("a signed form goes into the parent's own folder, in a shape the database accepts", () => {
  const shape = /^[0-9a-f-]{36}\/[0-9]{10,16}\.(jpg|png|webp|pdf)$/; // parental_consents.form_path and the storage policy
  for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
    const path = consentFormPath(uid, 1762900000000, type);
    assert.ok(path && shape.test(path) && path.startsWith(`${uid}/`), type);
  }
  assert.equal(consentFormPath(uid, 1762900000000, "image/heic"), null, "a phone's HEIC is shrunk to JPEG first");
});

test("what the family page shows for each daughter", () => {
  assert.equal(consentStep(undefined), "birth-date");
  assert.equal(consentStep({ birth_date: null, under_13: false, status: null }), "birth-date", "her age has to be known");
  assert.equal(consentStep({ birth_date: "2010-04-02", under_13: false, status: null }), "not-needed");
  assert.equal(consentStep({ birth_date: "2015-04-02", under_13: true, status: null }), "needed");
  assert.equal(consentStep({ birth_date: "2015-04-02", under_13: true, status: "declined" }), "needed", "send it again");
  assert.equal(consentStep({ birth_date: "2015-04-02", under_13: true, status: "withdrawn" }), "needed");
  assert.equal(consentStep({ birth_date: "2015-04-02", under_13: true, status: "pending" }), "pending");
  assert.equal(consentStep({ birth_date: "2015-04-02", under_13: true, status: "verified" }), "verified");
});

test("age in whole years", () => {
  assert.equal(ageOn("2014-11-12", "2026-11-11"), 11);
  assert.equal(ageOn("2014-11-11", "2026-11-11"), 12);
  assert.equal(ageOn("2013-11-11", "2026-11-11"), 13);
});

test("the consent notice covers what COPPA's direct notice asks for", () => {
  const notice = JSON.stringify(CONSENT_NOTICE);
  assert.match(notice, /Children's Online Privacy Protection Act/);
  assert.match(notice, new RegExp(LEGAL.owner));
  assert.match(notice, /won't collect information from her/, "nothing is collected without consent");
  assert.match(notice, /What she adds/, "the information collected");
  assert.match(notice, /Your rights/);
  assert.match(notice, /video call/);
  assert.ok(notice.includes(PRIVACY_URL), "a link to the full notice");
  assert.match(CONSENT_STATEMENT, /withdraw this consent at any time/);
});
