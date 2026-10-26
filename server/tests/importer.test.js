import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, toCsv } from "../../tools/import-players.mjs";

const HEAD = "name,country,role,category,pool,matches,runs,wickets,average,strike_rate,economy,best_bowling";

test("career figures are read as numbers and kept as entered", () => {
  const { players, errors } = validate(`${HEAD}\nTest Batter,India,Batter,Capped,IPL,50,1500,0,35.5,140.2,,\n`);
  assert.deepEqual(errors, []);
  assert.equal(players[0].runs, 1500);
  assert.equal(players[0].average, 35.5);
  assert.equal(players[0].strike_rate, 140.2);
  assert.equal(players[0].best_bowling, null);
});

test("best bowling is kept as text, such as 5/22", () => {
  const { players } = validate(`${HEAD}\nTest Bowler,Australia,Bowler,Capped,IPL,,,40,,,7.1,5/22\n`);
  assert.equal(players[0].best_bowling, "5/22");
  assert.equal(players[0].wickets, 40);
});

test("an empty figure stays empty rather than becoming a made-up number", () => {
  const { players } = validate(`${HEAD}\nNo Stats,India,Batter,Capped,IPL,,,,,,,\n`);
  assert.equal(players[0].runs, null);
  assert.equal(players[0].strike_rate, null);
});

test("a figure that is not a number is refused", () => {
  const { errors } = validate(`${HEAD}\nBad,India,Batter,Capped,IPL,,lots,,,,,\n`);
  assert.ok(errors.some((e) => /runs must be a number/.test(e)));
});

test("toCsv writes a list that validates again without changes", () => {
  const original = validate(`${HEAD}\nRound Trip,India,All-rounder,Marquee,IPL,80,2000,60,30.1,135.5,7.8,4/18\n`).players;
  const again = validate(toCsv(original)).players;
  assert.deepEqual(again.map((p) => [p.name, p.runs, p.wickets, p.best_bowling]), [["Round Trip", 2000, 60, "4/18"]]);
});
