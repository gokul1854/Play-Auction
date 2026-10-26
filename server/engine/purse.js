// All money is stored as integers in hundredths of a crore.
// 1 Cr = 100 units, so 3.25 Cr = 325. This avoids float rounding errors.

export const UNITS_PER_CR = 100;
export const DEFAULT_PURSE = 120 * UNITS_PER_CR; // 120 Cr
export const BID_INCREMENT = 25;                 // 0.25 Cr
export const MIN_SQUAD = 15;
export const MAX_SQUAD = 25;
export const MIN_BASE_PRICE = 30;                // cheapest possible base, used for reserve maths

export function toUnits(crore) {
  return Math.round(crore * UNITS_PER_CR);
}

export function formatCr(units) {
  return `${(units / UNITS_PER_CR).toFixed(2)} Cr`;
}

// The next valid bid for a player. With no bids yet, the opening bid is the base price.
export function nextBid(currentBid, basePrice) {
  if (currentBid == null) return basePrice;
  return currentBid + BID_INCREMENT;
}

// Purse a team must keep aside so it can still reach MIN_SQUAD after this purchase.
// Each remaining required player is assumed to cost at least MIN_BASE_PRICE.
export function reservedPurse(squadSize, minBasePrice = MIN_BASE_PRICE) {
  const stillNeeded = Math.max(0, MIN_SQUAD - squadSize - 1);
  return stillNeeded * minBasePrice;
}

// Returns { ok: true } or { ok: false, reason } for a team wanting to buy at `amount`.
export function canAfford(team, amount, minBasePrice = MIN_BASE_PRICE) {
  if (team.squad.length >= MAX_SQUAD) {
    return { ok: false, reason: "squad is full" };
  }
  const reserve = reservedPurse(team.squad.length, minBasePrice);
  if (team.purse - amount < reserve) {
    return { ok: false, reason: "not enough purse left to fill the minimum squad" };
  }
  return { ok: true };
}
