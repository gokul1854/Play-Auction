// Room lifecycle: membership, team claims, start rules, bids, chat, host controls.
// Pure logic with no networking, so it can be tested directly.

import { createAuction, startAuction, placeBid as engineBid, tick, addTeam, endAuction, pauseAuction, resumeAuction } from "./auction.js";
import { DEFAULT_PURSE, nextBid } from "./purse.js";
import { simulateMatch, XI_SIZE, validatePlayingXI } from "./sim.js";
import { poolFor, normaliseMode, BID_WINDOW_OPTIONS, DEFAULT_BID_WINDOW, SPEED_OPTIONS, DEFAULT_SPEED, OVERSEAS_OPTIONS, DEFAULT_OVERSEAS } from "./modes.js";
import { runTournament, netRunRate } from "./tournament.js";
import { IPL_TEAMS, TEAM_SETS, DEFAULT_TEAM_SET, teamsFor } from "./teams.js";

export const ALL_TEAMS = IPL_TEAMS;
export const MAX_MEMBERS = 10;
export const MAX_CHAT_LENGTH = 300;
const CHAT_HISTORY = 200;
// No 0/O/1/I, so codes are easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(rng = Math.random) {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

function addSystem(room, text) {
  room.chat.push({ type: "system", text });
  if (room.chat.length > CHAT_HISTORY) room.chat.splice(0, room.chat.length - CHAT_HISTORY);
}

export function teamOf(room, playerId) {
  return Object.keys(room.claims).find((t) => room.claims[t] === playerId) ?? null;
}

export function createRoom({ code, host, visibility = "private", mode = "full", teamSet = DEFAULT_TEAM_SET, now }) {
  const room = {
    code,
    visibility,
    mode: normaliseMode(mode),
    bidWindowMs: DEFAULT_BID_WINDOW,
    speed: DEFAULT_SPEED,
    status: "lobby",          // lobby | live | finished
    hostId: host.id,
    members: {},              // id -> { id, name, connected }
    claims: {},               // teamId -> playerId
    chat: [],
    auction: null,
    sims: [],                 // most recent match simulations (last 10)
    tournament: null,         // most recent tournament
    lotOrder: "category",     // how players are grouped into sets: by category or by role
    teamSet: TEAM_SETS[teamSet] ? teamSet : DEFAULT_TEAM_SET, // which teams can be claimed: IPL franchises or national teams
    kicked: new Set(),        // players the host removed, who may not rejoin
    overseasLimit: DEFAULT_OVERSEAS,
    createdAt: now,
  };
  room.members[host.id] = { id: host.id, name: host.name, connected: true };
  addSystem(room, `${host.name} created the room`);
  return room;
}

export function joinRoom(room, { id, name }) {
  if (room.kicked?.has(id)) return { ok: false, error: "the host removed you from this room" };
  if (room.members[id]) {
    room.members[id].name = name;
    room.members[id].connected = true;
    return { ok: true, rejoined: true };
  }
  if (room.status === "finished") return { ok: false, error: "this auction has finished" };
  if (Object.keys(room.members).length >= MAX_MEMBERS) return { ok: false, error: "room is full" };
  room.members[id] = { id, name, connected: true };
  addSystem(room, `${name} joined the room`);
  return { ok: true, rejoined: false };
}

// Socket dropped. Keep the member and their team so they can reconnect.
export function markDisconnected(room, id) {
  if (room.members[id]) room.members[id].connected = false;
}

// Explicit leave. Only allowed in the lobby; mid-auction the team stays with the player.
export function leaveRoom(room, id) {
  const member = room.members[id];
  if (!member) return { ok: false, error: "not in this room" };
  if (room.status === "lobby") {
    const team = teamOf(room, id);
    if (team) delete room.claims[team];
  }
  delete room.members[id];
  addSystem(room, `${member.name} left the room`);
  if (id === room.hostId) {
    const next = Object.keys(room.members)[0];
    if (next) room.hostId = next;
  }
  return { ok: true };
}

