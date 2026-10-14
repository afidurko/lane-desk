import { payLine } from "../src/lib/lookup/code-types.ts";
import { compareLine } from "../src/lib/lookup/sheet-book.ts";
import { placeOnFile, fileHint, placeCue } from "../src/lib/lookup/place.ts";
import { workpaper } from "../src/lib/account/workpaper.ts";
import { readInvoiceLines, paymentAlert } from "../src/lib/lookup/check.ts";
import { quoteCode } from "../src/lib/billing/billing.ts";
import { readFileSync } from "node:fs";

const books = {
  physician: JSON.parse(readFileSync("public/pfs-2026.json", "utf8")),
  ambulance: JSON.parse(readFileSync("public/afs-2026.json", "utf8")),
  lab: JSON.parse(readFileSync("public/clfs-2026.json", "utf8")),
  dme: JSON.parse(readFileSync("public/dme-2026.json", "utf8")),
};

const failures = [];
let ran = 0;
function check(name, ok) {
  ran += 1;
  if (!ok) failures.push(name);
}

const junk = [null, undefined, 0, -1, -0.5, 0.4, 1, 2, 99, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e12, 0.001];
for (const fileCents of [null, ...junk]) {
  for (const units of [null, ...junk]) {
    for (const admin of [null, 0, -5, 2068, Number.NaN]) {
      let pay;
      try {
        pay = payLine({ fileCents, units, seqRate: null, adminCents: admin, otherCents: null });
      } catch (error) {
        failures.push(`payLine threw ${fileCents}/${units}: ${error}`);
        ran += 1;
        continue;
      }
      ran += 1;
      const fileMissing = fileCents === null || typeof fileCents !== "number" || !Number.isFinite(fileCents);
      const unitsMissing = units === null || typeof units !== "number" || !Number.isFinite(units) || units <= 0;
      if ((fileMissing || unitsMissing) && pay.payable !== null) failures.push(`invented payable file=${fileCents} units=${units} -> ${pay.payable}`);
      if (pay.payable !== null && !Number.isFinite(pay.payable)) failures.push(`non-finite payable ${pay.payable}`);
    }
  }
}

function blank(code, year) {
  return {
    code, modifier: "", date: "", year, units: 1, setting: null, claim: null, schedule: "pfs",
    lookupCents: 99999, billedCents: 100, adminCents: null, seqRate: null, fileCents: null,
    otherCents: 5000, name: code, block: null,
  };
}
for (let i = 0; i < 2000; i += 1) {
  const line = blank(`X${i}`, 2020 + (i % 7));
  let compared;
  try {
    compared = compareLine(line);
  } catch (error) {
    failures.push(`compareLine threw ${i}: ${error}`);
    ran += 1;
    continue;
  }
  ran += 1;
  if (compared.flag !== "Unknown" || compared.youPay !== null) failures.push(`blank file used ${compared.flag} ${compared.youPay}`);
}

for (let i = 0; i < 500; i += 1) {
  const placed = placeOnFile({
    lookupCents: null,
    currentCents: null,
    posts: [
      { file: "pfs", label: "Office", cents: 1000 + i, otherCents: null },
      { file: "pfs", label: "Facility", cents: 2000 + i, otherCents: null },
    ],
  });
  ran += 1;
  if (placed !== null) failures.push(`two posts picked ${placed.cents}`);
  const page = placeOnFile({
    lookupCents: 50,
    currentCents: null,
    posts: [{ file: "pfs", label: "Office", cents: 1000, otherCents: null }],
    only: "lab",
  });
  ran += 1;
  if (page !== null) failures.push(`page dollar copied ${page.cents}`);
}

const lines = [];
for (let i = 0; i < 3000; i += 1) {
  lines.push(blank("97110", i % 2 === 0 ? 2026 : null));
}
let paper;
try {
  paper = workpaper(lines);
} catch (error) {
  failures.push(`workpaper threw: ${error}`);
  paper = null;
}
ran += 1;
if (paper && paper.youPay !== 0) failures.push(`blank sheet totaled ${paper.youPay}`);
if (paper && paper.unknown !== 3000) failures.push(`unknown count ${paper?.unknown}`);

