/**
 * The CMS 2020 GPCI file the app loaded has no state column, so the five New York localities were never labelled NY
 * and the app did not offer them for 2020. The CMS-Codes-checked history database has them. This script checks every
 * New York locality in that database (RVU20D: MAC, locality, name, work, practice-expense and malpractice GPCI)
 * against public/pfs-2020.json and labels exactly those five rows state "NY". It changes nothing else.
 * It stops if any locality is missing or any value differs.
 * Usage: node --experimental-sqlite scripts/load-ny-2020.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DB = process.env.PFS_NY_DB ?? "/workspace/healthcare-pfs/index/pfs_ny_history.sqlite";
const db = new DatabaseSync(DB, { readOnly: true });
const rows = db
  .prepare("select contractor, locality, locality_name, work_gpci_published w, pe_gpci pe, mp_gpci mp from ny_gpci where year = 2020 and release = 'RVU20D' order by contractor, locality")
  .all();
if (rows.length !== 5) throw new Error(`expected 5 New York localities for 2020 RVU20D, found ${rows.length}`);

const path = "public/pfs-2020.json";
const file = JSON.parse(readFileSync(path, "utf8"));
if (file.release !== "RVU20D") throw new Error(`pfs-2020.json is ${file.release}, expected RVU20D`);
let changed = 0;
for (const row of rows) {
  const hit = file.localities.find((item) => item.mac === row.contractor && item.number === row.locality);
  if (!hit) throw new Error(`${row.contractor}/${row.locality} is not in pfs-2020.json`);
  if (hit.name !== row.locality_name) throw new Error(`${row.contractor}/${row.locality}: name ${hit.name} vs ${row.locality_name}`);
  for (const [key, want] of [["work", row.w], ["pe", row.pe], ["mp", row.mp]]) {
    if (Math.abs(hit[key] - Number(want)) > 1e-9) throw new Error(`${row.contractor}/${row.locality}: ${key} ${hit[key]} vs ${want}`);
  }
  if (hit.state !== "NY") {
    hit.state = "NY";
    changed += 1;
  }
}
const ny = file.localities.filter((item) => item.state === "NY");
if (ny.length !== 5) throw new Error(`pfs-2020.json would have ${ny.length} NY localities`);
if (process.argv.includes("--check")) {
  console.log(changed === 0 ? "2020 New York localities are labelled and match the database" : `${changed} localities still need the NY label. Run: node --experimental-sqlite scripts/load-ny-2020.mjs`);
  process.exit(changed === 0 ? 0 : 1);
}
writeFileSync(path, JSON.stringify(file) + "\n");
console.log(JSON.stringify({ labelled: changed, ny: ny.map((item) => `${item.mac}/${item.number} ${item.name}`) }));
