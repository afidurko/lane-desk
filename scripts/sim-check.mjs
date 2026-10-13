import { readFileSync } from "node:fs";
import { quoteCode } from "../src/lib/billing/billing.ts";
import { claimGuards } from "../src/lib/billing/guard.ts";
import { safeFixes } from "../src/lib/help/routines.ts";
import { quoteNy } from "../src/lib/ny/medicaid.ts";
import { checkLine, claimAlerts } from "../src/lib/billing/verify.ts";
import { associate } from "../src/lib/lookup/associate.ts";
import { auditReport, paymentAlert } from "../src/lib/lookup/check.ts";
import { medicareCents } from "../src/lib/pace/rates.ts";

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

const years = { 2020: 3047, 2021: 2956, 2022: 2931, 2023: 2905, 2024: 2849, 2025: 2799, 2026: 2827 };
const hit = { family: "physician", label: "Rest of New York", row: { a: years } };
for (const [year, cents] of Object.entries(years)) {
  const found = associate({
    code: "97110",
    modifier: "",
    year: Number(year),
    setting: "nf",
    payer: "medicare",
    ambiguous: false,
    chargeKnown: true,
    hits: [hit],
    once: null,
  });
  check(`97110 ${year} stays on that year`, found.cents === cents && found.block === null);
  const wrong = paymentAlert({ code: "97110", year: Number(year), billedCents: year === "2026" ? 2849 : 2827, fileCents: cents, units: 1 });
  check(`97110 ${year} rejects the other year's amount`, wrong.kind === "off");
}
check("97160 is not guessed", associate({ code: "97160", modifier: "", year: 2026, setting: "nf", payer: "medicare", ambiguous: false, chargeKnown: true, hits: [], once: null }).cents === null);
check("a blank year is not priced", associate({ code: "97110", modifier: "", year: null, setting: "nf", payer: "medicare", ambiguous: false, chargeKnown: true, hits: [hit], once: null }).cents === null);
check("Medicaid does not borrow the Medicare file", associate({ code: "97110", modifier: "", year: 2026, setting: "nf", payer: "medicaid", ambiguous: false, chargeKnown: true, hits: [hit], once: null }).block !== null);
check("two amounts are not chosen", associate({ code: "97110", modifier: "", year: 2026, setting: "nf", payer: "medicare", ambiguous: true, chargeKnown: true, hits: [hit], once: null }).cents === null);
const unknownYear = paymentAlert({ code: "97160", year: 2024, billedCents: 9546, fileCents: null, units: 1 });
check("a missing year file is a look, not a match", unknownYear.kind === "look" && unknownYear.reason.includes("No amount was guessed"));
const shaved = auditReport({ code: "97110", year: 2026, billedCents: 2827, paidCents: 2770, paidKind: "paid", fileCents: 2827, units: 1 });
check("a 2 percent cut is not a match", shaved.kind === "off" && shaved.side === "under");
const crossed = auditReport({ code: "97161", year: 2026, billedCents: 8506, paidCents: 9546, paidKind: "allowed", fileCents: 9546, units: 1 });
check("a 2020 charge against a 2026 file is off", crossed.kind === "off");

for (const bad of ["", "NOPE", "97160", "00000"]) {
  const result = checkLine(line(bad || "blank", 2827, "GP"), books);
  check(`invalid ${bad || "blank"} is not given a dollar`, result.level === "high" && result.expectedCents === null);
}
const stale = checkLine(line("97110", 2849, "GP"), books);
check("a 2024 charge is not clear on the 2026 file", stale.level === "high" && stale.expectedCents === 2827);
const bare = claimAlerts(claim("medicare", [line("97110", 2827, "")]), books, "2026-10-12");
check("therapy without a discipline is not ready", bare.some((item) => item.check.reason.includes("GP")));
const dirty = claim("medicare", [
  { ...line("97110", 2827, "GP"), id: "good" },
  { ...line("97110", 2849, "GP"), id: "old-year" },
  { ...line("97160", 5000, "GP"), id: "missing" },
  { ...line("NOPE", 100, ""), id: "junk" },
  { ...line("A0426", 22762, ""), id: "ride", units: 0 },
], "11");
dirty.dos = "2024-03-02";
dirty.diagnosis = "pain";
const alerts = claimAlerts(dirty, books, "2026-10-12", ny);
const reasons = alerts.map((item) => item.check.reason).join(" ");
check("mixed claim blocks the wrong year", reasons.includes("2024") && reasons.includes("2026"));
check("mixed claim blocks a word diagnosis", reasons.includes("diagnosis"));
check("mixed claim blocks the duplicate", reasons.includes("already on the claim"));
check("mixed claim blocks the ambulance place", reasons.includes("place of service 41"));
check("mixed claim blocks bad units", reasons.includes("whole number"));
check("mixed claim does not price 97160", alerts.some((item) => item.line.code === "97160" && item.check.expectedCents === null));
check("mixed claim names the 2026 file amount", alerts.some((item) => item.line.id === "old-year" && item.check.expectedCents === 2827));

const erie = quoteNy(ny, "A0426", "ERIE");
const allegany = quoteNy(ny, "A0426", "ALLEGANY");
check("Erie ambulance is not the Cattaraugus fee", erie.allowedCents === 22731);
check("Allegany ambulance is not the Cattaraugus fee", allegany.allowedCents === 22741);
const erieClear = checkLine(line("A0426", 22731), books, "medicaid", ny, "ERIE");
check("Erie matches its own fee", erieClear.level === "clear" && erieClear.expectedCents === 22731);
const erieWrong = checkLine(line("A0426", 22762), books, "medicaid", ny, "ERIE");
check("Erie rejects the Cattaraugus fee", erieWrong.level === "high" && erieWrong.expectedCents === 22731);
const erieDraft = claim("medicaid", [line("A0426", 100)], "41");
erieDraft.county = "ERIE";
const erieFixed = safeFixes(erieDraft, books, ny);
check("the draft fix uses the Erie fee", erieFixed.claim.lines[0].chargeCents === 22731);
const unpriced = safeFixes(claim("medicaid", [line("97160", 100)], "11"), books, ny);
check("a code with no file amount is not rewritten", unpriced.claim.lines[0].chargeCents === 100 && unpriced.changed === 0);
const borrowed = checkLine(line("97110", 2827, "GP"), books, "medicaid", ny, "ERIE");
check("Medicaid does not accept the Medicare therapy amount", borrowed.level === "high" && borrowed.expectedCents === null);
check("Cattaraugus PACE is not the Erie PACE rate", medicareCents("Cattaraugus", 2026, false) === 126349 && medicareCents("Erie", 2026, false) === 139641);
check("an unknown PACE year is not filled in", medicareCents("Cattaraugus", 2024, false) === null);

console.log(JSON.stringify({ ran, failCount: failures.length, failures: failures.slice(0, 12), labClash }));
if (failures.length > 0) process.exit(1);

function rowRural(row) {
  return row.rural;
}