const garbage = ["", "\0", "<<<", "'; DROP TABLE", "=cmd", "97110", "not a code $$$", "\n\n\n", "A".repeat(20000), "97110\t1\t-5\tNaN"];
for (let i = 0; i < 2000; i += 1) {
  const raw = garbage[i % garbage.length] + (i % 17 === 0 ? `\n${i}` : "");
  try {
    const parsed = readInvoiceLines(raw);
    ran += 1;
    if (!Array.isArray(parsed)) failures.push("readInvoiceLines not an array");
  } catch (error) {
    failures.push(`readInvoiceLines threw: ${error}`);
    ran += 1;
  }
  try {
    const quoted = quoteCode(books, raw.slice(0, 12), i % 2 ? "26" : "");
    ran += 1;
    if (quoted.allowedCents !== null && quoted.allowedCents < 0) failures.push(`negative quote ${quoted.allowedCents}`);
  } catch (error) {
    failures.push(`quoteCode threw: ${error}`);
    ran += 1;
  }
}

for (const broken of [Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
  const compared = compareLine({ ...blank("97110", 2026), fileCents: broken, units: 3, adminCents: 100 });
  ran += 1;
  if (compared.flag !== "Unknown" || compared.youPay !== null) failures.push(`broken file matched ${String(broken)} ${compared.flag} ${compared.youPay}`);
}
const doubled = compareLine({ ...blank("97110", 2026), fileCents: 2827, units: 3, adminCents: null, lookupCents: 2827, billedCents: 8481 });
ran += 1;
if (doubled.youPay !== 8481 || doubled.flag !== "Match") failures.push(`3 units priced ${doubled.youPay} ${doubled.flag}`);
for (let i = 0; i < 2000; i += 1) {
  const fileCents = 1000 + (i % 4000);
  const charge = fileCents + 50 + (i % 20);
  const compared = compareLine({ ...blank("97110", 2026), fileCents, units: 1, adminCents: null, lookupCents: null, billedCents: charge });
  ran += 1;
  if (compared.flag === "Match" || compared.youPay !== fileCents || compared.theirs !== charge) failures.push(`charge ${charge} matched file ${fileCents} as ${compared.flag}`);
  const same = compareLine({ ...blank("97110", 2026), fileCents, units: 2, adminCents: null, lookupCents: fileCents, billedCents: fileCents * 2 });
  ran += 1;
  if (same.flag !== "Match" || same.youPay !== fileCents * 2) failures.push(`equal charge flagged ${same.flag} ${same.youPay}`);
}
for (let i = 0; i < 1000; i += 1) {
  const blown = payLine({ fileCents: 2827, units: 1, seqRate: i % 2 === 0 ? 2 : 98, adminCents: null, otherCents: null });
  ran += 1;
  if (blown.payable !== 2827) failures.push(`seq ${i % 2 === 0 ? 2 : 98} changed the file to ${blown.payable}`);
}
check("hint does not invent a file", fileHint("the page says $30.32") === null);
check("a physician page names the physician file", fileHint("https://www.cms.gov/medicare/payment/fee-schedules/physician") === "pfs");
check("two files named together are not collapsed", fileHint("dmepos and the physician fee schedule") === null);
check("a lab page names the lab file", fileHint("clinical-laboratory-fee-schedule-clfs") === "lab");
check("both places do not pick one", placeCue("nonfacility 10.00 and facility price 8.00") === null);
check("office place can be named", placeCue("non-facility setting") === "nf");
check("zero units stays a look", paymentAlert({ code: "97110", year: 2026, billedCents: 2827, fileCents: 2827, units: 0 }).kind === "look");
check("missing file stays a look", paymentAlert({ code: "97110", year: 2026, billedCents: 2827, fileCents: null, units: 1 }).kind === "look");

console.log(JSON.stringify({ ran, failCount: failures.length, failures: failures.slice(0, 20) }));
if (failures.length) process.exit(1);