export function claimTeam(room, id, teamId) {
  if (!room.members[id]) return { ok: false, error: "join the room first" };
  if (!teamsFor(room.teamSet).includes(teamId)) return { ok: false, error: "unknown team" };
  if (room.status === "finished") return { ok: false, error: "auction has finished" };

  const holder = room.claims[teamId];
  if (holder && holder !== id) {
    return { ok: false, error: `${room.members[holder]?.name ?? "someone"} already has ${teamId}` };
  }

  const previous = teamOf(room, id);
  if (previous === teamId) return { ok: true };
  if (previous && room.status === "live") {
    return { ok: false, error: "you can't switch teams during the auction" };
  }
  if (previous) delete room.claims[previous];

  room.claims[teamId] = id;
  if (room.auction && room.auction.status !== "finished") {
    addTeam(room.auction, teamId);
  }
  addSystem(room, `${room.members[id].name} selected ${teamId}`);
  return { ok: true };
}

export function releaseTeam(room, id) {
  const team = teamOf(room, id);
  if (!team) return { ok: false, error: "you don't have a team" };
  if (room.status !== "lobby") return { ok: false, error: "can't release a team during the auction" };
  delete room.claims[team];
  addSystem(room, `${room.members[id].name} released ${team}`);
  return { ok: true };
}

