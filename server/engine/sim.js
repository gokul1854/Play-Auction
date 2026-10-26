// T20-style match simulation between two squads, played ball by ball.
// Real match stats are not loaded, so each player's strength comes from their auction category.
// The model is a rough approximation, not real cricket data. A seeded rng makes results repeatable.

export const RATING = { Legend: 88, Marquee: 80, Capped: 70, Uncapped: 60, Replacement: 50 };
export const XI_SIZE = 11;
const OVERS = 20;
const LEGAL_BALLS = OVERS * 6;
const MAX_BOWLER_OVERS = 4;
const MAX_WICKETS = 10;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function rating(p) {
  if (p.replacement) return RATING.Replacement;
  return RATING[p.category] ?? RATING.Uncapped;
}

// Best 11 by rating. Short squads are padded with replacement players.
export function pickXI(squad) {
  const sorted = [...squad].sort((a, b) => rating(b) - rating(a));
  const xi = sorted.slice(0, XI_SIZE);
  for (let i = xi.length; i < XI_SIZE; i++) {
    xi.push({ name: `Replacement ${i + 1}`, category: "Uncapped", role: "All-rounder", country: "-", replacement: true });
  }
  return xi;
}

// Five bowlers, from bowlers and all-rounders first. Keepers only if there are not enough others.
export function pickBowlers(xi) {
  const primary = xi.filter((p) => p.role === "Bowler" || p.role === "All-rounder");
  const rest = xi.filter((p) => !primary.includes(p) && p.role !== "Keeper");
  const pool = primary.length >= 5 ? primary : [...primary, ...rest];
  return [...pool].sort((a, b) => rating(b) - rating(a)).slice(0, 5);
}

// Career T20 figures, when loaded, make a player's style count. Otherwise the category rating is used.
const T20_STRIKE_RATE = 135;   // typical T20 strike rate
const T20_ECONOMY = 8.2;       // typical T20 economy
function batterFactor(p) {
  const sr = p.formats?.t20i?.strike_rate ?? p.formats?.ipl?.strike_rate;
  return sr ? clamp(sr / T20_STRIKE_RATE, 0.6, 1.5) : 1;
}
function bowlerQuality(p) {
  const econ = p.formats?.t20i?.economy ?? p.formats?.ipl?.economy;
  return econ ? clamp(T20_ECONOMY / econ, 0.6, 1.5) : 1;
}

// Outcome of one delivery. `over` is 0-based; the powerplay (0-5) and the death overs (16-19) are more explosive.
export function ballOutcome(bat, bowl, rng, over = 10) {
  // Extras: a wide or no-ball is not a legal delivery, so the ball is bowled again.
  const extra = rng();
  if (extra < 0.022) return { wide: true, runs: 1, wicket: false, extra: "wide" };
  if (extra < 0.032) return { wide: false, runs: 1, wicket: false, extra: "no ball" };

  const edge = (rating(bat) - rating(bowl)) / 100;
  const bf = batterFactor(bat);
  const wq = bowlerQuality(bowl);
  const boundaryBoost = over < 6 ? 1.12 : over >= 16 ? 1.22 : 1;
  const pWicket = clamp((0.074 - edge * 0.12) * wq / bf, 0.02, 0.14);
  const p4 = clamp((0.118 + edge * 0.1) * bf / wq * boundaryBoost, 0.03, 0.2);
  const p6 = clamp((0.06 + edge * 0.1) * bf / wq * (over >= 16 ? 1.25 : 1), 0.01, 0.14);

  const r = rng();
  if (r < pWicket) return { wide: false, runs: 0, wicket: true };
  const r2 = rng();
  if (r2 < p4) return { wide: false, runs: 4, wicket: false };
  if (r2 < p4 + p6) return { wide: false, runs: 6, wicket: false };
  const r3 = rng();
  const runs = r3 < 0.38 ? 0 : r3 < 0.8 ? 1 : r3 < 0.92 ? 2 : 3;
  return { wide: false, runs, wicket: false };
}

