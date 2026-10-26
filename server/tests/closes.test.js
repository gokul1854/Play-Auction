import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuction, startAuction, placeBid, tick } from "../engine/auction.js";
import { BID_WINDOW_MS } from "../engine/timer.js";

const p = (id, name) => ({ id, name, basePrice: 25, category: "Capped", role: "Batter", country: "India" });

test("a sale is kept after the next lot opens, so the app can still show it", () => {
  const a = createAuction({ players: [p(1, "A"), p(2, "B")], teamIds: ["MI"] });
  startAuction(a, 0);
  placeBid(a, "MI", 25, 100);
  tick(a, BID_WINDOW_MS);
  assert.equal(a.lastClose.type, "sold");
  assert.equal(a.lastClose.name, "A");
  assert.equal(a.current.name, "B");
});

test("each closed lot gets a new number", () => {
  const a = createAuction({ players: [p(1, "A"), p(2, "B")], teamIds: ["MI"] });
  startAuction(a, 0);
  tick(a, BID_WINDOW_MS);
  const first = a.lastClose.id;
  tick(a, BID_WINDOW_MS * 2);
  assert.equal(a.lastClose.id, first + 1);
  assert.equal(a.lastClose.type, "unsold");
});
