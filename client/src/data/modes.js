// Auction modes. The ids must match the server (server/engine/modes.js).
export const MODES = [
  { id: "full", label: "Full auction", desc: "Every player in the list · 4 sets" },
  { id: "ipl", label: "IPL players only", desc: "Players from the IPL pool" },
  { id: "legends", label: "Legends only", desc: "Retired greats · the Legend set" },
];

export const BID_TIMERS = [5, 10, 15, 20, 25]; // seconds
export const SPEEDS = [1, 3, 5, 7, 10];       // auction speed multipliers
