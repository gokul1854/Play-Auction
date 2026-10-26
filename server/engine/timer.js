// Bid countdown with anti-snipe extension.
// The clock is passed in as `now` (ms) so the engine can be tested without real waiting.

export const BID_WINDOW_MS = 4000;   // time allowed per player before the hammer falls
export const ANTI_SNIPE_MS = 3000;   // a late bid buys this much time back

export function startTimer(now, windowMs = BID_WINDOW_MS) {
  return { deadline: now + windowMs };
}

// A new bid never shortens the timer, but guarantees at least ANTI_SNIPE_MS remaining.
export function extendOnBid(timer, now, antiSnipeMs = ANTI_SNIPE_MS) {
  return { deadline: Math.max(timer.deadline, now + antiSnipeMs) };
}

export function isExpired(timer, now) {
  return now >= timer.deadline;
}

export function remainingMs(timer, now) {
  return Math.max(0, timer.deadline - now);
}
