import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));

function room() {
  const store = createRoomStore();
  const h = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  const guest = { playerId: "guest", roomCode: null };
  const { roomCode } = h.dispatch(host, "room:create", { name: "Gokul" }, 0);
  h.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  h.dispatch(guest, "team:claim", { teamId: "CSK" }, 0);
  return { store, h, host, guest, roomCode };
}

test("the host can remove a player, and their team is released", () => {
  const { store, h, host, roomCode } = room();
  const res = h.dispatch(host, "room:kick", { playerId: "guest" }, 0);
  assert.equal(res.ok, true);
  assert.equal(res.kicked, "guest");
  const r = store.get(roomCode);
  assert.equal(r.members.guest, undefined);
  assert.equal(r.claims.CSK, undefined);
});

test("only the host can remove players, and the host cannot remove themselves", () => {
  const { h, host, guest } = room();
  assert.equal(h.dispatch(guest, "room:kick", { playerId: "host" }, 0).ok, false);
  assert.equal(h.dispatch(host, "room:kick", { playerId: "host" }, 0).ok, false);
});

test("a removed player cannot rejoin", () => {
  const { h, host, guest, roomCode } = room();
  h.dispatch(host, "room:kick", { playerId: "guest" }, 0);
  const again = h.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  assert.equal(again.ok, false);
  assert.match(again.error, /removed/);
});

test("a removed player can no longer act in the room", () => {
  const { h, host, guest } = room();
  h.dispatch(host, "room:kick", { playerId: "guest" }, 0);
  const res = h.dispatch(guest, "chat:send", { text: "hello" }, 0);
  assert.equal(res.ok, false);
  assert.match(res.error, /no longer in this room/);
});