function shuffle(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Legends go first, then Marquee, Capped, Uncapped. Shuffled within each category.
export const CATEGORY_ORDER = ["Legend", "Marquee", "Capped", "Uncapped"];
export function orderByCategory(pool, rng = Math.random) {
  return CATEGORY_ORDER.flatMap((cat) => shuffle(pool.filter((p) => p.category === cat), rng));
}

// Sets by role: all batters first, then keepers, all-rounders and bowlers.
// Inside each role, the premium categories come first.
export const ROLE_ORDER = ["Batter", "Keeper", "All-rounder", "Bowler"];
export const LOT_ORDERS = ["category", "role"];
export function orderLots(pool, rng = Math.random, lotOrder = "category") {
  if (lotOrder === "role") {
    return ROLE_ORDER.flatMap((role) =>
      CATEGORY_ORDER.flatMap((cat) =>
        shuffle(pool.filter((p) => p.role === role && p.category === cat), rng)
      )
    );
  }
  return orderByCategory(pool, rng);
}

// Starts the auction. If not all teams are claimed and `force` is false, nothing starts and the
// caller is asked to confirm (this is the "Only X of 10 teams joined" modal).
export function startRoom(room, { pool, now, force = false, rng = Math.random }) {
  if (room.status !== "lobby") return { ok: false, error: "already started" };
  const all = teamsFor(room.teamSet);
  const teamIds = all.filter((t) => room.claims[t]);
  if (teamIds.length === 0) return { ok: false, error: "at least one team must be claimed" };
  if (teamIds.length < all.length && !force) {
    return { ok: false, needsConfirmation: true, joined: teamIds.length, total: all.length };
  }
  room.auction = createAuction({
    players: orderLots(poolFor(room.mode, pool), rng, room.lotOrder),
    teamIds,
    purse: DEFAULT_PURSE,
    bidWindowMs: Math.round(room.bidWindowMs / room.speed),
    speed: room.speed,
    overseasLimit: room.overseasLimit,
  });
  startAuction(room.auction, now);
  room.status = "live";
  addSystem(room, "Auction has started!");
  return { ok: true };
}

// Changes take effect from the next lot. The lot on the block keeps its current countdown.
function applyTiming(room) {
  if (room.auction && room.auction.status !== "finished") {
    room.auction.speed = room.speed;
    room.auction.bidWindowMs = Math.round(room.bidWindowMs / room.speed);
  }
}

function canChangeTiming(room, id) {
  if (id !== room.hostId) return { ok: false, error: "only the host can change settings" };
  if (room.status === "finished") return { ok: false, error: "the auction has finished" };
  return { ok: true };
}

// Host sets the bid timer in the lobby or during the auction.
export function setBidWindow(room, id, ms) {
  const check = canChangeTiming(room, id);
  if (!check.ok) return check;
  if (!BID_WINDOW_OPTIONS.includes(ms)) return { ok: false, error: "choose 5s, 10s, 15s, 20s or 25s" };
  room.bidWindowMs = ms;
  applyTiming(room);
  addSystem(room, `${room.members[id].name} changed bid timer to ${ms / 1000}s${room.status === "live" ? " (from the next lot)" : ""}`);
  return { ok: true };
}

// Host pauses the countdown for everyone, for a call or a break.
export function pauseRoom(room, id, now) {
  if (id !== room.hostId) return { ok: false, error: "only the host can pause the auction" };
  const r = pauseAuction(room.auction, now);
  if (!r.ok) return { ok: false, error: r.reason };
  addSystem(room, `${room.members[id].name} paused the auction`);
  return { ok: true };
}

// Host resumes the countdown from where it stopped.
export function resumeRoom(room, id, now) {
  if (id !== room.hostId) return { ok: false, error: "only the host can resume the auction" };
  const r = resumeAuction(room.auction, now);
  if (!r.ok) return { ok: false, error: r.reason };
  addSystem(room, `${room.members[id].name} resumed the auction`);
  return { ok: true };
}

export function stopRoom(room, id) {
  if (id !== room.hostId) return { ok: false, error: "only the host can stop the auction" };
  if (room.status !== "live") return { ok: false, error: "no auction is running" };
  endAuction(room.auction);
  room.status = "finished";
  addSystem(room, "Host ended the auction");
  return { ok: true };
}

export function placeBid(room, id, amount, now) {
  if (room.status !== "live") return { ok: false, error: "auction is not live" };
  const teamId = teamOf(room, id);
  if (!teamId) return { ok: false, error: "claim a team before bidding" };
  return engineBid(room.auction, teamId, amount, now);
}

// Advances the auction clock. Returns the outcome if a lot closed, otherwise null.
export function tickRoom(room, now) {
  if (room.status !== "live") return null;
  const outcome = tick(room.auction, now);
  if (!outcome) return null;

  if (outcome.type === "sold") {
    const price = (outcome.price / 100).toFixed(2);
    addSystem(room, `${outcome.name} sold to ${outcome.teamId} for ${price} Cr`);
  } else {
    addSystem(room, `${outcome.name} went unsold`);
  }
  if (room.auction.status === "finished") {
    room.status = "finished";
    addSystem(room, "Auction finished");
  }
  return outcome;
}

export function sendChat(room, id, text, now) {
  const member = room.members[id];
  if (!member) return { ok: false, error: "join the room first" };
  const clean = String(text ?? "").trim().slice(0, MAX_CHAT_LENGTH);
  if (!clean) return { ok: false, error: "message is empty" };
  room.chat.push({ type: "chat", from: id, name: member.name, text: clean, at: now });
  if (room.chat.length > CHAT_HISTORY) room.chat.splice(0, room.chat.length - CHAT_HISTORY);
  return { ok: true };
}

// Message for teams that have not bought enough players to field a team.
export function squadError(teams) {
  const list = teams.map((t) => `${t.id} (${t.squad.length})`).join(", ");
  return `Each team needs ${XI_SIZE} bought players to play. Short: ${list}. Buy more in the auction first.`;
}

// Plays a match between two auction teams and keeps the last 10 results in the room.
export function runSim(room, { home, away, now, rng = Math.random }) {
  if (!room.auction) return { ok: false, error: "run the auction first" };
  if (!home || !away || home === away) return { ok: false, error: "pick two different teams" };
  const h = room.auction.teams[home];
  const a = room.auction.teams[away];
  if (!h || !a) return { ok: false, error: "both teams must be in the auction" };
  const short = [h, a].filter((t) => validatePlayingXI(t.squad).ok === false);
  if (short.length) return { ok: false, error: squadError(short) };
  const result = simulateMatch({ home: { code: home, squad: h.squad }, away: { code: away, squad: a.squad }, rng });
  const id = (room.sims.at(-1)?.id ?? 0) + 1;
  room.sims.push({ id, home, away, at: now, result });
  if (room.sims.length > 10) room.sims.splice(0, room.sims.length - 10);
  addSystem(room, `Simulated ${home} vs ${away}: ${result.text}`);
  return { ok: true, id };
}

// Host removes a member. Their team is released, and they cannot rejoin.
export function kickMember(room, hostId, targetId) {
  if (hostId !== room.hostId) return { ok: false, error: "only the host can remove players" };
  if (targetId === hostId) return { ok: false, error: "you cannot remove yourself" };
  const member = room.members[targetId];
  if (!member) return { ok: false, error: "that player is not in the room" };
  const team = teamOf(room, targetId);
  if (team) delete room.claims[team];
  delete room.members[targetId];
  room.kicked = room.kicked ?? new Set();
  room.kicked.add(targetId);
  addSystem(room, `${member.name} was removed from the room`);
  return { ok: true };
}

// Host sets the overseas limit in the lobby or during the auction. Applies to the next bid.
export function setOverseas(room, id, limit) {
  if (id !== room.hostId) return { ok: false, error: "only the host can change settings" };
  if (room.status === "finished") return { ok: false, error: "the auction has finished" };
  if (!OVERSEAS_OPTIONS.includes(limit)) return { ok: false, error: "choose off, 4, 6 or 8 overseas players" };
  room.overseasLimit = limit;
  if (room.auction && room.auction.status !== "finished") room.auction.overseasLimit = limit;
  const text = limit === null ? "off" : `${limit} per squad`;
  addSystem(room, `${room.members[id].name} set the overseas limit to ${text}`);
  return { ok: true };
}

// Host chooses how sets are ordered, while the room is in the lobby.
// Chooses which teams the room auctions. Host only, and only before the auction starts.
// Any team that is not in the new set is released.
export function setTeamSet(room, id, set) {
  if (id !== room.hostId) return { ok: false, error: "only the host can change settings" };
  if (room.status !== "lobby") return { ok: false, error: "settings are locked once the auction starts" };
  if (!TEAM_SETS[set]) return { ok: false, error: "unknown team set" };
  room.teamSet = set;
  const allowed = new Set(teamsFor(set));
  for (const code of Object.keys(room.claims)) {
    if (!allowed.has(code)) delete room.claims[code];
  }
  addSystem(room, `${room.members[id]?.name ?? "The host"} chose ${set === "international" ? "international teams" : "IPL franchises"}`);
  return { ok: true };
}

export function setLotOrder(room, id, order) {
  if (id !== room.hostId) return { ok: false, error: "only the host can change settings" };
  if (room.status !== "lobby") return { ok: false, error: "settings are locked once the auction starts" };
  if (!LOT_ORDERS.includes(order)) return { ok: false, error: "choose by category or by role" };
  room.lotOrder = order;
  addSystem(room, `${room.members[id].name} set the auction order to ${order === "role" ? "by role" : "by category"}`);
  return { ok: true };
}

// Host sets the auction speed in the lobby or during the auction.
export function setSpeed(room, id, speed) {
  const check = canChangeTiming(room, id);
  if (!check.ok) return check;
  if (!SPEED_OPTIONS.includes(speed)) return { ok: false, error: "choose 1x, 3x, 5x, 7x or 10x" };
  room.speed = speed;
  applyTiming(room);
  addSystem(room, `${room.members[id].name} set auction speed to ${speed}x${room.status === "live" ? " (from the next lot)" : ""}`);
  return { ok: true };
}

// Plays a tournament between every team in the auction and keeps the latest one in the room.
export function runTournamentRoom(room, { now, rng = Math.random, format = "league-playoffs" }) {
  if (!room.auction) return { ok: false, error: "run the auction first" };
  const all = Object.values(room.auction.teams);
  if (all.length < 2) return { ok: false, error: "at least two teams must be in the auction" };
  const short = all.filter((t) => validatePlayingXI(t.squad).ok === false);
  if (short.length) return { ok: false, error: squadError(short) };
  const teams = all.map((t) => ({ code: t.id, squad: t.squad }));
  const result = runTournament({ teams, rng, format });
  if (result.error) return { ok: false, error: result.error };
  room.tournament = { id: (room.tournament?.id ?? 0) + 1, at: now, format: result.format, ...result };
  addSystem(room, `Tournament finished: ${result.champion} are the champions`);
  return { ok: true, id: room.tournament.id };
}

// Summary of one match for the lists: no ball-by-ball data.
function matchSummary(m) {
  return {
    id: m.id, stage: m.stage, home: m.home, away: m.away, text: m.text, winner: m.winner,
    scores: m.innings.map((i) => ({ code: i.code, runs: i.runs, wickets: i.wickets, overs: i.overs })),
  };
}

// The only shape clients ever receive. Squads are summarised, not sent in full.
export function publicState(room, now) {
  const a = room.auction;
  return {
    code: room.code,
    visibility: room.visibility,
    mode: room.mode,
    status: room.status,
    hostId: room.hostId,
    members: Object.values(room.members),
    settings: { mode: room.mode, bidWindowMs: room.bidWindowMs, speed: room.speed, lotOrder: room.lotOrder, overseasLimit: room.overseasLimit, teamSet: room.teamSet, startingPurse: DEFAULT_PURSE },
    claims: { ...room.claims },
    teamsFilled: Object.keys(room.claims).length,
    totalTeams: teamsFor(room.teamSet).length,
    chat: room.chat.slice(-100),
    // Summaries of recent simulations for everyone, and the full ball-by-ball of the latest one.
    sims: (room.sims ?? []).map((s) => ({
      id: s.id, home: s.home, away: s.away, at: s.at, text: s.result.text,
      scores: s.result.innings.map((i) => ({ code: i.code, runs: i.runs, wickets: i.wickets, overs: i.overs })),
    })),
    lastSim: room.sims?.length ? { ...room.sims.at(-1) } : null,
    tournament: room.tournament ? {
      id: room.tournament.id,
      format: room.tournament.format ?? "league-playoffs",
      champion: room.tournament.champion,
      table: room.tournament.table.map((r) => ({
        code: r.code, position: r.position, played: r.played, won: r.won, lost: r.lost,
        tied: r.tied, points: r.points, nrr: Number(netRunRate(r).toFixed(2)),
      })),
      league: room.tournament.league.map(matchSummary),
      playoffs: room.tournament.playoffs.map(matchSummary),
    } : null,
    serverNow: now,
    auction: a
      ? {
          status: a.status,
          current: a.current,
          windowMs: a.bidWindowMs,
          paused: a.paused,
          overseasLimit: a.overseasLimit,
          lastClose: a.lastClose,
          pausedLeft: a.paused ? a.pausedLeft : null,
          currentBid: a.currentBid,
          leaderId: a.leaderId,
          nextBid: a.current ? nextBid(a.currentBid, a.current.basePrice) : null,
          deadline: a.paused || !a.timer ? null : a.timer.deadline,
          // Squads are public: everyone sees who each team bought and for how much.
          teams: Object.values(a.teams).map((t) => ({
            id: t.id,
            purse: t.purse,
            squadCount: t.squad.length,
            squad: a.sold
              .filter((s) => s.teamId === t.id)
              .map((s) => ({
                name: s.player.name, category: s.player.category, role: s.player.role,
                country: s.player.country, price: s.price,
              })),
          })),
          sold: a.sold.map((s) => ({
            name: s.player.name, category: s.player.category, role: s.player.role,
            country: s.player.country, teamId: s.teamId, price: s.price,
          })),
          unsold: a.unsoldHistory.map((p) => ({
            name: p.name, category: p.category, role: p.role,
            country: p.country, basePrice: p.basePrice,
          })),
          unsoldCount: a.unsoldHistory.length,
          queueCount: a.queue.length,
          // Upcoming players in auction order, so the Stats tab can group them by set.
          upcoming: a.queue.map((p) => ({ name: p.name, category: p.category, role: p.role, country: p.country, basePrice: p.basePrice })),
          lastEvent: a.lastEvent,
        }
      : null,
  };
}
