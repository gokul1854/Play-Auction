import { test } from "node:test";
import assert from "node:assert/strict";
import { startTimer, extendOnBid, isExpired, remainingMs, BID_WINDOW_MS, ANTI_SNIPE_MS } from "../engine/timer.js";

test("timer runs for the bid window", () => {
  const t = startTimer(1000);
  assert.equal(t.deadline, 1000 + BID_WINDOW_MS);
  assert.equal(isExpired(t, 1000 + BID_WINDOW_MS - 1), false);
  assert.equal(isExpired(t, 1000 + BID_WINDOW_MS), true);
});

test("a late bid guarantees the anti-snipe window", () => {
  const t = startTimer(0);
  const extended = extendOnBid(t, 3900);
  assert.equal(extended.deadline, 3900 + ANTI_SNIPE_MS);
});

test("an early bid never shortens the timer", () => {
  const t = startTimer(0);
  const extended = extendOnBid(t, 100);
  assert.equal(extended.deadline, BID_WINDOW_MS);
});

test("remainingMs never goes negative", () => {
  const t = startTimer(0);
  assert.equal(remainingMs(t, 10_000), 0);
  assert.equal(remainingMs(t, 1000), BID_WINDOW_MS - 1000);
});
