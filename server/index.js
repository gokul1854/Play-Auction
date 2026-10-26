// Express + Socket.IO entry point. Thin on purpose: all logic lives in socket/handlers.js.
// NOTE: this file needs `npm install` to run (express, socket.io). It has not been executed in the build sandbox.

import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRoomStore } from "./store/roomStore.js";
import { createHandlers } from "./socket/handlers.js";

const here = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(here, "data/players.json"), "utf8"));
const PORT = process.env.PORT ?? 3000;
const TICK_MS = 250;

const app = express();
app.use(express.static(join(here, "../client/dist")));

// Health check for the hosting platform.
app.get("/healthz", (req, res) => res.json({ ok: true }));

// Room links like /room/QXJJ2R must load the app, so send index.html for any other page.
app.get("*", (req, res) => {
  res.sendFile(join(here, "../client/dist/index.html"), (err) => {
    if (err) res.status(404).send("Build the client first: npm run build");
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const store = createRoomStore();
const handlers = createHandlers({ store, pool });

// Reject connections that don't identify the player. The client generates this once and keeps it.
io.use((socket, next) => {
  const playerId = socket.handshake.auth?.playerId;
  if (typeof playerId !== "string" || playerId.length < 8) {
    return next(new Error("missing playerId"));
  }
  socket.data.session = { playerId, roomCode: null };
  next();
});

function syncRooms(socket, code) {
  // Keep this socket subscribed only to its current room.
  for (const joined of socket.rooms) {
    if (joined !== socket.id && joined !== code) socket.leave(joined);
  }
  if (code) socket.join(code);
}

function broadcast(code) {
  const snapshot = handlers.snapshot(code);
  if (snapshot) io.to(code).emit("room:state", snapshot);
}

io.on("connection", (socket) => {
  const session = socket.data.session;

  // Re-subscribe on reconnect if this player was already in a room.
  if (session.roomCode) {
    socket.join(session.roomCode);
    broadcast(session.roomCode);
  }

  socket.onAny((type, payload, ack) => {
    const result = handlers.dispatch(session, type, payload ?? {});
    const { roomCode, ...reply } = result;
    if (typeof ack === "function") {
      ack(type === "room:create" && result.ok ? { ...reply, roomCode } : reply);
    }

    syncRooms(socket, session.roomCode);
    if (result.ok && session.roomCode) broadcast(session.roomCode);
    // A removed player leaves the room channel and is told why.
    if (result.ok && result.kicked) {
      for (const other of io.sockets.sockets.values()) {
        if (other.data.session?.playerId === result.kicked) {
          other.data.session.roomCode = null;
          other.leave(result.roomCode);
          other.emit("room:kicked");
        }
      }
    }
    if (result.ok && type === "room:leave") socket.emit("room:state", null);
  });

  socket.on("disconnect", () => {
    const code = handlers.disconnect(session);
    if (code) broadcast(code);
  });
});

// Drives the auction clock for every live room.
setInterval(() => {
  for (const code of handlers.tickAll(Date.now())) broadcast(code);
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`Auction server listening on http://localhost:${PORT}`);
});
