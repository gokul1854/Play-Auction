// Maps client intents to room actions. Transport-agnostic: the Socket.IO layer just calls dispatch().
// Identity comes from `session.playerId`, which the client generates once and keeps in localStorage.

import {
  createRoom, joinRoom, leaveRoom, markDisconnected, claimTeam, releaseTeam,
  startRoom, stopRoom, placeBid, tickRoom, sendChat, publicState, runSim, setBidWindow, setSpeed, setLotOrder, setTeamSet, runTournamentRoom,
  pauseRoom, resumeRoom, setOverseas, kickMember,
} from "../engine/room.js";

const BID_LIMIT = { max: 4, windowMs: 1000 };
const CHAT_LIMIT = { max: 10, windowMs: 5000 };
const NAME_MAX = 16;

// Sliding-window rate limit. Returns true if the action is allowed.
function allow(history, key, now, { max, windowMs }) {
  const times = (history.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= max) {
    history.set(key, times);
    return false;
  }
  times.push(now);
  history.set(key, times);
  return true;
}

function cleanName(raw) {
  const name = String(raw ?? "").trim().slice(0, NAME_MAX);
  return name.length ? name : null;
}

export function createHandlers({ store, pool }) {
  const bidHistory = new Map();
  const chatHistory = new Map();

  function roomFor(session) {
    const room = session.roomCode ? store.get(session.roomCode) : null;
    if (!room) return { error: "you are not in a room" };
    if (!room.members[session.playerId]) {
      session.roomCode = null;
      return { error: "you are no longer in this room" };
    }
    return { room };
  }

  function leaveCurrent(session) {
    const { room } = roomFor(session);
    if (!room) { session.roomCode = null; return; }
    leaveRoom(room, session.playerId);
    session.roomCode = null;
    if (Object.keys(room.members).length === 0) store.remove(room.code);
  }

  const commands = {
    "rooms:browse": () => {
      const list = store.list()
        .filter((r) => r.visibility === "public" && r.status !== "finished")
        .map((r) => ({
          code: r.code,
          hostName: r.members[r.hostId]?.name ?? "Host",
          players: Object.keys(r.members).length,
          teamsFilled: Object.keys(r.claims).length,
          status: r.status,
          mode: r.mode,
        }));
      return { ok: true, data: list };
    },

    "room:create": (session, payload, now) => {
      const name = cleanName(payload.name);
      if (!name) return { ok: false, error: "enter a name" };
      const visibility = payload.visibility === "public" ? "public" : "private";
      leaveCurrent(session);
      const room = store.create((code) =>
        createRoom({ code, host: { id: session.playerId, name }, visibility, mode: payload.mode, teamSet: payload.teamSet, now })
      );
      session.roomCode = room.code;
      return { ok: true, roomCode: room.code };
    },

    "room:join": (session, payload, now) => {
      const code = String(payload.code ?? "").trim().toUpperCase();
      const room = store.get(code);
      if (!room) return { ok: false, error: "room not found" };
      const name = cleanName(payload.name) ?? room.members[session.playerId]?.name;
      if (!name) return { ok: false, error: "enter a name" };
      if (session.roomCode !== code) leaveCurrent(session);
      const result = joinRoom(room, { id: session.playerId, name });
      if (!result.ok) return result;
      session.roomCode = code;
      return { ok: true, roomCode: code };
    },

    "room:leave": (session) => {
      leaveCurrent(session);
      return { ok: true };
    },

    "room:state": (session) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ok: true, roomCode: room.code };
    },

    "team:claim": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...claimTeam(room, session.playerId, payload.teamId), roomCode: room.code };
    },

    "team:release": (session) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...releaseTeam(room, session.playerId), roomCode: room.code };
    },

    "room:start": (session, payload, now) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      if (session.playerId !== room.hostId) return { ok: false, error: "only the host can start" };
      const result = startRoom(room, { pool: pool.map((p) => ({ ...p })), now, force: !!payload.force });
      return { ...result, roomCode: room.code };
    },

    "room:stop": (session) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...stopRoom(room, session.playerId), roomCode: room.code };
    },

    "auction:bid": (session, payload, now) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      if (!Number.isInteger(payload.amount)) return { ok: false, error: "bid must be a whole number of units" };
      if (!allow(bidHistory, session.playerId, now, BID_LIMIT)) return { ok: false, error: "slow down" };
      return { ...placeBid(room, session.playerId, payload.amount, now), roomCode: room.code };
    },

    "sim:run": (session, payload, now) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...runSim(room, { home: payload.home, away: payload.away, now }), roomCode: room.code };
    },

    "room:settings": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...setBidWindow(room, session.playerId, Number(payload.bidWindowMs)), roomCode: room.code };
    },

    "tournament:run": (session, payload, now) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...runTournamentRoom(room, { now }), roomCode: room.code };
    },

    // Full ball-by-ball detail for one tournament match, opened from the fixture list.
    "tournament:match": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      const t = room.tournament;
      const id = Number(payload.id);
      const match = t && [...t.league, ...t.playoffs].find((m) => m.id === id);
      if (!match) return { ok: false, error: "match not found" };
      return { ok: true, match };
    },

    "room:speed": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...setSpeed(room, session.playerId, Number(payload.speed)), roomCode: room.code };
    },

    "room:order": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...setLotOrder(room, session.playerId, payload.order), roomCode: room.code };
    },

    "room:teamSet": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...setTeamSet(room, session.playerId, payload.teamSet), roomCode: room.code };
    },

    "auction:pause": (session, payload, now) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...pauseRoom(room, session.playerId, now), roomCode: room.code };
    },

    "auction:resume": (session, payload, now) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      return { ...resumeRoom(room, session.playerId, now), roomCode: room.code };
    },

    "room:overseas": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      const limit = payload.limit === null ? null : Number(payload.limit);
      return { ...setOverseas(room, session.playerId, limit), roomCode: room.code };
    },

    "room:kick": (session, payload) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      const target = String(payload.playerId ?? "");
      const r = kickMember(room, session.playerId, target);
      return { ...r, roomCode: room.code, kicked: r.ok ? target : undefined };
    },

    "chat:send": (session, payload, now) => {
      const { room, error } = roomFor(session);
      if (error) return { ok: false, error };
      if (!allow(chatHistory, session.playerId, now, CHAT_LIMIT)) {
        return { ok: false, error: "you're sending messages too fast" };
      }
      return { ...sendChat(room, session.playerId, payload.text, now), roomCode: room.code };
    },
  };

  return {
    dispatch(session, type, payload = {}, now = Date.now()) {
      const command = commands[type];
      if (!command) return { ok: false, error: `unknown event ${type}` };
      return command(session, payload, now);
    },

    // Full state for one room, as it should be sent to clients.
    snapshot(code, now = Date.now()) {
      const room = store.get(code);
      return room ? publicState(room, now) : null;
    },

    // Called when a socket drops. The member keeps their team so they can reconnect.
    disconnect(session) {
      const room = session.roomCode ? store.get(session.roomCode) : null;
      if (room) markDisconnected(room, session.playerId);
      return room ? room.code : null;
    },

    // Advances every live auction. Returns codes of rooms whose state changed.
    tickAll(now = Date.now()) {
      const changed = [];
      for (const room of store.list()) {
        if (room.status !== "live") continue;
        if (tickRoom(room, now)) changed.push(room.code);
      }
      return changed;
    },
  };
}
