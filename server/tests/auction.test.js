import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuction, startAuction, placeBid, tick, squadShortfalls } from "../engine/auction.js";
import { BID_WINDOW_MS } from "../engine/timer.js";

const player = (id, basePrice = 200) => ({ id, name: `P${id}`, basePrice });

function setup(players = [player(1), player(2)], opts = {}) {
  const state = createAuction({ players, teamIds: ["RCB", "MI"], ...opts });
  startAuction(state, 0);
  return state;
}

test("auction cannot start twice", () => {
  const state = setup();
  assert.equal(startAuction(state, 0).ok, false);
});

test("first bid must equal the base price", () => {
  const state = setup();
  assert.equal(placeBid(state, "RCB", 150, 100).ok, false);
  assert.equal(placeBid(state, "RCB", 200, 100).ok, true);
  assert.equal(state.currentBid, 200);
  assert.equal(state.leaderId, "RCB");
});

test("subsequent bids must be exactly one increment higher", () => {
  const state = setup();
  placeBid(state, "RCB", 200, 100);
  assert.equal(placeBid(state, "MI", 300, 200).ok, false);
  assert.equal(placeBid(state, "MI", 225, 200).ok, true);
});

test("the current high bidder cannot bid against themselves", () => {
  const state = setup();
  placeBid(state, "RCB", 200, 100);
  assert.equal(placeBid(state, "RCB", 225, 200).ok, false);
});

test("bids after the window closes are rejected", () => {
  const state = setup();
  assert.equal(placeBid(state, "RCB", 200, BID_WINDOW_MS).ok, false);
});

test("unknown teams cannot bid", () => {
  const state = setup();
  assert.equal(placeBid(state, "CSK", 200, 100).ok, false);
});

test("a late bid extends the timer so others get a chance to respond", () => {
  const state = setup();
  placeBid(state, "RCB", 200, 3500);
  assert.equal(state.timer.deadline, 3500 + 3000);
});

test("winning lot deducts purse and adds to squad", () => {
  const state = setup([player(1)]);
  placeBid(state, "RCB", 200, 100);
  const outcome = tick(state, BID_WINDOW_MS);
  assert.equal(outcome.type, "sold");
  assert.equal(outcome.price, 200);
  assert.equal(state.teams.RCB.purse, 12000 - 200);
  assert.equal(state.teams.RCB.squad.length, 1);
  assert.equal(state.status, "finished");
});

test("lot with no bids goes to unsold and no money changes hands", () => {
  const state = setup([player(1), player(2)]);
  const outcome = tick(state, BID_WINDOW_MS);
  assert.equal(outcome.type, "unsold");
  assert.equal(state.unsold.length, 1);
  assert.equal(state.teams.RCB.purse, 12000);
  assert.equal(state.teams.MI.purse, 12000);
});

test("unsold lots get one second pass after the main queue, then the auction ends", () => {
  const state = setup([player(1), player(2)]);
  tick(state, BID_WINDOW_MS);                       // p1 unsold, p2 opens
  tick(state, BID_WINDOW_MS * 2);                   // p2 unsold, queue empty, both recycled
  assert.equal(state.status, "live");
  assert.equal(state.current.id, 1);                // p1 back on the block
  tick(state, BID_WINDOW_MS * 3);                   // p1 unsold again, p2 opens
  assert.equal(state.current.id, 2);
  tick(state, BID_WINDOW_MS * 4);                   // p2 unsold, second pass already used
  assert.equal(state.status, "finished");
});

test("tick does nothing while the window is still open", () => {
  const state = setup([player(1)]);
  assert.equal(tick(state, 100), null);
  assert.equal(state.status, "live");
});

test("a team cannot buy past its max squad size", () => {
  const players = Array.from({ length: 30 }, (_, i) => player(i + 1, 30));
  const state = setup(players, { purse: 1_000_000 });
  let now = 0;
  for (let i = 0; i < 25; i++) {
    placeBid(state, "RCB", 30, now);
    now += BID_WINDOW_MS;
    tick(state, now);
    now += 1;
  }
  assert.equal(state.teams.RCB.squad.length, 25);
  // Player 26 is up for grabs, but RCB is full.
  assert.equal(placeBid(state, "RCB", 30, now).ok, false);
});

test("squadShortfalls reports teams below the minimum", () => {
  const state = setup([player(1)]);
  const shortfalls = squadShortfalls(state);
  assert.equal(shortfalls.length, 2);
  assert.equal(shortfalls[0].need, 15);
});
