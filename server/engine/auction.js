// Auction state machine. The server is the single source of truth:
// clients send intents (placeBid), and this module decides what actually happens.
// Every function takes `now` (ms) so timing is testable without real waiting.

import { DEFAULT_PURSE, nextBid, canAfford, MIN_SQUAD } from "./purse.js";
import { startTimer, extendOnBid, isExpired, BID_WINDOW_MS, ANTI_SNIPE_MS } from "./timer.js";

// A player is overseas when they do not play for India.
export function isOverseas(player) {
  return player.country !== "India";
}

export function overseasCount(team) {
  return team.squad.filter(isOverseas).length;
}

export function createAuction({ players, teamIds, purse = DEFAULT_PURSE, bidWindowMs = BID_WINDOW_MS, speed = 1, overseasLimit = null }) {
  const teams = {};
  for (const id of teamIds) {
    teams[id] = { id, purse, squad: [] };
  }
  return {
    status: "idle",            // idle | live | finished
    bidWindowMs,               // time per lot, set by the host
    speed,                     // auction speed multiplier (1 = normal)
    paused: false,             // true while the host has paused the countdown
    overseasLimit,             // most overseas players a squad may hold (null = no limit)
    closeSeq: 0,               // counts closed lots, so the app can show each result once
    lastClose: null,           // the most recent closed lot: sold or unsold, kept until the next one
    pausedLeft: 0,             // time left on the lot when it was paused
    queue: [...players],       // players not yet auctioned
    unsold: [],                // lots that closed with no bids (current pass)
    unsoldHistory: [],        // everyone who has gone unsold at least once and not been sold since
    recycled: false,           // unsold lots get one second pass
    current: null,             // player on the block
    currentBid: null,          // amount in units, null until the first bid
    leaderId: null,            // team holding the highest bid
    timer: null,
    teams,
    sold: [],                  // { player, teamId, price }
    lastEvent: null,
  };
}

export function startAuction(state, now) {
  if (state.status !== "idle") return { ok: false, reason: "auction already started" };
  return { ok: true, ...advance(state, now) };
}

// Move to the next lot, or finish if nothing is left.
function advance(state, now) {
  if (state.queue.length === 0 && !state.recycled && state.unsold.length > 0) {
    state.queue = state.unsold;
    state.unsold = [];
    state.recycled = true;
  }
  if (state.queue.length === 0) {
    state.status = "finished";
    state.current = null;
    state.timer = null;
    state.lastEvent = { type: "finished" };
    return { finished: true };
  }
  state.status = "live";
  state.current = state.queue.shift();
  state.currentBid = null;
  state.leaderId = null;
  state.timer = startTimer(now, state.bidWindowMs);
  state.lastEvent = { type: "lot_opened", playerId: state.current.id };
  return { playerId: state.current.id };
}

// A team bids on the current lot. `amount` must be exactly the next valid bid.
export function placeBid(state, teamId, amount, now) {
  if (state.status !== "live") return { ok: false, reason: "no live lot" };
  if (state.paused) return { ok: false, reason: "the auction is paused" };
  if (isExpired(state.timer, now)) return { ok: false, reason: "bidding window closed" };

  const team = state.teams[teamId];
  if (!team) return { ok: false, reason: "unknown team" };
  if (state.leaderId === teamId) return { ok: false, reason: "you already hold the highest bid" };

  const required = nextBid(state.currentBid, state.current.basePrice);
  if (amount !== required) {
    return { ok: false, reason: `next valid bid is ${required}` };
  }

  const lot = state.current;
  if (state.overseasLimit != null && isOverseas(lot) && overseasCount(team) >= state.overseasLimit) {
    return { ok: false, reason: `overseas limit reached: ${state.overseasLimit} per squad` };
  }

  const affordability = canAfford(team, amount);
  if (!affordability.ok) return { ok: false, reason: affordability.reason };

  state.currentBid = amount;
  state.leaderId = teamId;
  state.timer = extendOnBid(state.timer, now, ANTI_SNIPE_MS / state.speed);
  state.lastEvent = { type: "bid", teamId, amount };
  return { ok: true };
}

// Called on every server tick. Closes the lot if its timer has run out.
export function tick(state, now) {
  if (state.status !== "live" || state.paused) return null;
  if (!isExpired(state.timer, now)) return null;

  const closed = state.current;
  let outcome;
  if (state.leaderId) {
    const team = state.teams[state.leaderId];
    team.purse -= state.currentBid;
    team.squad.push(closed);
    state.unsoldHistory = state.unsoldHistory.filter((p) => p.id !== closed.id);
    state.sold.push({ player: closed, teamId: team.id, price: state.currentBid });
    outcome = { type: "sold", playerId: closed.id, name: closed.name, teamId: team.id, price: state.currentBid };
  } else {
    state.unsold.push(closed);
    if (!state.unsoldHistory.some((p) => p.id === closed.id)) state.unsoldHistory.push(closed);
    outcome = { type: "unsold", playerId: closed.id, name: closed.name };
  }
  state.lastEvent = outcome;
  state.closeSeq += 1;
  state.lastClose = { ...outcome, id: state.closeSeq };
  advance(state, now);
  return outcome;
}

// Teams that finished below the minimum squad size. Empty list means all good.
export function squadShortfalls(state) {
  return Object.values(state.teams)
    .filter((t) => t.squad.length < MIN_SQUAD)
    .map((t) => ({ teamId: t.id, have: t.squad.length, need: MIN_SQUAD }));
}

// Add a team that was not claimed at start (teams can be claimed mid-auction).
export function addTeam(state, teamId, purse = DEFAULT_PURSE) {
  if (state.teams[teamId]) return { ok: false, reason: "team already in auction" };
  state.teams[teamId] = { id: teamId, purse, squad: [] };
  return { ok: true };
}

// Freezes the countdown on the current lot. The time left is kept.
export function pauseAuction(state, now) {
  if (state.status !== "live") return { ok: false, reason: "no auction is running" };
  if (state.paused) return { ok: false, reason: "the auction is already paused" };
  state.paused = true;
  state.pausedLeft = Math.max(0, state.timer.deadline - now);
  return { ok: true };
}

// Restarts the countdown from the time that was left when the auction was paused.
export function resumeAuction(state, now) {
  if (!state.paused) return { ok: false, reason: "the auction is not paused" };
  state.paused = false;
  state.timer = { deadline: now + state.pausedLeft };
  state.pausedLeft = 0;
  return { ok: true };
}

// Host ends the auction early. Remaining lots are left unsold.
export function endAuction(state) {
  if (state.status === "finished") return { ok: false, reason: "already finished" };
  state.status = "finished";
  state.current = null;
  state.timer = null;
  state.lastEvent = { type: "stopped" };
  return { ok: true };
}
