// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRich, plainText, wrapSelection } from "../../src/lib/rich-text.ts";

test("bold, underline and italic, nested, with stray markers left as text", () => {
  assert.deepEqual(parseRich("We **compete** every __pitch__."), ["We ", { mark: "bold", children: ["compete"] }, " every ", { mark: "underline", children: ["pitch"] }, "."]);
  assert.deepEqual(parseRich("*one* team"), [{ mark: "italic", children: ["one"] }, " team"]);
  assert.deepEqual(parseRich("**__both__**"), [{ mark: "bold", children: [{ mark: "underline", children: ["both"] }] }]);
  assert.deepEqual(parseRich("2 * 3 and a lone ** star"), ["2 * 3 and a lone ** star"]);
  assert.equal(plainText("We **compete** every __pitch__"), "We compete every pitch");
  // nothing typed becomes markup
  assert.deepEqual(parseRich("<b>hi</b>"), ["<b>hi</b>"]);
});

test("the toolbar wraps the selection, and a second tap unwraps it", () => {
  const on = wrapSelection("We compete", 3, 10, "bold");
  assert.deepEqual(on, { text: "We **compete**", start: 5, end: 12 });
  assert.deepEqual(wrapSelection(on.text, on.start, on.end, "bold"), { text: "We compete", start: 3, end: 10 });
  assert.equal(wrapSelection("go", 2, 2, "underline").text, "go____");
  assert.equal(wrapSelection("We compete now", 3, 11, "italic").text, "We *compete* now", "the space after the word stays outside");
});
