/**
 * Compares the app's 2020 New York amounts with the CMS-Codes-checked history database, period 2020D (the release
 * the app loads), for all five localities, non-facility and facility, every code and modifier the database prices.
 * Then spot-checks the year shard the Code screen reads (Rest of NY) and prints the six therapy codes.
 * Usage: node --experimental-sqlite --experimental-strip-types --import ./scripts/register-alias.mjs scripts/check-ny-2020.mjs
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { conversionFor, localityDollars } from "../src/lib/book/price.ts";
import { keyOf, nyLocalities } from "../src/lib/config/ny.ts";

const db = new DatabaseSync(process.env.PFS_NY_DB ?? "/workspace/healthcare-pfs/index/pfs_ny_history.sqlite", { readOnly: true });
const file = JSON.parse(readFileSync("public/pfs-2020.json", "utf8"));
const ny = nyLocalities(file.localities);
const failures = [];
let compared = 0;
if (ny.length !== 5) failures.push(`app offers ${ny.length} NY localities for 2020, expected 5`);

const byKey = new Map(file.rows.map((row) => [`${row.c}|${row.m}`, row]));
const cents = (dollars) => Math.round(dollars * 100 + 1e-9);
for (const place of ny) {
  const rows = db
    .prepare("select hcpcs, mod, nf_amount, f_amount, status, priced from pfs_ny where period_id = '2020D' and contractor = ? and locality = ?")
    .all(place.mac, place.number);
  for (const r of rows) {
    if (!(r.status === "A" || r.status === "R" || r.status === "T")) continue; // anesthesia and unpaid statuses are not amounts
    const row = byKey.get(`${r.hcpcs}|${r.mod ?? ""}`);
    if (!row) {
      failures.push(`${keyOf(place)} ${r.hcpcs}-${r.mod}: not in app file`);
      continue;
    }
    const conversion = conversionFor(row, "nonQp", file);
    for (const [setting, want] of [["nf", r.nf_amount], ["fac", r.f_amount]]) {
      if (want === null || want === undefined) continue;
      compared += 1;
      const got = localityDollars(row, setting, place, conversion);
      if (cents(got) !== cents(want)) failures.push(`${keyOf(place)} ${r.hcpcs}-${r.mod} ${setting}: app ${got} vs database ${want}`);
    }
  }
}

// The year shard the Code screen reads is Rest of NY. Compare every priced non-facility code.
const rest = ny.find((p) => keyOf(p) === "13282/99");
const shardCache = new Map();
const shard = (code) => {
  if (!shardCache.has(code[0])) shardCache.set(code[0], JSON.parse(readFileSync(`public/years/physician/${code[0]}.json`, "utf8")));
  return shardCache.get(code[0]);
};
let shardCompared = 0;
for (const r of db.prepare("select hcpcs, nf_amount, status, nf_na_ind from pfs_ny where period_id = '2020D' and contractor = '13282' and locality = '99' and mod = ''").all()) {
  if (!(r.status === "A" || r.status === "R" || r.status === "T")) continue;
  const entry = shard(r.hcpcs)[r.hcpcs];
  const shown = entry?.a?.["2020"];
  shardCompared += 1;
  const noOffice = entry?.o?.includes(2020);
  if (r.nf_na_ind === "NA") {
    if (shown !== null || !noOffice) failures.push(`shard ${r.hcpcs}: NA code should have no office price, shows ${shown}`);
  } else if (shown !== (cents(r.nf_amount) > 0 ? cents(r.nf_amount) : null)) failures.push(`shard ${r.hcpcs}: shows ${shown} vs database ${cents(r.nf_amount)}`);
}

const table = [];
for (const code of ["97110", "97112", "97116", "97140", "97150", "97161"]) {
  const out = { code };
  for (const place of ny) {
    const row = byKey.get(`${code}|`);
    const got = localityDollars(row, "nf", place, file.conversion.nonQp);
    const want = db.prepare("select nf_amount from pfs_ny where period_id='2020D' and contractor=? and locality=? and hcpcs=? and mod=''").get(place.mac, place.number, code).nf_amount;
    out[keyOf(place)] = `${got.toFixed(2)}${cents(got) === cents(want) ? "" : ` != ${want}`}`;
    if (cents(got) !== cents(want)) failures.push(`therapy ${code} ${keyOf(place)}: ${got} vs ${want}`);
  }
  table.push(out);
}
console.table(table);
console.log(JSON.stringify({ localities: ny.length, cellsCompared: compared, restOfNyShardCodes: shardCompared, rest: rest ? keyOf(rest) : null, failCount: failures.length, failures: failures.slice(0, 10) }));
process.exit(failures.length === 0 ? 0 : 1);
