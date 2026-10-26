// Imports a player list from CSV into server/data/players.json.
//
// Usage:  node tools/import-players.mjs path/to/players.csv [--min 500] [--dry-run]
//
// CSV columns (header row required):  name,country,role,category,pool
//   role:     Batter | Bowler | All-rounder | Keeper
//   category: Legend | Marquee | Capped | Uncapped
//   pool:     IPL | International | Test | Legends
// Base prices are set from the category, as in the rest of the app.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "../server/data/players.json");

const CATEGORIES = { Legend: 150, Marquee: 100, Capped: 50, Uncapped: 25 };
const ROLES = ["Batter", "Bowler", "All-rounder", "Keeper"];
const POOLS = ["IPL", "International", "Test", "Legends"];
const REQUIRED = ["name", "country", "role", "category", "pool"];
// Optional career figures. Leave a cell empty if you do not have the number. Nothing is invented.
// Players must have a career that reaches 2000 or later. Earlier careers are refused.
export const CAREER_FROM = 2000;
const NUMERIC_STATS = ["matches", "runs", "average", "strike_rate", "hundreds", "fifties", "not_out", "wickets", "balls", "economy", "catches", "career_end"];
const TEXT_STATS = ["best_bowling", "highest", "birth_date"];

// Splits one CSV line, allowing quoted fields such as "Smith, Steve".
export function parseLine(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// Returns { players, errors } where players are ready for the app.
export function validate(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return { players: [], errors: ["the file has no player rows"] };
  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { players: [], errors: [`missing columns: ${missing.join(", ")}`] };

  const idx = Object.fromEntries(REQUIRED.map((c) => [c, header.indexOf(c)]));
  const statIdx = Object.fromEntries([...NUMERIC_STATS, ...TEXT_STATS].map((c) => [c, header.indexOf(c)]));
  const errors = [];
  const seen = new Set();
  const players = [];
  lines.slice(1).forEach((line, n) => {
    const row = parseLine(line);
    const p = Object.fromEntries(REQUIRED.map((c) => [c, row[idx[c]] ?? ""]));
    const where = `row ${n + 2}`;
    if (!p.name) errors.push(`${where}: name is empty`);
    if (seen.has(p.name.toLowerCase())) errors.push(`${where}: duplicate name "${p.name}"`);
    if (!ROLES.includes(p.role)) errors.push(`${where}: unknown role "${p.role}"`);
    if (!CATEGORIES[p.category]) errors.push(`${where}: unknown category "${p.category}"`);
    if (!POOLS.includes(p.pool)) errors.push(`${where}: unknown pool "${p.pool}"`);
    if (!p.name || !ROLES.includes(p.role) || !CATEGORIES[p.category] || !POOLS.includes(p.pool)) return;
    seen.add(p.name.toLowerCase());
    const stats = {};
    for (const c of NUMERIC_STATS) {
      const raw = statIdx[c] >= 0 ? (row[statIdx[c]] ?? "").trim() : "";
      if (raw === "") { stats[c] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) { errors.push(`${where}: ${c} must be a number, got "${raw}"`); stats[c] = null; continue; }
      if (c === "career_end" && n < CAREER_FROM) { errors.push(`${where}: career ended in ${n}, before ${CAREER_FROM}, so the player is not allowed`); }
      stats[c] = n;
    }
    for (const c of TEXT_STATS) {
      const raw = statIdx[c] >= 0 ? (row[statIdx[c]] ?? "").trim() : "";
      stats[c] = raw === "" ? null : raw;
    }
    players.push({
      id: `p${String(players.length + 1).padStart(4, "0")}`,
      name: p.name, country: p.country || "-", role: p.role, category: p.category, pool: p.pool,
      basePrice: CATEGORIES[p.category],
      matches: stats.matches, runs: stats.runs, wickets: stats.wickets, average: stats.average,
      strike_rate: stats.strike_rate, hundreds: stats.hundreds, fifties: stats.fifties, not_out: stats.not_out,
      balls: stats.balls, catches: stats.catches, economy: stats.economy, best_bowling: stats.best_bowling,
      highest: stats.highest, birth_date: stats.birth_date, career_end: stats.career_end,
    });
  });
  return { players, errors };
}

// Writes a player list back out as CSV, with every column the importer reads.
export function toCsv(players) {
  const cols = ["name", "country", "role", "category", "pool", ...NUMERIC_STATS, ...TEXT_STATS];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [cols.join(","), ...players.map((p) => cols.map((c) => esc(p[c])).join(","))].join("\n") + "\n";
}

export function countByCategory(players) {
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, 0]));
  for (const p of players) counts[p.category]++;
  return counts;
}

// Command-line use.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const minIndex = args.indexOf("--min");
  const min = minIndex >= 0 ? Number(args[minIndex + 1]) : 500;
  const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--min");
  const dry = args.includes("--dry-run");
  if (!file) {
    console.error("Usage: node tools/import-players.mjs players.csv [--min 500] [--dry-run]");
    process.exit(1);
  }
  const { players, errors } = validate(readFileSync(file, "utf8"));
  if (errors.length) {
    console.error(`Found ${errors.length} problem(s). Nothing was written:`);
    errors.slice(0, 20).forEach((e) => console.error("  - " + e));
    process.exit(1);
  }
  const counts = countByCategory(players);
  console.log("Players per category:", counts);
  const short = Object.entries(counts).filter(([, n]) => n < min);
  if (short.length) {
    console.error(`Below the minimum of ${min} in: ${short.map(([c, n]) => `${c} (${n})`).join(", ")}. Nothing was written.`);
    process.exit(1);
  }
  if (dry) { console.log("Dry run: file is valid. Nothing was written."); process.exit(0); }
  writeFileSync(OUT, JSON.stringify(players, null, 2));
  console.log(`Wrote ${players.length} players to server/data/players.json`);
}
