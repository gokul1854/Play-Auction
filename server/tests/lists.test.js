import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuction, startAuction, placeBid, tick } from "../engine/auction.js";
import { BID_WINDOW_MS } from "../engine/timer.js";
import { publicState } from "../engine/room.js";

const p = (id, name, basePrice = 200) => ({ id, name, category: "Capped", role: "Batter", country: "India", basePrice });

test("unsold players are kept in the history after they go unsold", () => {
  const a = createAuction({ players: [p(1, "A"), p(2, "B")], teamIds: ["MI"] });
  startAuction(a, 0);
  tick(a, BID_WINDOW_MS);
  assert.deepEqual(a.unsoldHistory.map((x) => x.name), ["A"]);
});

test("a player who is later sold leaves the unsold history", () => {
  const a = createAuction({ players: [p(1, "A"), p(2, "B")], teamIds: ["MI"] });
  startAuction(a, 0);
  tick(a, BID_WINDOW_MS);                      // A unsold, B opens
  placeBid(a, "MI", 200, BID_WINDOW_MS + 100); // MI bids on B, the current lot
  tick(a, BID_WINDOW_MS * 2 + 10_000);         // B sold
  assert.equal(a.unsoldHistory.length, 1);
  assert.equal(a.unsoldHistory[0].name, "A");
});

test("second-pass unsold players are not listed twice", () => {
  const a = createAuction({ players: [p(1, "A")], teamIds: ["MI"] });
  startAuction(a, 0);
  tick(a, BID_WINDOW_MS);     // A unsold, recycled
  tick(a, BID_WINDOW_MS * 2); // A unsold again
  assert.equal(a.unsoldHistory.length, 1);
});

test("snapshot carries full sold and unsold lists", () => {
  const a = createAuction({ players: [p(1, "A"), p(2, "B")], teamIds: ["MI"] });
  startAuction(a, 0);
  tick(a, BID_WINDOW_MS);
  const snap = publicState({ code: "X", visibility: "public", mode: "mock", status: "live", hostId: "h", members: {}, claims: {}, chat: [], auction: a }, 0);
  assert.equal(snap.auction.unsold[0].name, "A");
  assert.equal(snap.auction.unsoldCount, 1);
  assert.deepEqual(snap.auction.sold, []);
});

test("every team's squad is public with names and prices", () => {
  const a = createAuction({ players: [p(1, "A"), p(2, "B")], teamIds: ["MI", "CSK"] });
  startAuction(a, 0);
  placeBid(a, "MI", 200, 100);
  tick(a, BID_WINDOW_MS);                       // A sold to MI at 2.00 Cr
  const snap = publicState({ code: "X", visibility: "public", mode: "mock", status: "live", hostId: "h", members: {}, claims: {}, chat: [], auction: a }, 0);
  const mi = snap.auction.teams.find((t) => t.id === "MI");
  const csk = snap.auction.teams.find((t) => t.id === "CSK");
  assert.deepEqual(mi.squad.map((x) => [x.name, x.price]), [["A", 200]]);
  assert.deepEqual(csk.squad, []);
});
