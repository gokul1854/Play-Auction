import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuction, startAuction, placeBid, isOverseas, overseasCount } from "../engine/auction.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));
const p = (id, name, country) => ({ id, name, country, basePrice: 25, category: "Capped", role: "Batter" });

test("a player is overseas when they do not play for India", () => {
  assert.equal(isOverseas({ country: "Australia" }), true);
  assert.equal(isOverseas({ country: "India" }), false);
});

test("a squad cannot buy past the overseas limit", () => {
  const players = [p(1, "A", "Australia"), p(2, "B", "England"), p(3, "C", "South Africa")];
  const a = createAuction({ players, teamIds: ["MI"], overseasLimit: 2, purse: 100000 });
  startAuction(a, 0);
  a.teams.MI.squad.push(p(9, "X", "New Zealand"), p(10, "Y", "West Indies"));
  assert.equal(overseasCount(a.teams.MI), 2);
  const r = placeBid(a, "MI", 25, 1);
  assert.equal(r.ok, false);
  assert.match(r.reason, /overseas limit/);
});

test("an Indian player is not blocked by the overseas limit", () => {
  const a = createAuction({ players: [p(1, "Indian", "India")], teamIds: ["MI"], overseasLimit: 0, purse: 100000 });
  startAuction(a, 0);
  assert.equal(placeBid(a, "MI", 25, 0).ok, true);
});

test("with no limit, overseas players can be bought freely", () => {
  const a = createAuction({ players: [p(1, "A", "Australia")], teamIds: ["MI"], overseasLimit: null, purse: 100000 });
  startAuction(a, 0);
  assert.equal(placeBid(a, "MI", 25, 0).ok, true);
});

function lobby() {
  const store = createRoomStore();
  const h = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  const guest = { playerId: "guest", roomCode: null };
  const { roomCode } = h.dispatch(host, "room:create", { name: "Gokul" }, 0);
  h.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  return { store, h, host, guest, roomCode };
}

test("the room defaults to 8 overseas per squad, and the host can change it", () => {
  const { h, host, roomCode } = lobby();
  assert.equal(h.snapshot(roomCode, 0).settings.overseasLimit, 8);
  assert.equal(h.dispatch(host, "room:overseas", { limit: 4 }, 0).ok, true);
  assert.equal(h.snapshot(roomCode, 0).settings.overseasLimit, 4);
  assert.equal(h.dispatch(host, "room:overseas", { limit: null }, 0).ok, true);
});

test("only the host can change the overseas limit, and only listed values are accepted", () => {
  const { h, host, guest } = lobby();
  assert.equal(h.dispatch(guest, "room:overseas", { limit: 4 }, 0).ok, false);
  assert.equal(h.dispatch(host, "room:overseas", { limit: 5 }, 0).ok, false);
});

test("the limit can change during the auction and reaches the live auction", () => {
  const { store, h, host, roomCode } = lobby();
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  assert.equal(h.dispatch(host, "room:overseas", { limit: 6 }, 0).ok, true);
  assert.equal(store.get(roomCode).auction.overseasLimit, 6);
});
