/**
 * Price proof. Recomputes every physician fee schedule price two ways and compares them.
 *
 *   1. The app's own path: src/lib/pricing/national.ts (what the screens show).
 *   2. An independent recompute from the file's component RVUs: (work + non-facility practice
 *      expense + malpractice) times the file's conversion factor, rounded to the cent.
 *
 * Public output (public/proof.json): national, non-facility, non-QP, every year 2020 to 2026.
 * Internal output (public/proof-internal.json): Rest of NY locality 99 against the year files and the
 * typed-in therapy table. The public build prunes the internal file.
 *
 * Usage: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/price-proof.mjs [--check]
 * --check exits 1 on any mismatch and does not write files.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { indexNational } from "../src/lib/pricing/national.ts";
import { THERAPY } from "../src/lib/desk/therapy-codes.ts";

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const PAYABLE = new Set(["A", "R", "T"]);
const read = (name) => JSON.parse(readFileSync(name, "utf8"));
const cents = (dollars) => Math.round(dollars * 100 + 1e-9);

const publicYears = [];
const internalYears = [];
let totalMismatch = 0;

for (const year of YEARS) {
  const file = read(`public/pfs-${year}.json`);
  const cf = Number(file.conversion.nonQp);
  const national = indexNational(file);
  let checked = 0;
  let priced = 0;
  const bad = [];
  for (const row of file.rows) {
    if (row.m !== "" || !PAYABLE.has(row.s)) continue;
    checked += 1;
    const independent = cents(Math.round((row.w + row.pn + row.mp) * 100 + 1e-9) / 100 * cf);
    const app = national.rows.get(row.c.toUpperCase())?.a[String(year)] ?? null;
    if (app !== null) priced += 1;
    const expected = independent > 0 ? independent : null;
    if (app !== expected) bad.push(row.c);
  }
  totalMismatch += bad.length;
  publicYears.push({ year, release: file.release, conversionFactor: file.conversion.nonQp, codesChecked: checked, codesPriced: priced, mismatches: bad.length, firstMismatches: bad.slice(0, 5) });

  // Internal: Rest of New York, 13282/99, against the year shard the Code screen reads.
  const place = file.localities.find((item) => item.mac === "13282" && item.number === "99");
  let nyChecked = 0;
  let nyBad = 0;
  const shards = new Map();
  const shardOf = (code) => {
    const key = code[0];
    if (!shards.has(key)) {
      try {
        shards.set(key, read(`public/years/physician/${key}.json`));
      } catch {
        shards.set(key, {});
      }
    }
    return shards.get(key);
  };
  for (const row of file.rows) {
    if (row.m !== "" || !PAYABLE.has(row.s) || !place) continue;
    const total = row.w * place.work + row.pn * place.pe + row.mp * place.mp;
    const independent = cents(total * cf);
    const shown = shardOf(row.c.toUpperCase())[row.c.toUpperCase()]?.a?.[String(year)] ?? null;
    nyChecked += 1;
    if (shown !== (independent > 0 ? independent : null)) nyBad += 1;
  }
  internalYears.push({ year, locality: "13282/99", codesChecked: nyChecked, mismatches: nyBad });
  totalMismatch += nyBad;
}

// Typed-in therapy table against the 2026 file, Rest of NY.
const f26 = read("public/pfs-2026.json");
const place26 = f26.localities.find((item) => item.mac === "13282" && item.number === "99");
let tableBad = 0;
const tableDetail = [];
for (const item of THERAPY) {
  const row = f26.rows.find((r) => r.c === item.code && r.m === "");
  const dollars = row && PAYABLE.has(row.s) ? Math.round((row.w * place26.work + row.pn * place26.pe + row.mp * place26.mp) * Number(f26.conversion.nonQp) * 100 + 1e-9) / 100 : 0;
  const expected = item.separate ? dollars : 0;
  if (cents(expected) !== cents(item.unitDollars)) {
    tableBad += 1;
    tableDetail.push(item.code);
  }
}
totalMismatch += tableBad;

// Negative control: a price nudged by one cent in memory must be caught by the same comparison.
const control = structuredClone(f26);
const target = control.rows.find((r) => r.c === "97110" && r.m === "");
target.tn = Math.round((target.tn + 0.01) * 100) / 100;
const controlApp = indexNational(control).rows.get("97110").a["2026"];
const controlIndependent = cents(Math.round((target.w - 0 + target.pn + target.mp) * 100 + 1e-9) / 100 * Number(control.conversion.nonQp));
const controlCaught = controlApp !== controlIndependent;
if (!controlCaught) totalMismatch += 1;

const generated = new Date().toISOString().slice(0, 10);
const publicOut = {
  generated,
  what: "National Medicare physician fee schedule, non-facility, non-QP. Each price the app shows was recomputed from the file's component RVUs and the file's conversion factor.",
  years: publicYears,
  negativeControlCaught: controlCaught,
  totals: {
    years: publicYears.length,
    codesChecked: publicYears.reduce((n, y) => n + y.codesChecked, 0),
    mismatches: publicYears.reduce((n, y) => n + y.mismatches, 0),
  },
};
const internalOut = {
  generated,
  what: "Rest of New York, MAC 13282, locality 99. Year files the Code screen reads, and the therapy table used by the note coder.",
  years: internalYears,
  therapyTable: { codes: THERAPY.length, mismatches: tableBad, codes_off: tableDetail },
};

console.log(JSON.stringify({ national: publicOut.totals, negativeControlCaught: controlCaught, rest_of_ny_mismatches: internalYears.reduce((n, y) => n + y.mismatches, 0), therapyTable: internalOut.therapyTable, totalMismatch }));
if (process.argv.includes("--check")) process.exit(totalMismatch === 0 ? 0 : 1);
writeFileSync("public/proof.json", JSON.stringify(publicOut, null, 2) + "\n");
writeFileSync("public/proof-internal.json", JSON.stringify(internalOut, null, 2) + "\n");