// Plays one innings. Stops at 10 wickets, 20 overs, or when `target` is reached.
export function playInnings({ batting, bowlers, rng, target = null }) {
  const bat = new Map(batting.map((p) => [p.name, { name: p.name, runs: 0, balls: 0, out: false }]));
  const bowl = new Map(bowlers.map((p) => [p.name, { name: p.name, balls: 0, runs: 0, wickets: 0 }]));
  const overs = new Map(bowlers.map((p) => [p.name, 0]));
  const log = [];

  let runs = 0, wickets = 0, legal = 0, ballsInOver = 0;
  let striker = 0, nonStriker = 1, nextBat = 2;
  let prevBowler = null, bowler = bowlers[0], newOver = true;

  const pickBowler = (over) => {
    const n = bowlers.length;
    for (let i = 0; i < n; i++) {
      const cand = bowlers[(over + i) % n];
      if (overs.get(cand.name) < MAX_BOWLER_OVERS && cand.name !== prevBowler) return cand;
    }
    return bowlers.find((b) => overs.get(b.name) < MAX_BOWLER_OVERS) ?? bowlers[over % n];
  };

  while (legal < LEGAL_BALLS && wickets < MAX_WICKETS) {
    if (target !== null && runs >= target) break;
    const over = Math.floor(legal / 6);
    // Choose the bowler once per over. A wide on the first ball must not start the over twice.
    if (newOver) {
      bowler = pickBowler(over);
      overs.set(bowler.name, overs.get(bowler.name) + 1);
      newOver = false;
    }
    const batter = batting[striker];
    const b = bowl.get(bowler.name);
    const s = bat.get(batter.name);
    const out = ballOutcome(batter, bowler, rng, over);
    const label = `${over}.${ballsInOver + 1}`;

    if (out.wide || out.extra === "no ball") {
      runs += 1; b.runs += 1;
      log.push({ over: label, runs: 1, wicket: false, text: `${out.extra === "wide" ? "Wide" : "No ball"}, ${bowler.name}. +1` });
      continue;
    }

    legal += 1; ballsInOver += 1;
    s.balls += 1; b.balls += 1;

    if (out.wicket) {
      wickets += 1; s.out = true; b.wickets += 1;
      log.push({ over: label, runs: 0, wicket: true, text: `Wicket! ${batter.name} out. ${bowler.name} strikes.` });
      if (nextBat < batting.length) striker = nextBat++;
    } else {
      runs += out.runs; s.runs += out.runs; b.runs += out.runs;
      const word = out.runs === 4 ? "FOUR" : out.runs === 6 ? "SIX" : out.runs === 0 ? "dot ball" : `${out.runs} run${out.runs > 1 ? "s" : ""}`;
      log.push({ over: label, runs: out.runs, wicket: false, text: `${bowler.name} to ${batter.name}: ${word}` });
      if (out.runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
    }

    if (ballsInOver === 6) {
      [striker, nonStriker] = [nonStriker, striker];
      ballsInOver = 0;
      prevBowler = bowler.name;
      newOver = true;
    }
  }

  return {
    runs,
    wickets,
    legal,
    overs: `${Math.floor(legal / 6)}.${legal % 6}`,
    batters: [...bat.values()],
    bowlers: [...bowl.values()],
    log,
  };
}

// Plays a full match. `home` and `away` are { code, squad }.
export function simulateMatch({ home, away, rng = Math.random }) {
  const homeXI = pickXI(home.squad);
  const awayXI = pickXI(away.squad);
  const homeBatsFirst = rng() < 0.5;
  const first = homeBatsFirst ? { team: home, xi: homeXI, other: awayXI } : { team: away, xi: awayXI, other: homeXI };
  const second = homeBatsFirst ? { team: away, xi: awayXI, other: homeXI } : { team: home, xi: homeXI, other: awayXI };

  const inn1 = playInnings({ batting: first.xi, bowlers: pickBowlers(first.other), rng });
  const inn2 = playInnings({ batting: second.xi, bowlers: pickBowlers(second.other), rng, target: inn1.runs + 1 });

  let winner = null;
  let text;
  if (inn2.runs > inn1.runs) {
    winner = second.team.code;
    text = `${winner} won by ${MAX_WICKETS - inn2.wickets} wicket${MAX_WICKETS - inn2.wickets === 1 ? "" : "s"}`;
  } else if (inn2.runs < inn1.runs) {
    winner = first.team.code;
    const margin = inn1.runs - inn2.runs;
    text = `${winner} won by ${margin} run${margin === 1 ? "" : "s"}`;
  } else {
    text = "Match tied";
  }

  return {
    toss: { winner: homeBatsFirst ? home.code : away.code, decision: "bat" },
    innings: [
      { code: first.team.code, ...inn1 },
      { code: second.team.code, ...inn2 },
    ],
    winner,
    text,
  };
}
