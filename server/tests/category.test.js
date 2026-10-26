import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { orderByCategory, CATEGORY_ORDER } from "../engine/room.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));

test("the real player list has every category", () => {
  for (const cat of CATEGORY_ORDER) {
    assert.ok(pool.some((p) => p.category === cat), `no ${cat} players`);
  }
});

test("auction order runs Legend, Marquee, Capped, then Uncapped", () => {
  const ordered = orderByCategory(pool, () => 0.5);
  assert.equal(ordered.length, pool.length);
  const ranks = ordered.map((p) => CATEGORY_ORDER.indexOf(p.category));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test("ordering does not drop or duplicate players", () => {
  const ordered = orderByCategory(pool);
  assert.equal(new Set(ordered.map((p) => p.id)).size, pool.length);
});

test("every player belongs to a known pool", () => {
  const pools = new Set(["IPL", "International", "Test", "Legends"]);
  for (const p of pool) assert.ok(pools.has(p.pool), `${p.name} has pool ${p.pool}`);
});

test("every pool has at least one player", () => {
  for (const name of ["IPL", "International", "Test", "Legends"]) {
    assert.ok(pool.some((p) => p.pool === name), `no ${name} players`);
  }
});

test("every player has a base price matching their category", () => {
  const tiers = { Legend: 150, Marquee: 100, Capped: 50, Uncapped: 25 };
  for (const p of pool) assert.equal(p.basePrice, tiers[p.category], p.name);
});
