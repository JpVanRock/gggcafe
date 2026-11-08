// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCaption, monthSpreads, photoPaths, photosOf, tagCounts, tileSize, type YearbookPhoto } from "../../src/lib/yearbook.ts";

const photo = (id: string, day: string, tags: string[] = [], taken = true): YearbookPhoto => ({
  id, path: "", thumb_path: "", width: null, height: null, caption: null,
  taken_on: taken ? day : null, created_at: `${day}T12:00:00Z`, uploader_name: "Coach", mine: false,
  tags: tags.map((t) => ({ player_id: t, name: t })),
});

test("spreads: one per month, newest first", () => {
  const spreads = monthSpreads([photo("a", "2026-09-05"), photo("b", "2026-11-02"), photo("c", "2026-09-20"), photo("d", "2026-11-01", [], false)]);
  assert.deepEqual(spreads.map((s) => `${s.month} ${s.year}:${s.photos.map((p) => p.id).join("")}`), ["November 2026:bd", "September 2026:ca"]);
});

test("layout: a feature photo first, then a rhythm of sizes", () => {
  assert.equal(tileSize(0, 5), "feature");
  assert.equal(tileSize(0, 2), "regular");
  assert.equal(tileSize(3, 9), "wide");
  assert.equal(tileSize(5, 9), "tall");
  assert.equal(tileSize(1, 9), "regular");
});

test("search by player, and how many photos each is in", () => {
  const photos = [photo("a", "2026-09-05", ["avery", "jordan"]), photo("b", "2026-09-06", ["avery"]), photo("c", "2026-09-07")];
  assert.deepEqual(photosOf(photos, "avery").map((p) => p.id), ["a", "b"]);
  assert.equal(photosOf(photos, null).length, 3);
  assert.equal(tagCounts(photos).get("avery"), 2);
  assert.equal(tagCounts(photos).get("jordan"), 1);
});

test("storage paths match the database's pattern", () => {
  const t = "00000000-0000-0000-0000-0000000000b1";
  const s = "00000000-0000-0000-0000-0000000000a1";
  const p = photoPaths(t, s, 1762600000000, "Ab3!");
  assert.equal(p.path, `${t}/${s}/1762600000000-ab30.jpg`);
  assert.equal(p.thumb_path, `${t}/${s}/1762600000000-ab30_t.jpg`);
  assert.match(p.path, /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]{10,16}-[a-z0-9]{4,12}\.jpg$/);
  assert.equal(cleanCaption("  Senior night  "), "Senior night");
  assert.equal(cleanCaption("   "), null);
});
