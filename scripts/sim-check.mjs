import { readFileSync } from "node:fs";
import { quoteCode } from "../src/lib/billing/billing.ts";
import { claimGuards } from "../src/lib/billing/guard.ts";
import { safeFixes } from "../src/lib/help/routines.ts";
import { quoteNy } from "../src/lib/ny/medicaid.ts";
import { checkLine } from "../src/lib/billing/verify.ts";

const read = (name) => JSON.parse(readFileSync(name, "utf8"));
const pfs = read("public/pfs-2026.json");
const pfs2024 = read("public/pfs-2024.json");
const afs = read("public/afs-2026.json");
const clfs = read("public/clfs-2026.json");
const dme = read("public/dme-2026.json");
const ny = read("public/ny-medicaid.json");
const books = { physician: pfs, ambulance: afs, lab: clfs, dme };

const failures = [];
let ran = 0;
function check(name, ok) {
  ran += 1;
  if (!ok) failures.push(name);
}

const line = (code, charge, modifier = "") => ({
  id: code,
  code,
  modifier,
  units: 1,
  chargeCents: charge,
  allowedCents: charge,
  schedule: "sim",
  note: "",
});
const claim = (payer, lines, pos = "11") => ({
  id: "c",
  clientId: "o",
  dos: "2026-07-01",
  pos,
  diagnosis: "M25.561",
  number: "OLN-1",
  note: "",
  payer,
  status: "draft",
  lines,
});

check("97110 is 28.27", quoteCode(books, "97110", "").allowedCents === 2827);
check("2024 file is a different year", pfs2024.year === 2024);
const old = quoteCode({ ...books, physician: pfs2024 }, "97110", "");
check("2024 97110 is priced from that file", old.allowedCents !== null && old.allowedCents > 0);
check(
  "a 2026 date is blocked on the 2024 file",
  claimGuards(claim("medicare", [line("97110", 2827, "GP")]), { ...books, physician: pfs2024 }, "2026-10-11").some((item) => item.reason.includes("2026")),
);

let priced = 0;
for (const row of pfs.rows) {
  if (row.m !== "" || row.s !== "A") continue;
  const quoted = quoteCode(books, row.c, "");
  if (!quoted.schedule.startsWith("Physician")) continue;
  priced += 1;
  check(`physician ${row.c}`, quoted.allowedCents === null || quoted.allowedCents > 0);
  if (priced === 400) break;
}
check("priced 400 physician rows", priced === 400);

for (const row of afs.rows.filter((item) => item.carrier === "13282" && item.loc === "99" && item.rural > 0).slice(0, 80)) {
  check(`ambulance ${row.c}`, quoteCode(books, row.c, "").allowedCents === row.rural);
}

let labClash = 0;
for (const row of clfs.rows.filter((item) => item.m === "" && item.rate > 0).slice(0, 80)) {
  const quoted = quoteCode(books, row.c, "");
  if (!quoted.schedule.startsWith("Clinical lab")) labClash += 1;
  else check(`lab ${row.c}`, quoted.allowedCents === row.rate);
}
check("lab rows stay on the lab file", labClash === 0);

for (const row of dme.rows.filter((item) => !item.m && rowRural(item) > 0).slice(0, 80)) {
  check(`dme ${row.c}`, quoteCode(books, row.c, "").allowedCents === row.rural);
}

const state = quoteNy(ny, "A0426");
check("Cattaraugus A0426 is the state file", state.allowedCents === 22762);
const medicaid = claim("medicaid", [line("A0426", 22762)], "41");
check("matching medicaid charge is clear", checkLine(medicaid.lines[0], books, "medicaid", ny).level === "clear");
const low = claim("medicaid", [line("A0426", 100)], "41");
const flagged = checkLine(low.lines[0], books, "medicaid", ny);
check("low medicaid charge expects the state fee", flagged.level === "high" && flagged.expectedCents === 22762);
const fixed = safeFixes(low, books, ny);
check("safe fix uses the state fee", fixed.claim.lines[0].chargeCents === 22762 && fixed.claim.pos === "41");
const unloaded = safeFixes(low, books, null);
check("missing state file does not copy Medicare", unloaded.claim.lines[0].chargeCents === 100);

console.log(JSON.stringify({ ran, failCount: failures.length, failures: failures.slice(0, 12), labClash }));
if (failures.length > 0) process.exit(1);

function rowRural(row) {
  return row.rural;
}
