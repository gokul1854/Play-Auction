// In-memory room store. Swap this for Redis or a database later by keeping the same methods.

import { generateCode } from "../engine/room.js";

export function createRoomStore() {
  const rooms = new Map();

  return {
    get(code) {
      return rooms.get(code) ?? null;
    },
    // Creates a room with a unique code. `build` receives the code and returns the room.
    create(build, rng = Math.random, attempts = 20) {
      for (let i = 0; i < attempts; i++) {
        const code = generateCode(rng);
        if (!rooms.has(code)) {
          const room = build(code);
          rooms.set(code, room);
          return room;
        }
      }
      throw new Error("could not generate a unique room code");
    },
    remove(code) {
      rooms.delete(code);
    },
    list() {
      return [...rooms.values()];
    },
    size() {
      return rooms.size;
    },
  };
}
