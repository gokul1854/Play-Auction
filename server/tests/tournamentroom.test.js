import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "../store/roomStore.js";
import { createHandlers } from "../socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));

function auctionedRoom(codes = ["MI", "CSK", "RCB", "KKR"]) {
  const store = createRoomStore();
  const h = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  const { roomCode } = h.dispatch(host, "room:create", { name: "Gokul", mode: "full" }, 0);
  h.dispatch(host, "team:claim", { teamId: codes[0] }, 0);
  const guests = codes.slice(1).map((code, i) => {
    const g = { playerId: "guest" + i, roomCode: null };
    h.dispatch(g, "room:join", { code: roomCode, name: "Friend" + i }, 0);
    h.dispatch(g, "team:claim", { teamId: code }, 0);
    return g;
  });
  h.dispatch(host, "room:start", { force: true }, 0);
  // Give every team a full XI, as if the auction had sold them players.
  const room = store.get(roomCode);
  Object.values(room.auction.teams).forEach((team, i) => { team.squad = pool.slice(i * 15, i * 15 + 15); });
  return { store, h, host, guests, roomCode };
}

test("the tournament runs between every team in the auction", () => {
  const { h, host, roomCode } = auctionedRoom();
  assert.equal(h.dispatch(host, "tournament:run", {}, 1000).ok, true);
  const snap = h.snapshot(roomCode, 1000);
  assert.equal(snap.tournament.table.length, 4);
  assert.equal(snap.tournament.league.length, 6);
  assert.equal(snap.tournament.playoffs.length, 4);
  assert.ok(["MI", "CSK", "RCB", "KKR"].includes(snap.tournament.champion));
});

test("the snapshot carries summaries only, not ball-by-ball data", () => {
  const { h, host, roomCode } = auctionedRoom();
  h.dispatch(host, "tournament:run", {}, 1000);
  const snap = h.snapshot(roomCode, 1000);
  assert.equal(snap.tournament.league[0].innings, undefined);
  assert.ok(snap.tournament.league[0].scores.length === 2);
});

test("any member can open a match for its full scorecard", () => {
  const { h, host, roomCode } = auctionedRoom();
  h.dispatch(host, "tournament:run", {}, 1000);
  const snap = h.snapshot(roomCode, 1000);
  const id = snap.tournament.league[0].id;
  const res = h.dispatch(host, "tournament:match", { id }, 1000);
  assert.equal(res.ok, true);
  assert.equal(res.match.innings.length, 2);
  assert.ok(res.match.innings[0].batters.length > 0);
});

test("an unknown match id is refused", () => {
  const { h, host } = auctionedRoom();
  h.dispatch(host, "tournament:run", {}, 1000);
  assert.equal(h.dispatch(host, "tournament:match", { id: 9999 }, 0).ok, false);
});

test("a tournament needs the auction first", () => {
  const store = createRoomStore();
  const h = createHandlers({ store, pool });
  const host = { playerId: "host", roomCode: null };
  h.dispatch(host, "room:create", { name: "Gokul" }, 0);
  assert.equal(h.dispatch(host, "tournament:run", {}, 0).ok, false);
});

test("a tournament is refused while any team has fewer than 11 bought players", () => {
  const { store, h, host, roomCode } = auctionedRoom();
  store.get(roomCode).auction.teams.RCB.squad = pool.slice(0, 4);
  const res = h.dispatch(host, "tournament:run", {}, 0);
  assert.equal(res.ok, false);
  assert.match(res.error, /RCB \(4\)/);
});
