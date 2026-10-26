// Auction modes. Each mode decides which players go into the auction.
export const MODES = {
  full: { id: "full", label: "Full auction", filter: () => true },
  ipl: { id: "ipl", label: "IPL players only", filter: (p) => p.pool === "IPL" },
  legends: { id: "legends", label: "Legends only", filter: (p) => p.category === "Legend" },
};

export const DEFAULT_MODE = "full";

// Bid timer choices in milliseconds, as offered in room settings.
export const BID_WINDOW_OPTIONS = [5000, 10000, 15000, 20000, 25000];
export const DEFAULT_BID_WINDOW = 10000;

// Auction speed: the bid timer and anti-snipe extension are divided by this number.
export const SPEED_OPTIONS = [1, 3, 5, 7, 10];
export const DEFAULT_SPEED = 1;

// Overseas players allowed per squad. null means no limit.
export const OVERSEAS_OPTIONS = [null, 4, 6, 8];
export const DEFAULT_OVERSEAS = 8;

export function normaliseMode(id) {
  return MODES[id] ? id : DEFAULT_MODE;
}

export function poolFor(modeId, players) {
  const mode = MODES[normaliseMode(modeId)];
  return players.filter(mode.filter);
}
