import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const read = (name) => JSON.parse(readFileSync(name, "utf8"));
const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;
const map = {};

function add(code, schedule, asOf, cents, name) {
  const key = String(code ?? "").trim().toUpperCase();
  if (!CODE.test(key) || typeof cents !== "number" || cents <= 0) return;
  if (!map[key]) map[key] = [];
  map[key].push({ s: schedule, t: String(asOf), c: cents, n: String(name ?? "").slice(0, 90) });
}

const other = read("public/medicare-other.json");
for (const row of other.asp.rows) add(row.c, "Part B drug", other.asp.asOf, row.cents, row.name);
for (const row of other.opps.rows) add(row.c, "Hospital outpatient", other.opps.asOf, row.cents, row.name);
for (const row of other.asc.rows) add(row.c, "Ambulatory surgery", other.asc.asOf, row.cents, row.name);

const ny = read("public/ny-medicaid.json");
for (const row of ny.physician.rows) add(row.c, "NY Medicaid physician", "2026", row.nf, row.name);
for (const row of ny.lab.rows) add(row.c, "NY Medicaid lab", ny.lab.asOf ?? "2026", row.rate, row.name);
for (const row of ny.transport.rows) {
  if (row.county !== "CATTARAUGUS" || row.m) continue;
  add(row.c, "NY Medicaid ambulance", row.effective || "Cattaraugus", row.fee, row.c);
}

const more = read("public/ny-more.json");
for (const row of more.rows) add(row.c, `NY Medicaid ${row.family}`, row.asOf || "2026", row.fee, row.name);

const gaps = read("public/gap-rates.json");
for (const row of gaps.dental.rows) add(row.c, "NY dental", gaps.dental.asOf, row.cents, row.name);
for (const row of gaps.dme.rows) add(row.c, "Workers comp equipment", gaps.dme.asOf, row.cents, row.name);

const found = read("public/found-rates.json");
for (const row of found.apg.rows) add(row.c, "NY clinic", found.apg.asOf, row.cents, row.name);

const shards = {};
for (const [code, rows] of Object.entries(map)) {
  const prefix = code[0];
  if (!shards[prefix]) shards[prefix] = {};
  shards[prefix][code] = rows;
}
let files = 0;
for (const [prefix, rows] of Object.entries(shards)) {
  mkdirSync("public/once", { recursive: true });
  writeFileSync(`public/once/${prefix}.json`, JSON.stringify(rows));
  files += 1;
}
const drug = map["90371"]?.[0]?.c;
const ride = map["A0428"]?.find((row) => row.s === "NY Medicaid ambulance")?.c;
if (drug !== 13823 || ride !== 19142) {
  console.error({ drug, ride });
  process.exit(1);
}
console.log(JSON.stringify({ files, codes: Object.keys(map).length, drug, ride }));
