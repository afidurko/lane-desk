/**
 * Adds three flags from the CMS PPRRVU file to every row of public/pfs-YYYY.json:
 *   mu: "5"  the MULT PROC indicator is 5, so therapy multiple-procedure payment reduction applies
 *   nn: 1    the non-facility PE indicator is NA (CMS: rarely or never performed in the office setting; no NF PE RVU developed)
 *   fn: 1    the facility PE indicator is NA
 * Run once per fee release, with the year-end (D) release the app loads. It checks every row against the
 * CMS file (same code, modifier and total RVUs) and stops if anything disagrees.
 * Usage: node scripts/build-flags.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "/workspace/healthcare-pfs/raw/ny_history";
const SOURCES = {
  2020: "2020/RVU20D/extracted/rvu20d-updated-11232020/PPRRVU20_OCT.csv",
  2021: "2021/RVU21D/extracted/rvu21d/PPRRVU21_OCT.csv",
  2022: "2022/RVU22D/extracted/rvu22d/PPRRVU22_OCT.csv",
  2023: "2023/RVU23D/extracted/rvu23d/PPRRVU23_OCT.csv",
  2024: "2024/RVU24D/extracted/rvu24d/PPRRVU24_OCT.csv",
  2025: "2025/RVU25D/extracted/rvu25d-updated-09-11-2025/PPRRVU2025_Oct.csv",
  2026: "2026/RVU26D/extracted/rvu26d-updated-08-26-2026/PPRRVU2026_Oct_nonQPP.csv",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const check = process.argv.includes("--check");
let stale = 0;
const summary = [];
for (const [year, rel] of Object.entries(SOURCES)) {
  const csv = parseCsv(readFileSync(`${BASE}/${rel}`, "latin1"));
  const head = csv.findIndex((r) => r[0] === "HCPCS");
  if (head < 0 || csv[head][18] !== "PROC" || csv[head][7] !== "INDICATOR") throw new Error(`${year}: unexpected CMS layout`);
  const byKey = new Map();
  for (const r of csv.slice(head + 1)) if (r[0]) byKey.set(`${r[0].trim()}|${r[1].trim()}`, r);

  const path = `public/pfs-${year}.json`;
  const file = JSON.parse(readFileSync(path, "utf8"));
  let mu = 0;
  let nn = 0;
  let fn = 0;
  for (const row of file.rows) {
    const src = byKey.get(`${row.c}|${row.m}`);
    if (!src) throw new Error(`${year} ${row.c}-${row.m}: not in the CMS file`);
    if (Math.abs(Number(src[11]) - row.tn) > 0.0051) throw new Error(`${year} ${row.c}: NF total differs from the CMS file`);
    delete row.mu;
    delete row.nn;
    delete row.fn;
    if (src[18].trim() === "5") (row.mu = "5"), (mu += 1);
    if (src[7].trim() === "NA") (row.nn = 1), (nn += 1);
    if (src[9].trim() === "NA") (row.fn = 1), (fn += 1);
  }
  const text = JSON.stringify(file) + "\n";
  const same = readFileSync(path, "utf8") === text;
  if (!same) stale += 1;
  if (!check) writeFileSync(path, text);
  summary.push({ year, rows: file.rows.length, mppr: mu, nfNA: nn, facNA: fn });
}
console.table(summary);
if (check && stale > 0) {
  console.log("flags are out of date. Run: node scripts/build-flags.mjs");
  process.exit(1);
}
