import { test } from "node:test";
import assert from "node:assert/strict";
import { MODES, poolFor, normaliseMode, DEFAULT_BID_WINDOW } from "../engine/modes.js";
import { createAuction, startAuction, tick, placeBid } from "../engine/auction.js";
import { BID_WINDOW_MS } from "../engine/timer.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));

test("full mode uses every player, IPL mode only IPL, legends only Legends", () => {
  assert.equal(poolFor("full", pool).length, pool.length);
  assert.ok(poolFor("ipl", pool).every((p) => p.pool === "IPL"));
  assert.ok(poolFor("legends", pool).every((p) => p.category === "Legend"));
  assert.ok(poolFor("legends", pool).length > 0);
});

test("an unknown mode falls back to the full auction", () => {
  assert.equal(normaliseMode("nonsense"), "full");
  assert.equal(normaliseMode(undefined), "full");
  assert.ok(Object.keys(MODES).length === 3);
});

test("the auction timer follows the room's bid window", () => {
  const a = createAuction({ players: [{ id: 1, name: "A", basePrice: 25, category: "Capped" }], teamIds: ["MI"], bidWindowMs: 5000 });
  startAuction(a, 0);
  assert.equal(a.timer.deadline, 5000);
  assert.equal(tick(a, 4999), null);
  assert.ok(tick(a, 5000));
});

test("the default bid window is 10 seconds and the auction default is unchanged", () => {
  assert.equal(DEFAULT_BID_WINDOW, 10000);
  assert.equal(BID_WINDOW_MS, 4000);
});

function lobby() {
  const store = createRoomStore();
  const h = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  const guest = { playerId: "guest", roomCode: null };
  const { roomCode } = h.dispatch(host, "room:create", { name: "Gokul", mode: "ipl" }, 0);
  h.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  return { store, h, host, guest, roomCode };
}

test("the host can set the bid timer in the lobby, to an allowed value only", () => {
  const { h, host, roomCode } = lobby();
  assert.equal(h.dispatch(host, "room:settings", { bidWindowMs: 15000 }, 0).ok, true);
  assert.equal(h.dispatch(host, "room:settings", { bidWindowMs: 7000 }, 0).ok, false);
  assert.equal(h.snapshot(roomCode, 0).settings.bidWindowMs, 15000);
});

test("only the host can change settings", () => {
  const { h, guest } = lobby();
  assert.equal(h.dispatch(guest, "room:settings", { bidWindowMs: 5000 }, 0).ok, false);
});

test("the bid timer can change during the auction and applies from the next lot", () => {
  const { h, host, store, roomCode } = lobby();
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  const room = store.get(roomCode);
  const onBlock = room.auction.timer.deadline;
  assert.equal(h.dispatch(host, "room:settings", { bidWindowMs: 5000 }, 0).ok, true);
  assert.equal(room.auction.bidWindowMs, 5000);
  assert.equal(room.auction.timer.deadline, onBlock);
});

test("the room's mode decides who is auctioned", () => {
  const { store, h, host, roomCode } = lobby();
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  const room = store.get(roomCode);
  assert.equal(room.mode, "ipl");
  const names = [room.auction.current, ...room.auction.queue].map((p) => p.pool);
  assert.ok(names.every((p) => p === "IPL"));
});

test("the snapshot includes upcoming players for the Stats tab", () => {
  const { h, host, roomCode } = lobby();
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  const snap = h.snapshot(roomCode, 0);
  assert.ok(Array.isArray(snap.auction.upcoming));
  assert.ok(snap.auction.upcoming.length > 0);
  assert.equal(snap.auction.windowMs, 10000);
});

test("the auction speed divides the bid timer", () => {
  const { h, host, roomCode, store } = lobby();
  assert.equal(h.dispatch(host, "room:speed", { speed: 5 }, 0).ok, true);
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  const room = store.get(roomCode);
  assert.equal(room.auction.speed, 5);
  assert.equal(room.auction.bidWindowMs, 2000);
  assert.equal(h.snapshot(roomCode, 0).settings.speed, 5);
  assert.equal(h.snapshot(roomCode, 0).auction.windowMs, 2000);
});

test("speed only accepts the offered values and only from the host", () => {
  const { h, host, guest } = lobby();
  assert.equal(h.dispatch(host, "room:speed", { speed: 2 }, 0).ok, false);
  assert.equal(h.dispatch(guest, "room:speed", { speed: 3 }, 0).ok, false);
  assert.equal(h.dispatch(host, "room:speed", { speed: 10 }, 0).ok, true);
});

test("speed can change during the auction, and the guest still cannot change it", () => {
  const { h, host, guest } = lobby();
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  assert.equal(h.dispatch(guest, "room:speed", { speed: 3 }, 0).ok, false);
  assert.equal(h.dispatch(host, "room:speed", { speed: 3 }, 0).ok, true);
});

test("a bid near the end of the window is extended by the scaled anti-snipe time", () => {
  const a = createAuction({ players: [{ id: 1, name: "A", basePrice: 25, category: "Capped" }], teamIds: ["MI"], bidWindowMs: 1000, speed: 10 });
  startAuction(a, 0);
  placeBid(a, "MI", 25, 900);
  assert.equal(a.timer.deadline, 900 + 300);
});
