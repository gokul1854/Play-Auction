import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { orderLots, ROLE_ORDER } from "../engine/room.js";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));

test("by role, every batter comes before any keeper, all-rounder or bowler", () => {
  const ordered = orderLots(pool, () => 0.5, "role");
  assert.equal(ordered.length, pool.length);
  const ranks = ordered.map((p) => ROLE_ORDER.indexOf(p.role));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test("by role, premium categories come first inside each role", () => {
  const ordered = orderLots(pool, () => 0.5, "role");
  const batters = ordered.filter((p) => p.role === "Batter");
  const legendIndex = batters.findIndex((p) => p.category === "Legend");
  const uncappedIndex = batters.findIndex((p) => p.category === "Uncapped");
  assert.ok(legendIndex < uncappedIndex);
});

test("by category keeps the original category order", () => {
  const ordered = orderLots(pool, () => 0.5, "category");
  const cats = ordered.map((p) => ["Legend", "Marquee", "Capped", "Uncapped"].indexOf(p.category));
  assert.deepEqual(cats, [...cats].sort((a, b) => a - b));
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

test("only the host can change the set order", () => {
  const { h, host, guest } = lobby();
  assert.equal(h.dispatch(guest, "room:order", { order: "role" }, 0).ok, false);
  assert.equal(h.dispatch(host, "room:order", { order: "role" }, 0).ok, true);
});

test("the set order must be one of the two options", () => {
  const { h, host } = lobby();
  assert.equal(h.dispatch(host, "room:order", { order: "random" }, 0).ok, false);
});

test("the set order is locked once the auction starts", () => {
  const { h, host } = lobby();
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  assert.equal(h.dispatch(host, "room:order", { order: "role" }, 0).ok, false);
});

test("the chosen order is used when the auction starts", () => {
  const { store, h, host, roomCode } = lobby();
  h.dispatch(host, "room:order", { order: "role" }, 0);
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  const room = store.get(roomCode);
  assert.equal(room.lotOrder, "role");
  assert.equal(h.snapshot(roomCode, 0).settings.lotOrder, "role");
});
