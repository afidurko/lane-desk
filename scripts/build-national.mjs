/**
 * Builds public/pfs-national-2026.json: the only physician fee file a public build ships.
 * It is a strict subset of public/pfs-2026.json: national totals only. No locality or GPCI table (so no New York
 * locality amount can be rebuilt from it) and no modifier rows. Component RVUs (w, pn, mp) are kept only for the
 * therapy codes that the multiple-procedure payment reduction applies to. nn marks codes CMS has no office price for.
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
  rows: full.rows
    .filter((row) => row.m === "")
    .map((row) => ({
      c: row.c,
      m: "",
      d: row.d,
      s: row.s,
      tn: row.tn,
      ...(row.nn ? { nn: 1 } : {}),
      ...(row.mu ? { mu: "5", w: row.w, pn: row.pn, mp: row.mp } : {}),
    })),
};
const text = JSON.stringify(slim) + "\n";
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync("public/pfs-national-2026.json", "utf8");
  } catch {
    // no file yet: treated as out of date below
  }
  console.log(current === text ? "pfs-national-2026.json is current" : "pfs-national-2026.json is out of date. Run: node scripts/build-national.mjs");
  process.exit(current === text ? 0 : 1);
}
writeFileSync("public/pfs-national-2026.json", text);
console.log(`wrote public/pfs-national-2026.json with ${slim.rows.length} rows`);
