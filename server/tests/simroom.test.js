import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));

function liveRoom() {
  const store = createRoomStore();
  const handlers = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  const guest = { playerId: "guest", roomCode: null };
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  handlers.dispatch(guest, "team:claim", { teamId: "CSK" }, 0);
  handlers.dispatch(host, "room:start", { force: true }, 0);
  // Give MI and CSK a full XI each, as if the auction had sold them players.
  const room = store.get(roomCode);
  room.auction.teams.MI.squad = pool.slice(0, 15);
  room.auction.teams.CSK.squad = pool.slice(15, 30);
  return { store, handlers, host, roomCode };
}

test("a simulation runs between two auction teams and is stored in the room", () => {
  const { store, handlers, host, roomCode } = liveRoom();
  const res = handlers.dispatch(host, "sim:run", { home: "MI", away: "CSK" }, 1000);
  assert.equal(res.ok, true);
  const room = store.get(roomCode);
  assert.equal(room.sims.length, 1);
  assert.equal(room.sims[0].home, "MI");
});

test("the snapshot sends simulation summaries and the latest full match", () => {
  const { handlers, host, roomCode } = liveRoom();
  handlers.dispatch(host, "sim:run", { home: "MI", away: "CSK" }, 1000);
  const snap = handlers.snapshot(roomCode, 1000);
  assert.equal(snap.sims.length, 1);
  assert.equal(snap.sims[0].scores.length, 2);
  assert.ok(snap.lastSim.result.innings[0].log.length > 0);
});

test("you cannot simulate a team against itself or an unknown team", () => {
  const { handlers, host } = liveRoom();
  assert.equal(handlers.dispatch(host, "sim:run", { home: "MI", away: "MI" }, 0).ok, false);
  assert.equal(handlers.dispatch(host, "sim:run", { home: "MI", away: "GT" }, 0).ok, false);
});

test("only the last 10 simulations are kept", () => {
  const { store, handlers, host, roomCode } = liveRoom();
  for (let i = 0; i < 13; i++) handlers.dispatch(host, "sim:run", { home: "MI", away: "CSK" }, i);
  const room = store.get(roomCode);
  assert.equal(room.sims.length, 10);
  assert.equal(room.sims[0].id, 4);
});

test("a team with fewer than 11 bought players cannot be simulated", () => {
  const { store, handlers, host, roomCode } = liveRoom();
  store.get(roomCode).auction.teams.CSK.squad = pool.slice(15, 18);
  const res = handlers.dispatch(host, "sim:run", { home: "MI", away: "CSK" }, 0);
  assert.equal(res.ok, false);
  assert.match(res.error, /CSK \(3\)/);
});
