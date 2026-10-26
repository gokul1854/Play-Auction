import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../../tools/import-players.mjs";

const HEAD = "name,country,role,category,pool,matches,runs,hundreds,fifties,not_out,highest,average,strike_rate,balls,wickets,economy,best_bowling,catches,birth_date";

test("the card figures are read and kept as entered", () => {
  const { players, errors } = validate(`${HEAD}\nCard Batter,India,Batter,Capped,IPL,211,6000,10,30,25,193*,35.5,137.2,,,,,40,07/07/81\n`);
  assert.deepEqual(errors, []);
  const p = players[0];
  assert.equal(p.hundreds, 10);
  assert.equal(p.fifties, 30);
  assert.equal(p.not_out, 25);
  assert.equal(p.highest, "193*");
  assert.equal(p.birth_date, "07/07/81");
  assert.equal(p.catches, 40);
});

test("a card figure that is not a number is refused", () => {
  const { errors } = validate(`${HEAD}\nBad Card,India,Batter,Capped,IPL,,,lots,,,,,,,,,,,\n`);
  assert.ok(errors.some((e) => /hundreds must be a number/.test(e)));
});
