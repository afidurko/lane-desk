// Regenerates public/history/physician.json and the physician line of public/history/summary.json from the loaded
// pfs-YEAR.json files, using the shared no-dollar rule (non-payable status or CMS non-facility NA gets no office amount).
// Usage: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/build-history.mjs [--check]
import fs from "node:fs";
import { physicianHistory } from "../src/lib/history/physician.ts";

const check = process.argv.includes("--check");
const files = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => JSON.parse(fs.readFileSync(`public/pfs-${year}.json`, "utf8")));
const oldRows = JSON.parse(fs.readFileSync("public/history/physician.json", "utf8"));
const names = new Map(oldRows.map((row) => [row.c, row.n]));
const { moves, summary } = physicianHistory(files);
const rows = moves.map((move) => ({ ...move, n: names.get(move.c) ?? move.n }));
const text = JSON.stringify(rows);
const sum = JSON.parse(fs.readFileSync("public/history/summary.json", "utf8"));
const family = sum.families.find((item) => item.id === "physician");
Object.assign(family, summary, { bytes: Buffer.byteLength(text) });
const sumText = JSON.stringify(sum);
if (check) {
  const same = fs.readFileSync("public/history/physician.json", "utf8") === text && fs.readFileSync("public/history/summary.json", "utf8").trim() === sumText;
  console.log(same ? `history: physician.json matches (${rows.length} rows)` : "history: physician.json is stale, run scripts/build-history.mjs");
  process.exit(same ? 0 : 1);
}
fs.writeFileSync("public/history/physician.json", text);
fs.writeFileSync("public/history/summary.json", sumText);
console.log(`history: wrote ${rows.length} physician rows`, summary);
