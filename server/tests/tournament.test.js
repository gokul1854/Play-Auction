import { test } from "node:test";
import assert from "node:assert/strict";
import { roundRobin, runTournament, sortTable, decideWinner, netRunRate, blankRow, POINTS, normaliseTournamentFormat } from "../engine/tournament.js";
import { validatePlayingXI } from "../engine/sim.js";

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

const CODES = ["MI", "CSK", "RCB", "KKR", "DC", "PBKS", "RR", "SRH", "GT", "LSG"];
const squad = (cat, prefix) => Array.from({ length: 15 }, (_, i) => ({
  name: `${prefix}${i}`, category: cat, role: ["Batter", "Bowler", "All-rounder", "Keeper"][i % 4], country: "India",
}));
const teams = (codes = CODES) => codes.map((code, i) => ({ code, squad: squad(["Legend", "Marquee", "Capped", "Uncapped"][i % 4], code) }));

test("round robin pairs every team with every other once", () => {
  assert.equal(roundRobin(CODES).length, 45);
  assert.equal(roundRobin(["A", "B", "C", "D"]).length, 6);
  const pairs = roundRobin(CODES).map((p) => p.sort().join("-"));
  assert.equal(new Set(pairs).size, pairs.length);
});

test("a 10-team tournament plays 45 league matches, then four playoff matches", () => {
  const t = runTournament({ teams: teams(), rng: seeded(1) });
  assert.equal(t.league.length, 45);
  assert.equal(t.playoffs.length, 4);
  assert.deepEqual(t.playoffs.map((m) => m.stage), ["qualifier 1", "eliminator", "qualifier 2", "final"]);
});

test("every team plays nine league matches", () => {
  const t = runTournament({ teams: teams(), rng: seeded(2) });
  assert.ok(t.table.every((r) => r.played === 9));
});

test("points add up: every match gives out exactly two points", () => {
  const t = runTournament({ teams: teams(), rng: seeded(3) });
  const total = t.table.reduce((s, r) => s + r.points, 0);
  assert.equal(total, 2 * t.league.length);
});

test("the table is sorted by points", () => {
  const t = runTournament({ teams: teams(), rng: seeded(4) });
  const pts = t.table.map((r) => r.points);
  assert.deepEqual(pts, [...pts].sort((a, b) => b - a));
  assert.deepEqual(t.table.map((r) => r.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("the champion is one of the teams and wins the final", () => {
  const t = runTournament({ teams: teams(), rng: seeded(5) });
  assert.ok(CODES.includes(t.champion));
  const final = t.playoffs.at(-1);
  assert.equal(final.stage, "final");
  assert.equal(decideWinner(final, t.table), t.champion);
});

test("the playoffs use the top four in league order", () => {
  const t = runTournament({ teams: teams(), rng: seeded(6) });
  const [top1, top2, top3, top4] = t.table.map((r) => r.code);
  assert.deepEqual([t.playoffs[0].home, t.playoffs[0].away], [top1, top2]);
  assert.deepEqual([t.playoffs[1].home, t.playoffs[1].away], [top3, top4]);
});

test("with two teams there is one league match and a final", () => {
  const t = runTournament({ teams: teams(["MI", "CSK"]), rng: seeded(7) });
  assert.equal(t.league.length, 1);
  assert.equal(t.playoffs.length, 1);
  assert.equal(t.playoffs[0].stage, "final");
  assert.ok(t.champion === "MI" || t.champion === "CSK");
});

test("a single team cannot hold a tournament", () => {
  assert.ok(runTournament({ teams: teams(["MI"]), rng: seeded(8) }).error);
});

test("the same seed gives the same tournament", () => {
  const a = runTournament({ teams: teams(), rng: seeded(99) });
  const b = runTournament({ teams: teams(), rng: seeded(99) });
  assert.equal(a.champion, b.champion);
  assert.deepEqual(a.table.map((r) => r.code), b.table.map((r) => r.code));
});

test("a tie in a playoff goes to the team placed higher in the table", () => {
  const table = [{ code: "MI" }, { code: "CSK" }];
  assert.equal(decideWinner({ home: "CSK", away: "MI", winner: null }, table), "MI");
  assert.equal(decideWinner({ home: "CSK", away: "MI", winner: "CSK" }, table), "CSK");
});

test("net run rate uses runs and balls on both sides", () => {
  const row = { ...blankRow("X"), runsFor: 120, ballsFor: 120, runsAgainst: 100, ballsAgainst: 120 };
  assert.equal(Number(netRunRate(row).toFixed(2)), 1); // 6.00 per over scored minus 5.00 per over conceded
});

test("sortTable puts points first, then net run rate", () => {
  const rows = {
    A: { ...blankRow("A"), points: 4, runsFor: 100, ballsFor: 120, runsAgainst: 100, ballsAgainst: 120 },
    B: { ...blankRow("B"), points: 4, runsFor: 150, ballsFor: 120, runsAgainst: 100, ballsAgainst: 120 },
    C: { ...blankRow("C"), points: 6 },
  };
  assert.deepEqual(sortTable(rows).map((r) => r.code), ["C", "B", "A"]);
  assert.equal(POINTS.win, 2);
});

test("knockout format accepts the four-team bracket described in the rules", () => {
  const t = runTournament({ teams: teams(["MI", "CSK", "RCB", "KKR"]), rng: seeded(11), format: "knockout" });
  assert.equal(t.format, "knockout");
  assert.equal(t.playoffs.length, 4);
  assert.ok(["MI", "CSK", "RCB", "KKR"].includes(t.champion));
  assert.deepEqual(t.playoffs.map((m) => m.stage).slice(0, 2), ["match 1", "match 2"]);
});

test("playing XIs must be valid before a tournament is allowed", () => {
  const valid = Array.from({ length: 11 }, (_, i) => ({ id: i, name: `P${i}`, role: "Batter", category: "Capped", country: "India" }));
  const invalid = [...valid];
  invalid[0] = invalid[1];
  assert.equal(validatePlayingXI(valid).ok, true);
  assert.equal(validatePlayingXI(invalid).ok, false);
  assert.match(validatePlayingXI([valid[0]]).error, /need 11 players/);
});
