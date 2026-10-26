import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));

function setup() {
  const store = createRoomStore();
  const handlers = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  const guest = { playerId: "guest", roomCode: null };
  return { store, handlers, host, guest };
}

test("create room gives a 6-character code and makes the host a member", () => {
  const { store, handlers, host } = setup();
  const res = handlers.dispatch(host, "room:create", { name: "Gokul", visibility: "public" }, 0);
  assert.equal(res.ok, true);
  assert.equal(res.roomCode.length, 6);
  assert.equal(host.roomCode, res.roomCode);
  assert.equal(store.get(res.roomCode).hostId, "host");
});

test("names are required and trimmed", () => {
  const { handlers, host } = setup();
  assert.equal(handlers.dispatch(host, "room:create", { name: "   " }, 0).ok, false);
});

test("joining is case-insensitive and unknown codes fail", () => {
  const { handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  assert.equal(handlers.dispatch(guest, "room:join", { code: roomCode.toLowerCase(), name: "Ravi" }, 0).ok, true);
  assert.equal(handlers.dispatch(guest, "room:join", { code: "ZZZZZZ", name: "Ravi" }, 0).ok, false);
});

test("a team can only be held by one player at a time", () => {
  const { handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  assert.equal(handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0).ok, true);
  const res = handlers.dispatch(guest, "team:claim", { teamId: "RCB" }, 0);
  assert.equal(res.ok, false);
  assert.match(res.error, /Gokul/);
});

test("changing your team in the lobby releases the old one", () => {
  const { store, handlers, host } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "MI" }, 0);
  const room = store.get(roomCode);
  assert.equal(room.claims.RCB, undefined);
  assert.equal(room.claims.MI, "host");
});

test("starting with empty teams needs confirmation, then force starts it", () => {
  const { store, handlers, host } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  const first = handlers.dispatch(host, "room:start", {}, 0);
  assert.equal(first.needsConfirmation, true);
  assert.equal(first.joined, 1);
  assert.equal(first.total, 10);
  assert.equal(store.get(roomCode).status, "lobby");

  const second = handlers.dispatch(host, "room:start", { force: true }, 0);
  assert.equal(second.ok, true);
  assert.equal(store.get(roomCode).status, "live");
});

test("only the host can start the auction", () => {
  const { handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  handlers.dispatch(guest, "team:claim", { teamId: "MI" }, 0);
  assert.equal(handlers.dispatch(guest, "room:start", { force: true }, 0).ok, false);
});

test("a bid goes through the engine and clients can't bid without a team", () => {
  const { store, handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  handlers.dispatch(host, "room:start", { force: true }, 0);

  assert.equal(handlers.dispatch(guest, "auction:bid", { amount: 20 }, 100).ok, false); // no team
  const base = store.get(roomCode).auction.current.basePrice;
  assert.equal(handlers.dispatch(host, "auction:bid", { amount: base }, 100).ok, true);
});

test("bids must be whole numbers", () => {
  const { handlers, host } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  handlers.dispatch(host, "room:start", { force: true }, 0);
  assert.equal(handlers.dispatch(host, "auction:bid", { amount: 20.5 }, 100).ok, false);
});

test("bidding is rate limited to 4 per second", () => {
  const { handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  handlers.dispatch(guest, "team:claim", { teamId: "MI" }, 0);
  handlers.dispatch(host, "room:start", { force: true }, 0);
  // Four rapid bids are allowed through to validation (they fail on amount, which is fine here).
  for (let i = 0; i < 4; i++) {
    const res = handlers.dispatch(guest, "auction:bid", { amount: 1 }, 100 + i);
    assert.notEqual(res.error, "slow down", `bid ${i} should not be rate limited`);
  }
  const fifth = handlers.dispatch(guest, "auction:bid", { amount: 1 }, 110);
  assert.equal(fifth.error, "slow down");
  // Once the window passes, bidding is allowed again.
  const later = handlers.dispatch(guest, "auction:bid", { amount: 1 }, 2000);
  assert.notEqual(later.error, "slow down");
});

test("chat is trimmed, empty messages are refused, and it is rate limited", () => {
  const { store, handlers, host } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  assert.equal(handlers.dispatch(host, "chat:send", { text: "   " }, 0).ok, false);
  assert.equal(handlers.dispatch(host, "chat:send", { text: "  hi  " }, 0).ok, true);
  assert.equal(store.get(roomCode).chat.at(-1).text, "hi");
  for (let i = 0; i < 9; i++) handlers.dispatch(host, "chat:send", { text: "x" }, 10 + i);
  assert.equal(handlers.dispatch(host, "chat:send", { text: "x" }, 20).ok, false);
});

test("a dropped player keeps their team and reclaims it on rejoin", () => {
  const { store, handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  handlers.dispatch(guest, "team:claim", { teamId: "CSK" }, 0);
  const dropped = { ...guest };
  handlers.disconnect(dropped);
  assert.equal(store.get(roomCode).members.guest.connected, false);
  const back = { playerId: "guest", roomCode: null };
  const res = handlers.dispatch(back, "room:join", { code: roomCode }, 0);
  assert.equal(res.ok, true);
  assert.equal(store.get(roomCode).claims.CSK, "guest");
  assert.equal(store.get(roomCode).members.guest.connected, true);
});

test("tickAll closes an expired lot and reports the room as changed", () => {
  const { store, handlers, host } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  handlers.dispatch(host, "room:start", { force: true }, 0);
  assert.deepEqual(handlers.tickAll(100), []);
  assert.deepEqual(handlers.tickAll(10_000), [roomCode]);
  assert.equal(store.get(roomCode).auction.unsold.length, 1);
});

test("browse only lists public rooms", () => {
  const { handlers, host, guest } = setup();
  handlers.dispatch(host, "room:create", { name: "Gokul", visibility: "private" }, 0);
  const { roomCode } = handlers.dispatch(guest, "room:create", { name: "Ravi", visibility: "public" }, 0);
  const list = handlers.dispatch({ playerId: "x" }, "rooms:browse", {}, 0).data;
  assert.equal(list.length, 1);
  assert.equal(list[0].code, roomCode);
});

test("host can stop the auction, others cannot", () => {
  const { store, handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  handlers.dispatch(host, "room:start", { force: true }, 0);
  assert.equal(handlers.dispatch(guest, "room:stop", {}, 0).ok, false);
  assert.equal(handlers.dispatch(host, "room:stop", {}, 0).ok, true);
  assert.equal(store.get(roomCode).status, "finished");
});

test("leaving the last member deletes the room; leaving the host hands over", () => {
  const { store, handlers, host, guest } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(guest, "room:join", { code: roomCode, name: "Ravi" }, 0);
  handlers.dispatch(host, "room:leave", {}, 0);
  assert.equal(store.get(roomCode).hostId, "guest");
  handlers.dispatch(guest, "room:leave", {}, 0);
  assert.equal(store.get(roomCode), null);
});

test("snapshot exposes squad counts and public squad lists", () => {
  const { handlers, host } = setup();
  const { roomCode } = handlers.dispatch(host, "room:create", { name: "Gokul" }, 0);
  handlers.dispatch(host, "team:claim", { teamId: "RCB" }, 0);
  handlers.dispatch(host, "room:start", { force: true }, 0);
  const snap = handlers.snapshot(roomCode, 0);
  assert.ok(snap.auction.teams.every((t) => typeof t.squadCount === "number" && Array.isArray(t.squad)));
});
