import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validate, CAREER_FROM } from "../../tools/import-players.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const HEAD = "name,country,role,category,pool,career_end,matches,runs";

test("a career that ended in 2000 or later is accepted", () => {
  const { players, errors } = validate(`${HEAD}\nRecent,India,Batter,Capped,IPL,2015,100,4000\n`);
  assert.deepEqual(errors, []);
  assert.equal(players[0].career_end, 2015);
});

test("a career that ended before 2000 is refused", () => {
  const { errors } = validate(`${HEAD}\nOld Timer,India,Batter,Legend,Legends,1990,100,4000\n`);
  assert.ok(errors.some((e) => /before 2000/.test(e)));
});

test("the cut-off year is 2000", () => {
  assert.equal(CAREER_FROM, 2000);
});

test("the player list has no career that ended before 2000", () => {
  const players = JSON.parse(readFileSync(join(here, "../data/players.json"), "utf8"));
  const early = players.filter((p) => p.career_end != null && p.career_end < CAREER_FROM);
  assert.equal(early.length, 0);
});

test("the removed players are recorded in the audit file", () => {
  const audit = readFileSync(join(here, "../../tools/removed-players.txt"), "utf8");
  assert.ok(audit.includes("Sunil Gavaskar"));
  assert.ok(audit.split("\n").filter(Boolean).length === 31);
});
