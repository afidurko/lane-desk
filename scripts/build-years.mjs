import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { AMBULANCE_NAMES } from "../src/lib/book/ambulance.ts";
import { conversionFor, localityDollars } from "../src/lib/book/price.ts";

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const read = (name) => JSON.parse(readFileSync(name, "utf8"));

function bucket() {
  return {};
}

function put(map, code, year, cents, name, status) {
  const key = code.trim().toUpperCase();
  if (!map[key]) map[key] = { n: "", a: {} };
  if (name && (!map[key].n || year === 2026)) map[key].n = name.slice(0, 90);
  if (status) map[key].s = status;
  map[key].a[String(year)] = cents;
}

function putMap(map, code, field, year, cents) {
  const key = code.trim().toUpperCase();
  if (!map[key] || !(cents > 0)) return;
  if (!map[key][field]) map[key][field] = {};
  map[key][field][String(year)] = cents;
}

function putPart(map, code, modifier, year, cents, name, status) {
  const key = code.trim().toUpperCase();
  if (!map[key]) map[key] = { n: name ? name.slice(0, 90) : "", a: {}, s: status };
  if (!map[key].p) map[key].p = {};
  if (!map[key].p[modifier]) map[key].p[modifier] = {};
  map[key].p[modifier][String(year)] = cents;
}

const physician = bucket();
for (const year of YEARS) {
  const file = read(`public/pfs-${year}.json`);
  const place = file.localities.find((item) => item.mac === "13282" && item.number === "99") ?? null;
  for (const row of file.rows) {
    if (row.m !== "") continue;
    const conversion = conversionFor(row, "nonQp", file);
    const payable = row.s === "A" || row.s === "R" || row.s === "T";
    const dollars = payable && conversion && place ? localityDollars(row, "nf", place, conversion) : 0;
    put(physician, row.c, year, dollars > 0 ? Math.round(dollars * 100) : null, row.d, row.s);
    const facility = payable && conversion && place ? localityDollars(row, "fac", place, conversion) : 0;
    if (facility > 0) putMap(physician, row.c, "f", year, Math.round(facility * 100));
  }
  for (const row of file.rows) {
    if (row.m !== "26" && row.m !== "TC") continue;
    const conversion = conversionFor(row, "nonQp", file);
    const payable = row.s === "A" || row.s === "R" || row.s === "T";
    const dollars = payable && conversion && place ? localityDollars(row, "nf", place, conversion) : 0;
    if (dollars > 0) putPart(physician, row.c, row.m, year, Math.round(dollars * 100), row.d, row.s);
  }
}

const ambulance = bucket();
for (const year of YEARS) {
  const file = read(`public/afs-${year}.json`);
  for (const row of file.rows) {
    if (row.carrier !== "13282" || row.loc !== "99") continue;
    put(ambulance, row.c, year, row.rural > 0 ? row.rural : null, AMBULANCE_NAMES[row.c] ?? row.c);
  }
}

const lab = bucket();
for (const year of YEARS) {
  const file = read(`public/clfs-${year}.json`);
  for (const row of file.rows) {
    if (row.m !== "") continue;
    put(lab, row.c, year, row.rate > 0 ? row.rate : null, row.name);
  }
}

const dme = bucket();
for (const year of YEARS) {
  const file = read(`public/dme-${year}.json`);
  for (const row of file.rows) {
    if (row.m) continue;
    put(dme, row.c, year, row.rural > 0 ? row.rural : null, row.name || row.c);
  }
}

const families = { physician, ambulance, lab, dme };
let files = 0;
for (const [family, map] of Object.entries(families)) {
  const shards = {};
  for (const [code, row] of Object.entries(map)) {
    const prefix = code[0];
    if (!shards[prefix]) shards[prefix] = {};
    shards[prefix][code] = row;
  }
  for (const [prefix, rows] of Object.entries(shards)) {
    const dir = `public/years/${family}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${prefix}.json`, JSON.stringify(rows));
    files += 1;
  }
}

const sample = physician["97110"]?.a?.["2026"];
if (sample !== 2827) {
  console.error("97110 2026 was", sample);
  process.exit(1);
}
console.log(JSON.stringify({ files, physician: Object.keys(physician).length, ambulance: Object.keys(ambulance).length, lab: Object.keys(lab).length, dme: Object.keys(dme).length, sample }));
