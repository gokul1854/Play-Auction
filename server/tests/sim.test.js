import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateMatch, pickXI, pickBowlers, playInnings, rating } from "../engine/sim.js";

// Small seeded random generator so tests are repeatable.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const squad = (cats, prefix) =>
  cats.map((category, i) => ({
    name: `${prefix}${i}`, category,
    role: ["Batter", "Bowler", "All-rounder", "Keeper"][i % 4], country: "India",
  }));

const strong = () => squad(["Legend", "Legend", "Marquee", "Marquee", "Marquee", "Capped", "Capped", "Capped", "Capped", "Capped", "Capped", "Capped", "Capped", "Capped"], "S");
const weak = () => squad(["Uncapped", "Uncapped", "Uncapped", "Uncapped", "Uncapped", "Uncapped", "Uncapped", "Uncapped", "Uncapped", "Uncapped", "Uncapped"], "W");

test("ratings follow the auction category", () => {
  assert.ok(rating({ category: "Legend" }) > rating({ category: "Marquee" }));
  assert.ok(rating({ category: "Marquee" }) > rating({ category: "Uncapped" }));
  assert.equal(rating({ replacement: true }), 50);
});

test("an XI always has 11 players, padded with replacements if needed", () => {
  assert.equal(pickXI(strong()).length, 11);
  const short = pickXI([{ name: "Only", category: "Legend", role: "Batter" }]);
  assert.equal(short.length, 11);
  assert.equal(short.filter((p) => p.replacement).length, 10);
});

test("five bowlers are picked, keepers only when needed", () => {
  const bowlers = pickBowlers(pickXI(strong()));
  assert.equal(bowlers.length, 5);
  assert.ok(bowlers.every((b) => b.role !== "Keeper"));
});

test("an innings never exceeds 20 overs or 10 wickets", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const xi = pickXI(strong());
    const inn = playInnings({ batting: xi, bowlers: pickBowlers(pickXI(weak())), rng: seeded(seed) });
    assert.ok(inn.legal <= 120);
    assert.ok(inn.wickets <= 10);
    assert.ok(inn.bowlers.every((b) => b.balls <= 24), "no bowler over 4 overs");
  }
});

test("the same seed gives the same match", () => {
  const a = simulateMatch({ home: { code: "MI", squad: strong() }, away: { code: "CSK", squad: weak() }, rng: seeded(42) });
  const b = simulateMatch({ home: { code: "MI", squad: strong() }, away: { code: "CSK", squad: weak() }, rng: seeded(42) });
  assert.deepEqual(a.innings.map((i) => i.runs), b.innings.map((i) => i.runs));
  assert.equal(a.text, b.text);
});

test("a match has two innings, a winner or a tie, and a readable result", () => {
  const m = simulateMatch({ home: { code: "MI", squad: strong() }, away: { code: "CSK", squad: weak() }, rng: seeded(7) });
  assert.equal(m.innings.length, 2);
  assert.match(m.text, /won by|tied/);
  if (m.winner) assert.ok(["MI", "CSK"].includes(m.winner));
});

test("stronger squads win more often over many matches", () => {
  let strongWins = 0;
  const games = 300;
  for (let seed = 1; seed <= games; seed++) {
    const m = simulateMatch({ home: { code: "A", squad: strong() }, away: { code: "B", squad: weak() }, rng: seeded(seed * 97) });
    if (m.winner === "A") strongWins++;
  }
  assert.ok(strongWins / games > 0.6, `strong side won only ${strongWins}/${games}`);
});

test("scores land in a believable T20 range on average", () => {
  let total = 0;
  const games = 200;
  for (let seed = 1; seed <= games; seed++) {
    const m = simulateMatch({ home: { code: "A", squad: strong() }, away: { code: "B", squad: strong() }, rng: seeded(seed * 31) });
    total += m.innings[0].runs;
  }
  const avg = total / games;
  assert.ok(avg > 100 && avg < 210, `average first innings was ${avg.toFixed(0)}`);
});
