import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateMatch, ballOutcome } from "../engine/sim.js";

// Repeatable random numbers for the tests.
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
const squad = (cats, prefix) => cats.map((c, i) => ({
  name: `${prefix}${i}`, category: c, role: ["Batter", "Bowler", "All-rounder", "Keeper"][i % 4], country: "India",
}));
const mid = () => squad(["Marquee","Capped","Capped","Capped","Capped","Capped","Uncapped","Uncapped","Capped","Capped","Uncapped","Uncapped","Capped","Capped","Uncapped"], "M");
const mid2 = () => squad(["Marquee","Capped","Capped","Capped","Capped","Capped","Uncapped","Uncapped","Capped","Capped","Uncapped","Uncapped","Capped","Capped","Uncapped"], "N");

// Runs the same fixture many times and summarises it.
function profile(matches = 400) {
  const rng = seeded(2026);
  let runs = 0, wickets = 0, fours = 0, sixes = 0, innings = 0, winsA = 0;
  for (let i = 0; i < matches; i++) {
    const m = simulateMatch({ home: { code: "A", squad: mid() }, away: { code: "B", squad: mid2() }, rng });
    if (m.winner === "A") winsA++;
    for (const inn of m.innings) {
      innings++;
      runs += inn.runs; wickets += inn.wickets;
      for (const e of inn.log) { if (e.runs === 4) fours++; if (e.runs === 6) sixes++; }
    }
  }
  return { avgRuns: runs / innings, avgWickets: wickets / innings, fours: fours / innings, sixes: sixes / innings, winRateA: winsA / matches };
}

test("a T20 innings averages about 150 to 180 runs", () => {
  const p = profile();
  assert.ok(p.avgRuns > 150 && p.avgRuns < 180, `average was ${p.avgRuns.toFixed(1)}`);
});

test("a T20 innings loses about 7 to 9 wickets", () => {
  const p = profile();
  assert.ok(p.avgWickets > 6.8 && p.avgWickets < 8.6, `average was ${p.avgWickets.toFixed(2)}`);
});

test("a T20 innings has about 10 to 16 fours and 4 to 9 sixes", () => {
  const p = profile();
  assert.ok(p.fours > 10 && p.fours < 16, `fours were ${p.fours.toFixed(1)}`);
  assert.ok(p.sixes > 4 && p.sixes < 9, `sixes were ${p.sixes.toFixed(1)}`);
});

test("evenly matched teams win about half the time", () => {
  const p = profile();
  assert.ok(p.winRateA > 0.42 && p.winRateA < 0.58, `win rate was ${(p.winRateA * 100).toFixed(1)}%`);
});

test("a batter with a higher strike rate hits more boundaries", () => {
  const plain = { name: "Plain", category: "Capped", role: "Batter" };
  const fast = { name: "Fast", category: "Capped", role: "Batter", formats: { t20i: { strike_rate: 180 } } };
  const bowler = { name: "Bowl", category: "Capped", role: "Bowler" };
  const count = (bat) => {
    const rng = seeded(99);
    let b = 0;
    for (let i = 0; i < 20000; i++) {
      const o = ballOutcome(bat, bowler, rng, 10);
      if (o.runs === 4 || o.runs === 6) b++;
    }
    return b;
  };
  assert.ok(count(fast) > count(plain) * 1.2);
});

test("a bowler with a lower economy concedes fewer boundaries", () => {
  const bat = { name: "Bat", category: "Capped", role: "Batter" };
  const plainBowler = { name: "Plain", category: "Capped", role: "Bowler" };
  const thrifty = { name: "Thrifty", category: "Capped", role: "Bowler", formats: { t20i: { economy: 6.0 } } };
  const count = (b) => {
    const rng = seeded(5);
    let n = 0;
    for (let i = 0; i < 20000; i++) {
      const o = ballOutcome(bat, b, rng, 10);
      if (o.runs === 4 || o.runs === 6) n++;
    }
    return n;
  };
  assert.ok(count(thrifty) < count(plainBowler));
});

test("extras appear, wides and no-balls, at a realistic rate", () => {
  const bat = { name: "Bat", category: "Capped", role: "Batter" };
  const bowl = { name: "Bowl", category: "Capped", role: "Bowler" };
  const rng = seeded(11);
  let wides = 0, noBalls = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const o = ballOutcome(bat, bowl, rng, 10);
    if (o.wide) wides++;
    if (o.extra === "no ball") noBalls++;
  }
  assert.ok(wides / N > 0.01 && wides / N < 0.04);
  assert.ok(noBalls / N > 0.005 && noBalls / N < 0.02);
});
