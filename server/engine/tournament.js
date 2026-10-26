// Tournament: every team plays every other team once (league), then the top four go to playoffs
// in the IPL format. With two or three teams, the top two play a final.
// Matches use the same simulator as single matches, so results come from squad strength.

import { simulateMatch } from "./sim.js";

export const POINTS = { win: 2, tie: 1, loss: 0 };

// Every pair of teams, once each.
export function roundRobin(codes) {
  const pairs = [];
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) pairs.push([codes[i], codes[j]]);
  }
  return pairs;
}

const blankRow = (code) => ({
  code, played: 0, won: 0, lost: 0, tied: 0, points: 0,
  runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0,
});

// Net run rate, simplified: runs per over scored minus runs per over conceded.
export function netRunRate(row) {
  const perOver = (runs, balls) => (balls ? runs / (balls / 6) : 0);
  return perOver(row.runsFor, row.ballsFor) - perOver(row.runsAgainst, row.ballsAgainst);
}

function recordResult(rows, match) {
  const [first, second] = match.innings;
  const a = rows[first.code], b = rows[second.code];
  a.played++; b.played++;
  a.runsFor += first.runs; a.ballsFor += first.legal; a.runsAgainst += second.runs; a.ballsAgainst += second.legal;
  b.runsFor += second.runs; b.ballsFor += second.legal; b.runsAgainst += first.runs; b.ballsAgainst += first.legal;
  if (match.winner === null) {
    a.tied++; b.tied++; a.points += POINTS.tie; b.points += POINTS.tie;
  } else {
    const w = rows[match.winner];
    const l = match.winner === a.code ? b : a;
    w.won++; l.lost++; w.points += POINTS.win;
  }
}

// Table order: points, then net run rate, then team code so the order is always the same.
export function sortTable(rows) {
  return Object.values(rows).sort(
    (x, y) => y.points - x.points || netRunRate(y) - netRunRate(x) || x.code.localeCompare(y.code)
  );
}

// Winner of a match. A tie in a playoff goes to the team placed higher in the league table.
export function decideWinner(match, table) {
  if (match.winner !== null) return match.winner;
  const a = table.findIndex((r) => r.code === match.home);
  const b = table.findIndex((r) => r.code === match.away);
  return a < b ? match.home : match.away;
}

// Plays a tournament. `teams` is [{ code, squad }]. Returns the whole record.
export function runTournament({ teams, rng = Math.random }) {
  if (teams.length < 2) return { error: "a tournament needs at least two teams" };
  const squads = Object.fromEntries(teams.map((t) => [t.code, t.squad]));
  const codes = teams.map((t) => t.code);
  const rows = Object.fromEntries(codes.map((c) => [c, blankRow(c)]));
  let nextId = 1;

  const play = (stage, home, away) => {
    const result = simulateMatch({
      home: { code: home, squad: squads[home] },
      away: { code: away, squad: squads[away] },
      rng,
    });
    return { id: nextId++, stage, home, away, ...result };
  };

  const league = roundRobin(codes).map(([h, a]) => {
    const m = play("league", h, a);
    recordResult(rows, m);
    return m;
  });

  const table = sortTable(rows);
  const playoffs = [];
  let champion = null;

  if (table.length >= 4) {
    const [t1, t2, t3, t4] = table.map((r) => r.code);
    const q1 = play("qualifier 1", t1, t2);
    const el = play("eliminator", t3, t4);
    const winQ1 = decideWinner(q1, table);
    const winEl = decideWinner(el, table);
    const loseQ1 = winQ1 === q1.home ? q1.away : q1.home;
    const q2 = play("qualifier 2", loseQ1, winEl);
    const winQ2 = decideWinner(q2, table);
    const fin = play("final", winQ1, winQ2);
    playoffs.push(q1, el, q2, fin);
    champion = decideWinner(fin, table);
  } else if (table.length >= 2) {
    const fin = play("final", table[0].code, table[1].code);
    playoffs.push(fin);
    champion = decideWinner(fin, table);
  }

  return {
    league,
    playoffs,
    champion,
    table: table.map((r, i) => ({ ...r, position: i + 1, nrr: Number(netRunRate(r).toFixed(2)) })),
  };
}

// Recording helper used by the tournament: shared with tests.
export { recordResult, blankRow };
