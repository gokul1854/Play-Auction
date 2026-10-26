import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBid, canAfford, reservedPurse, toUnits, formatCr, DEFAULT_PURSE, MAX_SQUAD, MIN_BASE_PRICE } from "../engine/purse.js";

test("opening bid is the base price", () => {
  assert.equal(nextBid(null, 200), 200);
});

test("each bid steps up by 0.25 Cr", () => {
  assert.equal(nextBid(300, 200), 325);
  assert.equal(nextBid(325, 200), 350);
});

test("toUnits and formatCr round-trip without float drift", () => {
  assert.equal(toUnits(3.25), 325);
  assert.equal(toUnits(0.1 + 0.2), 30);
  assert.equal(formatCr(325), "3.25 Cr");
  assert.equal(formatCr(DEFAULT_PURSE), "120.00 Cr");
});

test("reserve shrinks as the squad fills and hits zero at MIN_SQUAD", () => {
  assert.equal(reservedPurse(0), 14 * MIN_BASE_PRICE);
  assert.equal(reservedPurse(14), 0);
  assert.equal(reservedPurse(20), 0);
});

test("cannot spend so much that the minimum squad becomes unreachable", () => {
  const team = { purse: DEFAULT_PURSE, squad: [] };
  const result = canAfford(team, DEFAULT_PURSE);
  assert.equal(result.ok, false);
  assert.match(result.reason, /minimum squad/);
});

test("can spend when enough purse remains for the rest of the squad", () => {
  const team = { purse: 5000, squad: [] };
  assert.equal(canAfford(team, 4000).ok, true);
});

test("full squad blocks further purchases", () => {
  const squad = Array.from({ length: MAX_SQUAD }, (_, i) => ({ id: i }));
  const team = { purse: DEFAULT_PURSE, squad };
  assert.equal(canAfford(team, 30).ok, false);
});
