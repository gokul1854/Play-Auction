import { io } from "socket.io-client";

// The player ID is generated once per browser and kept in localStorage.
// It identifies you across refreshes and reconnects. It is not a login.
const KEY_ID = "auction.playerId";
const KEY_NAME = "auction.name";

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getPlayerId() {
  try {
    let id = localStorage.getItem(KEY_ID);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY_ID, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function getName() {
  try { return localStorage.getItem(KEY_NAME) || ""; } catch { return ""; }
}

export function setName(name) {
  try { localStorage.setItem(KEY_NAME, name); } catch { /* private mode, fine */ }
}

export const playerId = getPlayerId();
export const socket = io({ auth: { playerId }, autoConnect: true });

// Sends an event and resolves with the server's reply. Never waits on an offline socket.
export function send(type, payload = {}) {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, error: "Not connected to the server. Check your connection and try again." });
      return;
    }

    socket.timeout(8000).emit(type, payload, (error, reply) => {
      if (error) {
        resolve({ ok: false, error: "The server did not respond. Please try again." });
      } else if (!reply || typeof reply !== "object") {
        resolve({ ok: false, error: "The server returned an invalid response." });
      } else {
        resolve(reply);
      }
    });
  });
}
