/**
 * Builds public/pfs-national-2026.json: the only physician fee file a public build ships.
 * It is a strict subset of public/pfs-2026.json: national totals only. No locality or GPCI table (so no New York
 * locality amount can be rebuilt from it), no component RVUs, and no modifier rows.
 * Usage: node scripts/build-national.mjs   (prints the row count; --check exits 1 if the file is out of date)
 */
import { readFileSync, writeFileSync } from "node:fs";

const full = JSON.parse(readFileSync("public/pfs-2026.json", "utf8"));
const slim = {
  family: full.family,
  release: full.release,
  posted: full.posted,
  year: full.year,
  conversion: full.conversion,
  source: full.source,
  rows: full.rows.filter((row) => row.m === "").map((row) => ({ c: row.c, m: "", d: row.d, s: row.s, tn: row.tn })),
};
const text = JSON.stringify(slim) + "\n";
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync("public/pfs-national-2026.json", "utf8");
  } catch {}
  console.log(current === text ? "pfs-national-2026.json is current" : "pfs-national-2026.json is out of date. Run: node scripts/build-national.mjs");
  process.exit(current === text ? 0 : 1);
}
writeFileSync("public/pfs-national-2026.json", text);
console.log(`wrote public/pfs-national-2026.json with ${slim.rows.length} rows`);
