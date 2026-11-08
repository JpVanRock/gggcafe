// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { FAQ, FEATURE_SECTIONS, TIERS } from "../../src/lib/access-faq.ts";

test("two tiers, every feature marked for both", () => {
  assert.deepEqual(TIERS.map((t) => t.key), ["standard", "advanced"]);
  const names = FEATURE_SECTIONS.flatMap((s) => s.features.map((f) => f.name));
  assert.equal(new Set(names).size, names.length, "unique feature names");
  for (const f of FEATURE_SECTIONS.flatMap((s) => s.features)) {
    assert.ok(["yes", "no", "coach"].includes(f.standard) && ["yes", "no", "coach"].includes(f.advanced), f.name);
    // Advanced never has less than Standard
    assert.ok(!(f.standard !== "no" && f.advanced === "no"), `${f.name}: Advanced includes everything Standard does`);
    // a coach's OK always says what it takes
    if (f.standard === "coach" || f.advanced === "coach") assert.ok(f.condition, `${f.name}: condition`);
  }
});

test("G3 Advanced features are Advanced only", () => {
  const g3 = FEATURE_SECTIONS.find((s) => s.title === "G3 Advanced")!;
  assert.ok(g3.features.length >= 4);
  for (const f of g3.features) assert.equal(f.standard, "no", f.name);
});

test("every question has an answer", () => {
  assert.ok(FAQ.length >= 8);
  for (const item of FAQ) assert.ok(item.q.endsWith("?") && item.a.length > 0, item.q);
});
