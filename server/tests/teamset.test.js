import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoom, joinRoom, claimTeam, setTeamSet, publicState } from "../engine/room.js";
import { teamsFor, INTERNATIONAL_TEAMS, IPL_TEAMS } from "../engine/teams.js";

function roomWithHost() {
  const room = createRoom({ code: "ABCDEF", host: { id: "h", name: "Host" }, now: 0 });
  joinRoom(room, { id: "g", name: "Guest" });
  return room;
}

test("the default room auctions IPL franchises", () => {
  const room = roomWithHost();
  assert.equal(room.teamSet, "ipl");
  assert.equal(publicState(room, 0).totalTeams, 10);
});

test("the host can switch a lobby to national teams", () => {
  const room = roomWithHost();
  assert.equal(setTeamSet(room, "h", "international").ok, true);
  const s = publicState(room, 0);
  assert.equal(s.settings.teamSet, "international");
  assert.equal(s.totalTeams, 12);
});

test("a national team can be claimed after switching, and an IPL team cannot", () => {
  const room = roomWithHost();
  setTeamSet(room, "h", "international");
  assert.equal(claimTeam(room, "g", "IND").ok, true);
  assert.equal(claimTeam(room, "g", "MI").ok, false);
});

test("only the host can change the team set", () => {
  const room = roomWithHost();
  assert.equal(setTeamSet(room, "g", "international").ok, false);
  assert.equal(room.teamSet, "ipl");
});

test("switching sets releases teams that are not in the new set", () => {
  const room = roomWithHost();
  claimTeam(room, "g", "CSK");
  setTeamSet(room, "h", "international");
  assert.equal(room.claims.CSK, undefined);
});

test("the team set cannot change once the auction has started", () => {
  const room = roomWithHost();
  room.status = "live";
  assert.equal(setTeamSet(room, "h", "international").ok, false);
});

test("an unknown set is refused", () => {
  const room = roomWithHost();
  assert.equal(setTeamSet(room, "h", "domestic").ok, false);
});

test("the team lists have the expected sizes and do not overlap", () => {
  assert.equal(IPL_TEAMS.length, 10);
  assert.equal(INTERNATIONAL_TEAMS.length, 12);
  assert.equal(teamsFor("unknown").length, 10);
  assert.equal(IPL_TEAMS.some((t) => INTERNATIONAL_TEAMS.includes(t)), false);
});

test("a room created with national teams auctions them from the start", () => {
  const room = createRoom({ code: "ZZZZZZ", host: { id: "h", name: "Host" }, teamSet: "international", now: 0 });
  assert.equal(room.teamSet, "international");
  assert.equal(claimTeam(room, "h", "AUS").ok, true);
});

test("an unknown team set at creation falls back to IPL franchises", () => {
  const room = createRoom({ code: "YYYYYY", host: { id: "h", name: "Host" }, teamSet: "domestic", now: 0 });
  assert.equal(room.teamSet, "ipl");
});
