// Tournament: every team plays every other team once (league), then the top four go to playoffs
// in the IPL format. With two or three teams, the top two play a final.
// Matches use the same simulator as single matches, so results come from squad strength.

import { simulateMatch, XI_SIZE, validatePlayingXI } from "./sim.js";

export const POINTS = { win: 2, tie: 1, loss: 0 };

export function normaliseTournamentFormat(format = "league-playoffs") {
  const value = String(format ?? "league-playoffs").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (["knockout", "single-elimination", "single-elimination", "four-team-knockout"].includes(value)) return "knockout";
  if (["double-elimination", "double-elim", "winner-loser", "winners-losers", "winners-loser"].includes(value)) return "double-elimination";
  return "league-playoffs";
}

export function createKnockoutFixtures(codes) {
  const list = [...codes];
  if (list.length <= 1) return [];
  if (list.length === 2) return [{ stage: "final", home: list[0], away: list[1] }];
  if (list.length === 3) {
    return [
      { stage: "semi-final", home: list[0], away: list[1] },
      { stage: "final", home: list[2], away: null },
    ];
  }

  const fixtures = [
    { stage: "match 1", home: list[0], away: list[1] },
    { stage: "match 2", home: list[2], away: list[3] },
  ];
  fixtures.push({ stage: "third-place", home: null, away: null });
  fixtures.push({ stage: "final", home: null, away: null });
  return fixtures;
}

export function createDoubleEliminationFixtures(codes) {
  const list = [...codes];
  if (list.length < 2) return [];
  const winners = [];
  const losers = [];
  for (let i = 0; i < list.length; i += 2) {
    const home = list[i];
    const away = list[i + 1] ?? null;
    if (away) {
      winners.push({ stage: "winner bracket", home, away });
      losers.push({ stage: "loser bracket", home, away });
    }
  }
  winners.push({ stage: "winner final", home: null, away: null });
  losers.push({ stage: "loser final", home: null, away: null });
  winners.push({ stage: "grand final", home: null, away: null });
  return [...winners, ...losers];
}

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
export function runTournament({ teams, rng = Math.random, format = "league-playoffs" }) {
  if (!Array.isArray(teams) || teams.length < 2) return { error: "a tournament needs at least two teams" };
  const squads = Object.fromEntries(teams.map((t) => [t.code, t.squad]));
  const codes = teams.map((t) => t.code);
  const rows = Object.fromEntries(codes.map((c) => [c, blankRow(c)]));
  let nextId = 1;
  const formatName = normaliseTournamentFormat(format);

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

  let table = sortTable(rows);
  const playoffs = [];
  let champion = null;

  if (formatName === "knockout") {
    const bracket = createKnockoutFixtures(codes);
    for (let i = 0; i < bracket.length; i++) {
      const fixture = bracket[i];
      if (!fixture.home || !fixture.away) {
        if (fixture.stage === "third-place") {
          const previous = playoffs.slice(-2);
          const loserA = previous[0]?.winner && previous[0].winner !== previous[0].home ? previous[0].home : previous[0]?.away;
          const loserB = previous[1]?.winner && previous[1].winner !== previous[1].home ? previous[1].home : previous[1]?.away;
          if (loserA && loserB) {
            const m = play("third-place", loserA, loserB);
            playoffs.push(m);
            recordResult(rows, m);
            continue;
          }
        }
        if (fixture.stage === "final") {
          const winners = playoffs.filter((m) => m.stage === "match 1" || m.stage === "match 2").map((m) => m.winner).filter(Boolean);
          const [home, away] = winners;
          if (home && away) {
            const m = play("final", home, away);
            playoffs.push(m);
            recordResult(rows, m);
            champion = decideWinner(m, table);
            continue;
          }
        }
        continue;
      }
      const m = play(fixture.stage, fixture.home, fixture.away);
      playoffs.push(m);
      recordResult(rows, m);
    }
    table = sortTable(rows);
    champion = champion ?? (playoffs.at(-1)?.winner ?? null);
  } else if (formatName === "double-elimination") {
    const bracket = createDoubleEliminationFixtures(codes);
    for (const fixture of bracket) {
      if (!fixture.home || !fixture.away) continue;
      const m = play(fixture.stage, fixture.home, fixture.away);
      playoffs.push(m);
      recordResult(rows, m);
    }
    table = sortTable(rows);
    champion = playoffs.at(-1)?.winner ?? null;
  } else if (table.length >= 4) {
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
    league: formatName === "league-playoffs" ? league : [],
    playoffs,
    champion,
    table: table.map((r, i) => ({ ...r, position: i + 1, nrr: Number(netRunRate(r).toFixed(2)) })),
    format: formatName,
  };
}

// Recording helper used by the tournament: shared with tests.
export { recordResult, blankRow };
