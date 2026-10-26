import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuction, startAuction, tick, placeBid, pauseAuction, resumeAuction } from "../engine/auction.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));
const p = (id, name) => ({ id, name, basePrice: 25, category: "Capped", role: "Batter", country: "India" });

test("pausing keeps the time left on the lot", () => {
  const a = createAuction({ players: [p(1, "A")], teamIds: ["MI"], bidWindowMs: 10000 });
  startAuction(a, 0);
  assert.equal(pauseAuction(a, 4000).ok, true);
  assert.equal(a.pausedLeft, 6000);
});

test("nothing closes while paused, however long the pause lasts", () => {
  const a = createAuction({ players: [p(1, "A")], teamIds: ["MI"], bidWindowMs: 5000 });
  startAuction(a, 0);
  pauseAuction(a, 1000);
  assert.equal(tick(a, 999_999), null);
  assert.equal(a.status, "live");
});

test("resuming restarts the countdown from the time that was left", () => {
  const a = createAuction({ players: [p(1, "A")], teamIds: ["MI"], bidWindowMs: 10000 });
  startAuction(a, 0);
  pauseAuction(a, 4000);
  resumeAuction(a, 50_000);
  assert.equal(a.timer.deadline, 50_000 + 6000);
  assert.equal(tick(a, 55_999), null);
  assert.ok(tick(a, 56_000));
});

test("bids are refused while paused", () => {
  const a = createAuction({ players: [p(1, "A")], teamIds: ["MI"], bidWindowMs: 10000 });
  startAuction(a, 0);
  pauseAuction(a, 1000);
  assert.equal(placeBid(a, "MI", 25, 2000).ok, false);
});

test("pausing twice or resuming when not paused is refused", () => {
  const a = createAuction({ players: [p(1, "A")], teamIds: ["MI"], bidWindowMs: 10000 });
  startAuction(a, 0);
  assert.equal(pauseAuction(a, 100).ok, true);
  assert.equal(pauseAuction(a, 200).ok, false);
  resumeAuction(a, 300);
  assert.equal(resumeAuction(a, 400).ok, false);
});

function live() {
  const store = createRoomStore();
  const h = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  const guest = { playerId: "guest", roomCode: null };
  const { roomCode } = h.dispatch(host, "room:create", { name: "Gokul" }, 0);
  h.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  h.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  h.dispatch(guest, "team:claim", { teamId: "CSK" }, 0);
  h.dispatch(host, "room:start", { force: true }, 0);
  return { store, h, host, guest, roomCode };
}

test("only the host can pause and resume", () => {
  const { h, guest } = live();
  assert.equal(h.dispatch(guest, "auction:pause", {}, 1000).ok, false);
});

test("the host can pause and resume through the room", () => {
  const { h, host, roomCode } = live();
  assert.equal(h.dispatch(host, "auction:pause", {}, 1000).ok, true);
  const snap = h.snapshot(roomCode, 1000);
  assert.equal(snap.auction.paused, true);
  assert.equal(snap.auction.deadline, null);
  assert.ok(snap.auction.pausedLeft > 0);
  assert.equal(h.dispatch(host, "auction:resume", {}, 2000).ok, true);
  assert.equal(h.snapshot(roomCode, 2000).auction.paused, false);
});
