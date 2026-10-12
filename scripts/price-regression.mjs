/**
 * Regression tests for the values Claims Wedge's independent price check found wrong, and their answer-key values.
 * National = what the public build shows. Rest of NY = internal build (13282/99). Both read the files on disk.
 * Run: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/price-regression.mjs
 */
import { readFileSync } from "node:fs";
import { indexNational, notOfficeOf, ratesOf } from "../src/lib/pricing/national.ts";
import { localityPrices } from "../src/lib/pricing/locality.ts";
import { fromFile, review } from "../src/lib/desk/clock.ts";

const failures = [];
let ran = 0;
const same = (name, got, want) => {
  ran += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const read = (name) => JSON.parse(readFileSync(name, "utf8"));
const national = indexNational(read("public/pfs-national-2026.json"));
const NAT = fromFile(ratesOf(national), { mppr: national.mppr, notOffice: notOfficeOf(national) });
const ny = localityPrices(read("public/pfs-2026.json"), "13282/99");
const NY = fromFile(ny.rates, { mppr: ny.mppr, notOffice: ny.notOffice });

const total = (lines) => Math.round(lines.reduce((sum, line) => sum + line.allowed, 0) * 100) / 100;
const run = (note, rates) => review(note, rates);

// ---- 1. Therapy multiple-procedure payment reduction (MPPR) ----
const SAMPLE_01 = "Therapeutic exercise, 45 minutes, 3 units.\nGait training, 15 minutes, 1 unit.";
same("sample-01 national is $95.69", total(run(SAMPLE_01, NAT).lines), 95.69);
same("sample-01 Rest of NY is $93.58", total(run(SAMPLE_01, NY).lines), 93.58);
const THREE = "Therapeutic exercise, 15 minutes.\nNeuromuscular re-education, 15 minutes.\nManual therapy, 15 minutes.";
same("97110+97112+97140 national is $76.15", total(run(THREE, NAT).lines), 76.15);
same("97110+97112+97140 Rest of NY is $74.40", total(run(THREE, NY).lines), 74.4);
same("97112 has the highest PE, so it is the full-rate unit", run(THREE, NAT).lines.map((l) => [l.code, l.mppr.fullUnits, l.mppr.reducedUnits]), [["97110", 0, 1], ["97112", 1, 0], ["97140", 0, 1]]);
same("one unit of one code is not reduced", run("Therapeutic exercise, 15 minutes.", NAT).lines.map((l) => [l.allowed, l.mppr.reducedUnits]), [[29.06, 0]]);
same("two units of one code: full + reduced", total(run("Gait training, 30 minutes.", NAT).lines), 51.27);
same("two units of one code Rest of NY", total(run("Gait training, 30 minutes.", NY).lines), 50.04);
same("answer-key sample-02 national", total(run("Neuromuscular re-education, 30 minutes.\nTherapeutic exercise, 30 minutes.", NAT).lines), 102.03);
same("answer-key sample-03 national", total(run("Therapeutic exercise, 30 minutes.\nManual therapy, 15 minutes.", NAT).lines), 72.48);
same("answer-key sample-03 Rest of NY", total(run("Therapeutic exercise, 30 minutes.\nManual therapy, 15 minutes.", NY).lines), 70.82);
same("MPPR table: 52 therapy codes in the file, payable ones have a reduced price", Object.keys(national.mppr).length > 40 && Object.values(national.mppr).every((m) => m.reducedCents < m.fullCents), true);

// ---- 2. A line that names a service and writes its code counts once ----
const DOUBLE = "Therapeutic exercise (97110), 45 minutes, 3 units.\nGait training (97116), 15 minutes, 1 unit.";
same("code + phrase on one line: 3 units and 1 unit, not 6 and 2", run(DOUBLE, NAT).lines.map((l) => [l.code, l.units]), [["97110", 3], ["97116", 1]]);
same("code + phrase: national total is the sample-01 value", total(run(DOUBLE, NAT).lines), 95.69);
same("code + phrase: Rest of NY total is the sample-01 value", total(run(DOUBLE, NY).lines), 93.58);
same("the exact line from the report prices 3 units", run("Therapeutic exercise (97110), 45 minutes, 3 units.", NAT).lines.map((l) => [l.code, l.units]), [["97110", 3]]);
same("code only, no phrase: still 3 units", run("97110, 45 minutes, 3 units.", NAT).lines.map((l) => [l.code, l.units]), [["97110", 3]]);
same("two separate lines of one service still add", run("Therapeutic exercise, 15 minutes.\nTherapeutic exercise, 15 minutes.", NAT).lines.map((l) => [l.code, l.units]), [["97110", 2]]);
same("two identical lines (same words) still add", run("Gait training, 1 unit.\nGait training, 1 unit.", NAT).lines.map((l) => [l.code, l.units]), [["97116", 2]]);

// ---- 4. 97026 is paid ----
import { allowedOf } from "../src/lib/desk/clock.ts";
import { THERAPY } from "../src/lib/desk/therapy-codes.ts";
same("97026 national $6.68 on the desk", total(run("Infrared therapy, one unit.", NAT).lines), 6.68);
same("97026 Rest of NY $6.36 on the desk", total(run("Infrared therapy, one unit.", NY).lines), 6.36);
same("97026 typed table is $6.36 and separate", THERAPY.find((t) => t.code === "97026") && [THERAPY.find((t) => t.code === "97026").separate, THERAPY.find((t) => t.code === "97026").unitDollars], [true, 6.36]);
same("97026 typed fallback prices a unit at $6.36", allowedOf(1, "97026"), 6.36);
same("a bundled code (97010) is still $0 from the file", [allowedOf(1, "97010", NAT), allowedOf(1, "97010", NY)], [0, 0]);
same("97545 (status R, no amount) is still $0", [allowedOf(1, "97545", NAT), allowedOf(1, "97545", NY)], [0, 0]);
same("every typed therapy amount equals the file's Rest of NY amount", THERAPY.filter((t) => t.separate && Math.abs(t.unitDollars - (ny.rates[t.code] ?? 0)) > 0.0001).map((t) => t.code), []);

// ---- 3. Codes CMS marks non-facility NA get no office price ----
const PAYABLE = new Set(["A", "R", "T"]);
const full26 = read("public/pfs-2026.json");
const naCodes = full26.rows.filter((r) => r.m === "" && PAYABLE.has(r.s) && r.nn).map((r) => r.c);
same("4,043 payable codes are non-facility NA in the 2026 file", naCodes.length, 4043);
same("the public national file flags the same 4,043 codes", [...national.rows.values()].filter((r) => r.nn).length, 4043);
same("public build prices none of them", naCodes.filter((c) => NAT[c] !== undefined), []);
same("Rest of NY prices none of them either", naCodes.filter((c) => NY[c] !== undefined), []);
same("they are on the not-office list in both settings", naCodes.every((c) => notOfficeOf(national).has(c) && ny.notOffice.has(c)), true);
same("public build prices 3,702 codes (7,745 minus 4,043)", Object.keys(ratesOf(national)).length, 3702);
same("11004 has no national office price", [national.rows.get("11004").a["2026"], national.rows.get("11004").nn], [null, true]);
same("99221 has no national office price", national.rows.get("99221").a["2026"], null);
same("27447 has no national office price", national.rows.get("27447").a["2026"], null);
same("99214 is still priced (office visit)", national.rows.get("99214").a["2026"], 13561);
const THERAPY_CODES = THERAPY.map((t) => t.code);
same("none of the 61 therapy codes is non-facility NA", THERAPY_CODES.filter((c) => naCodes.includes(c)), []);
same("61 therapy codes", THERAPY_CODES.length, 61);
const na = run("Procedure 11004 was done.", NAT);
same("desk: an NA code in a note is a line with no office price, not a dollar amount", na.lines.map((l) => [l.code, l.allowed, l.notOffice === true]), [["11004", 0, true]]);
same("desk: Rest of NY says the same", run("Procedure 11004 was done.", NY).lines.map((l) => [l.code, l.allowed, l.notOffice === true]), [["11004", 0, true]]);
same("desk: NA line is left out of the total", total(run("Procedure 11004 was done.\nTherapeutic exercise, 15 minutes.", NAT).lines), 29.06);
import { readFileSync as rf } from "node:fs";
const shard1 = JSON.parse(rf("public/years/physician/1.json", "utf8"));
same("year shard: 11004 has no amount and is flagged for every year", [shard1["11004"].a["2026"], shard1["11004"].o.includes(2026), shard1["11004"].o.length], [null, true, 7]);
same("year shard: 11401 is priced and not flagged", [typeof shard1["11401"].a["2026"], shard1["11401"].o], ["number", undefined]);
import { describeCode } from "../src/lib/lookup/describe.ts";
same("code description says not priced in the office setting", describeCode("Physician", { n: "Dbrdmt skin xtrnl gent&per", a: { 2026: null }, s: "A", o: [2026] }).includes("not priced in the office setting"), true);

// ---- 1b. Invoice checker: therapy lines on one date are one day ----
import { pricedForDay } from "../src/lib/lookup/mppr-lines.ts";
const table = () => national.mppr;
const c = (code) => national.rows.get(code).a["2026"];
const day = pricedForDay([{ code: "97110", date: "2026-03-02", year: 2026, fileCents: c("97110") }, { code: "97140", date: "2026-03-02", year: 2026, fileCents: c("97140") }], table);
same("invoice: 97110 + 97140 same date: 97110 is full, 97140 reduced", day.map((d) => [d.expectedCents, d.reduced]), [[2906, false], [2121, true]]);
same("invoice: different dates are different days", pricedForDay([{ code: "97110", date: "2026-03-02", year: 2026, fileCents: c("97110") }, { code: "97140", date: "2026-03-03", year: 2026, fileCents: c("97140") }], table).map((d) => d.expectedCents), [2906, 2772]);
same("invoice: a line with no date is priced alone at the full rate", pricedForDay([{ code: "97110", date: "", year: 2026, fileCents: c("97110") }, { code: "97140", date: "", year: 2026, fileCents: c("97140") }], table).map((d) => d.expectedCents), [2906, 2772]);
same("invoice: a non-therapy code on the same date is not reduced", pricedForDay([{ code: "99214", date: "2026-03-02", year: 2026, fileCents: c("99214") }, { code: "97110", date: "2026-03-02", year: 2026, fileCents: c("97110") }], table).map((d) => d.expectedCents), [c("99214"), 2906]);
same("invoice: three therapy lines match the desk's $76.15", pricedForDay(["97110", "97112", "97140"].map((code) => ({ code, date: "d", year: 2026, fileCents: c(code) })), table).reduce((n, d) => n + d.expectedCents, 0), 7615);

// ---- 1c. Claim worksheet (internal, Rest of NY) ----
import { allowedByLine, claimTotals, quoteCode, withReduction } from "../src/lib/billing/billing.ts";
import { checkLine } from "../src/lib/billing/verify.ts";
import { parseInvoice } from "../src/lib/billing/invoice.ts";
const books = { physician: full26, ambulance: null, lab: null, dme: null };
const lineOf = (id, code, units, chargeCents) => {
  const q = quoteCode(books, code, "");
  return { id, code, modifier: "", units, chargeCents, allowedCents: q.allowedCents, ...(q.mppr ? { mppr: q.mppr } : {}), schedule: q.schedule, note: q.note };
};
const claimLines = [lineOf("a", "97110", 3, 2827), lineOf("b", "97116", 1, 2827)];
same("worksheet: quote carries the reduction values for 97110", quoteCode(books, "97110", "").mppr, { pe: 0.41, reducedCents: 2177 });
same("worksheet: sample-01 allowed per line (28.27 + 2 x 21.77, and 21.77)", allowedByLine(claimLines), { a: 7181, b: 2177 });
same("worksheet: sample-01 claim total is $93.58", claimTotals(claimLines).allowedCents, 9358);
same("worksheet: a line saved without the reduction values is still reduced", claimTotals(withReduction(claimLines.map(({ mppr, ...rest }) => rest), books)).allowedCents, 9358);
same("worksheet: charging the full rate on all four units is flagged", checkLine(claimLines[0], books, "medicare", null, claimLines).level, "high");
const expectedA = checkLine(claimLines[0], books, "medicare", null, claimLines).expectedCents;
same("worksheet: charging the reduced per-unit average clears", checkLine({ ...claimLines[0], chargeCents: expectedA }, books, "medicare", null, claimLines).level, "clear");
same("worksheet: one 97110 unit alone is not reduced", claimTotals([lineOf("x", "97110", 1, 2827)]).allowedCents, 2827);
same("worksheet: Medicaid claims are not reduced (4 x 28.27)", claimTotals(withReduction(claimLines, books, "medicaid")).allowedCents, 4 * 2827);
const inv = parseInvoice("Entity: Clinic\n97110 Therapeutic exercise 2026-07-01 28.27\n97140 Manual therapy 2026-07-01 26.97", books, "2026-07-01");
same("intake: second therapy line on the same date is expected at the reduced amount", inv.lines.map((l) => [l.allowedCents, l.mppr?.reduced === true, l.alert === null]), [[2827, false, true], [2078, true, false]]);
same("intake: NA code is not priced and raises the no-office-price alert", parseInvoice("Entity: Clinic\n11004 Debridement 2026-07-01 100.00", books, "2026-07-01").lines.map((l) => [l.allowedCents, l.alert?.reason.startsWith("Not priced in the office setting")]), [[null, true]]);
same("worksheet quote: NA code has no allowed amount and says why", [quoteCode(books, "11004", "").allowedCents, quoteCode(books, "11004", "").note.startsWith("Not priced in the office setting")], [null, true]);


// ---- 2020 New York localities (loaded from the CMS-Codes-checked history database, RVU20D) ----
// Expected values read from /workspace/healthcare-pfs/index/pfs_ny_history.sqlite, pfs_ny, period 2020D, non-facility.
const SQLITE_2020 = {"97110": {"13202/01": 35.64, "13202/02": 36.23, "13202/03": 33.36, "13292/04": 36.37, "13282/99": 30.47}, "97112": {"13202/01": 40.98, "13202/02": 41.62, "13202/03": 38.34, "13292/04": 41.78, "13282/99": 35.02}, "97116": {"13202/01": 35.21, "13202/02": 35.79, "13202/03": 32.96, "13292/04": 35.93, "13282/99": 30.13}, "97140": {"13202/01": 32.73, "13202/02": 33.29, "13202/03": 30.66, "13292/04": 33.42, "13282/99": 28.03}, "97150": {"13202/01": 21.15, "13202/02": 21.44, "13202/03": 19.86, "13292/04": 21.53, "13282/99": 18.27}, "97161": {"13202/01": 99.7, "13202/02": 101.29, "13202/03": 93.22, "13292/04": 101.66, "13282/99": 85.06}};
const f2020 = read("public/pfs-2020.json");
same("2020: five New York localities are offered", f2020.localities.filter((l) => l.state === "NY").map((l) => `${l.mac}/${l.number}`).sort(), ["13202/01", "13202/02", "13202/03", "13282/99", "13292/04"]);
for (const [code, byLoc] of Object.entries(SQLITE_2020)) {
  for (const [key, dollars] of Object.entries(byLoc)) {
    same(`2020 ${key} ${code} matches the database ($${dollars.toFixed(2)})`, localityPrices(f2020, key).rates[code], dollars);
  }
}
same("2020 Rest of NY 97110 on the Code screen's year shard is $30.47", JSON.parse(rf("public/years/physician/9.json", "utf8"))["97110"].a["2020"], 3047);
same("2020 Rest of NY therapy reduction table exists (97110 full 30.47)", [localityPrices(f2020, "13282/99").mppr["97110"].fullCents, localityPrices(f2020, "13282/99").mppr["97110"].reducedCents < 3047], [3047, true]);
same("2020 NA code 11004 is not priced in the office setting", [localityPrices(f2020, "13282/99").rates["11004"], localityPrices(f2020, "13282/99").notOffice.has("11004")], [undefined, true]);

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);
