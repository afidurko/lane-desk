/**
 * Compares the app with Claims Wedge's independent answer key. Reads the 10 expected files the key wrote
 * (gold_codes, gold_units, gold_allowed_amount for national, rest_of_ny_allowed_internal for Rest of NY) and prices
 * the same codes and units with the app's own pricing. Skips, and says so, if those files are not on this machine.
 * Run: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/answer-key-compare.mjs [dir]
 */
import { existsSync, readFileSync } from "node:fs";
import { indexNational, notOfficeOf, ratesOf } from "../src/lib/pricing/national.ts";
import { localityPrices } from "../src/lib/pricing/locality.ts";
import { allowedOf, fromFile, priceLines, serviceOf } from "../src/lib/desk/clock.ts";

const dir = process.argv[2] ?? "/workspace/collabrios/demo/samples";
if (!existsSync(`${dir}/sample-01-expected.json`)) {
  console.log(JSON.stringify({ skipped: `no answer-key files in ${dir}` }));
  process.exit(0);
}
const read = (name) => JSON.parse(readFileSync(name, "utf8"));
const national = indexNational(read("public/pfs-national-2026.json"));
const NAT = fromFile(ratesOf(national), { mppr: national.mppr, notOffice: notOfficeOf(national) });
const ny = localityPrices(read("public/pfs-2026.json"), "13282/99");
const NY = fromFile(ny.rates, { mppr: ny.mppr, notOffice: ny.notOffice });

const price = (codes, units, rates) => {
  const lines = codes.map((code, i) => ({ code, name: serviceOf(code)?.name ?? code, span: code, units: units[i], allowed: allowedOf(units[i], code, rates) }));
  return Math.round(priceLines(lines, rates).reduce((sum, line) => sum + line.allowed, 0) * 100) / 100;
};

const rows = [];
let bad = 0;
for (let i = 1; i <= 10; i += 1) {
  const gold = read(`${dir}/sample-${String(i).padStart(2, "0")}-expected.json`);
  const codes = gold.gold_codes ?? [];
  const units = (gold.gold_units ?? []).map(Number);
  const nat = codes.length ? price(codes, units, NAT) : 0;
  const nyc = codes.length ? price(codes, units, NY) : 0;
  const okNat = Math.abs(nat - (gold.gold_allowed_amount ?? 0)) < 0.005;
  const okNy = Math.abs(nyc - (gold.rest_of_ny_allowed_internal ?? 0)) < 0.005;
  if (!okNat || !okNy) bad += 1;
  rows.push({ sample: i, codes: codes.join("+") || "none", units: units.join("+") || "-", appNational: nat, keyNational: gold.gold_allowed_amount ?? 0, appRestOfNY: nyc, keyRestOfNY: gold.rest_of_ny_allowed_internal ?? 0, ok: okNat && okNy });
}
console.table(rows);
console.log(JSON.stringify({ samples: rows.length, differences: bad }));
process.exit(bad === 0 ? 0 : 1);
